import { BigDecimal } from '@subsquid/big-decimal';
import { logger } from '@absinthe/common';

import {
  BlockHandlerContext,
  CommonHandlerContext,
  BlockHeader,
} from '../utils/interfaces/interfaces';
import * as factoryAbi from './../abi/factory';
import { Multicall } from '../utils/multicall';
import { MULTICALL_PAGE_SIZE } from '@absinthe/common';
import { EntityManager } from '../utils/entityManager';
import * as poolAbi from './../abi/pool';
import * as positionsAbi from './../abi/NonfungiblePositionManager';
import { BlockData, DataHandlerContext } from '@subsquid/evm-processor';
import { EvmLog } from '@subsquid/evm-processor/src/interfaces/evm';
import { Store } from '@subsquid/typeorm-store';
import { PositionTracker } from '../services/PositionTracker';
import { PositionStorageService } from '../services/PositionStorageService';
import { PositionData, ProtocolStateUniswapV3 } from '../utils/interfaces/univ3Types';
import { processPairs } from './core';
import { getOptimizedTokenPrices } from '../utils/pricing';

type EventData =
  | (TransferData & { type: 'Transfer' })
  | (IncreaseData & { type: 'Increase' })
  | (DecreaseData & { type: 'Decrease' });

type ContextWithEntityManager = DataHandlerContext<Store> & {
  entities: EntityManager;
};

export async function processPositions(
  ctx: ContextWithEntityManager,
  block: BlockData,
  positionTracker: PositionTracker,
  positionStorageService: PositionStorageService,
  chainPlatform: string,
  coingeckoApiKey: string,
  positionsAddress: string,
  factoryAddress: string,
  multicallAddress: string,
  protocolStates: Map<string, ProtocolStateUniswapV3>,
): Promise<void> {
  logger.info(
    `🔄 [PositionManager] Processing block ${block.header.height} with ${block.logs.length} logs`,
  );
  const startTime = Date.now();

  const eventsData = processItems(ctx, block, protocolStates);
  if (!eventsData || eventsData.length == 0) {
    logger.info(`🔄 [PositionManager] No position events found in block ${block.header.height}`);
    return;
  }

  logger.info(
    `🔄 [PositionManager] Found ${eventsData.length} position events in block ${block.header.height}`,
  );
  const eventCounts = eventsData.reduce(
    (acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  logger.info(
    `🔄 [PositionManager] Event breakdown: ${Object.entries(eventCounts)
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ')}`,
  );

  await prefetch(
    ctx,
    eventsData,
    block.header,
    positionStorageService,
    protocolStates,
    positionsAddress,
    factoryAddress,
    multicallAddress,
  );

  await processPairs(
    ctx,
    block,
    positionTracker,
    positionStorageService,
    protocolStates,
    chainPlatform,
    coingeckoApiKey,
  );

  let processedCount = 0;
  let errorCount = 0;

  for (const data of eventsData) {
    try {
      switch (data.type) {
        case 'Increase':
          await processIncreaseData(
            ctx,
            block.header,
            data,
            protocolStates,
            positionTracker,
            positionStorageService,
            coingeckoApiKey,
            chainPlatform,
          );
          break;
        case 'Decrease':
          await processDecreaseData(
            ctx,
            block.header,
            data,
            protocolStates,
            positionTracker,
            positionStorageService,
            coingeckoApiKey,
            chainPlatform,
          );
          break;
        case 'Transfer':
          await processTransferData(
            ctx,
            block.header,
            data,
            protocolStates,
            positionTracker,
            positionStorageService,
            coingeckoApiKey,
            chainPlatform,
          );
          break;
      }
      processedCount++;
    } catch (error) {
      errorCount++;
      logger.error(
        `❌ [PositionManager] Failed to process ${data.type} event for token ${data.tokenId}:`,
        error,
      );
    }
  }

  const duration = Date.now() - startTime;
  logger.info(
    `🔄 [PositionManager] Block ${block.header.height} processing complete: ${processedCount} successful, ${errorCount} failed in ${duration}ms`,
  );
}

async function prefetch(
  ctx: ContextWithEntityManager,
  eventsData: EventData[],
  block: BlockHeader,
  positionStorageService: PositionStorageService,
  protocolStates: Map<string, ProtocolStateUniswapV3>,
  positionsAddress: string,
  factoryAddress: string,
  multicallAddress: string,
) {
  logger.info(`🔍 [PositionManager] Prefetching position data for ${eventsData.length} events...`);
  const startTime = Date.now();

  const positionIds = new Set<string>();
  for (const data of eventsData) {
    const checkIfPositionExists = await positionStorageService.checkIfPositionExists(data.tokenId);
    if (!checkIfPositionExists) {
      positionIds.add(data.tokenId);
    }
  }

  logger.info(`🔍 [PositionManager] Found ${positionIds.size} new positions to initialize`);

  if (positionIds.size === 0) {
    logger.info(`🔍 [PositionManager] All positions already exist, skipping initialization`);
    return;
  }

  const positions = await initPositions(
    { ...ctx, block },
    Array.from(positionIds),
    Array.from(protocolStates.keys()),
    positionsAddress,
    factoryAddress,
    multicallAddress,
  );

  if (positions && positions.length > 0) {
    logger.info(`🔍 [PositionManager] Storing ${positions.length} new positions...`);
    await positionStorageService.storeBatchPositions(positions);
    logger.info(`🔍 [PositionManager] Successfully stored ${positions.length} positions`);
  } else {
    logger.info(`🔍 [PositionManager] No valid positions to store`);
  }

  const duration = Date.now() - startTime;
  logger.info(`🔍 [PositionManager] Prefetch completed in ${duration}ms`);
}

function processItems(
  ctx: CommonHandlerContext<unknown>,
  block: BlockData,
  protocolStates: Map<string, ProtocolStateUniswapV3>,
) {
  logger.info(`📋 [PositionManager] Processing ${block.logs.length} logs for position events...`);
  let eventsData: EventData[] = [];
  let totalLogs = 0;

  for (let log of block.logs) {
    totalLogs++;
    let evmLog = {
      logIndex: log.logIndex,
      transactionIndex: log.transactionIndex,
      transactionHash: log.transaction?.hash || '',
      address: log.address,
      data: log.data,
      topics: log.topics,
    };

    switch (log.topics[0]) {
      case positionsAbi.events.IncreaseLiquidity.topic: {
        const data = processInreaseLiquidity(evmLog);
        logger.info(
          `📈 [PositionManager] IncreaseLiquidity: token ${data.tokenId}, liquidity +${data.liquidity}, amounts: ${data.amount0}/${data.amount1}`,
        );
        eventsData.push({
          type: 'Increase',
          ...data,
        });
        break;
      }
      case positionsAbi.events.DecreaseLiquidity.topic: {
        const data = processDecreaseLiquidity(evmLog);
        logger.info(
          `📉 [PositionManager] DecreaseLiquidity: token ${data.tokenId}, liquidity -${data.liquidity}, amounts: ${data.amount0}/${data.amount1}`,
        );
        eventsData.push({
          type: 'Decrease',
          ...data,
        });
        break;
      }
      case positionsAbi.events.Transfer.topic: {
        const data = processTransfer(evmLog);
        logger.info(`🔄 [PositionManager] Transfer: token ${data.tokenId} to ${data.to}`);
        eventsData.push({
          type: 'Transfer',
          ...data,
        });
        break;
      }
    }
  }

  logger.info(
    `📋 [PositionManager] Found ${eventsData.length} position events out of ${totalLogs} total logs`,
  );
  return eventsData;
}

async function processIncreaseData(
  ctx: ContextWithEntityManager,
  block: BlockHeader,
  data: IncreaseData,
  protocolStates: Map<string, ProtocolStateUniswapV3>,
  positionTracker: PositionTracker,
  positionStorageService: PositionStorageService,
  coingeckoApiKey: string,
  chainPlatform: string,
) {
  logger.info(`📈 [PositionManager] Processing IncreaseLiquidity for position ${data.tokenId}...`);

  const position = await positionStorageService.getPosition(data.tokenId);
  if (!position) {
    logger.warn(`⚠️ [PositionManager] Position ${data.tokenId} not found in storage`);
    return;
  }

  const token0 = await positionStorageService.getToken(position.token0Id);
  const token1 = await positionStorageService.getToken(position.token1Id);
  if (!token0 || !token1) {
    logger.warn(
      `⚠️ [PositionManager] Skipping position ${data.tokenId} - missing token data: token0=${!!token0}, token1=${!!token1}`,
    );
    return;
  }

  logger.info(
    `💰 [PositionManager] Fetching prices for tokens ${token0.symbol}/${token1.symbol}...`,
  );
  const [token0inUSD, token1inUSD] = await getOptimizedTokenPrices(
    position.poolId,
    token0,
    token1,
    block,
    coingeckoApiKey,
    chainPlatform,
  );

  logger.info(
    `💰 [PositionManager] Position ${data.tokenId}: +$${data.liquidity} USD (${data.amount0} ${token0.symbol} @ $${token0inUSD.toFixed(4)} + ${data.amount1} ${token1.symbol} @ $${token1inUSD.toFixed(4)})`,
  );

  const trackerData = await positionTracker.handleIncreaseLiquidity(
    block,
    data,
    data.liquidity,
    token0inUSD,
    token1inUSD,
    token0.decimals,
    token1.decimals,
  );

  if (trackerData) {
    const poolState = protocolStates.get(position.poolId);
    if (poolState) {
      poolState.balanceWindows.push(trackerData);
    } else {
      protocolStates.set(position.poolId, {
        balanceWindows: [trackerData],
        transactions: [],
      });
    }
    logger.info(`📊 [PositionManager] Added balance window for pool ${position.poolId}`);
  }
}

async function processDecreaseData(
  ctx: ContextWithEntityManager,
  block: BlockHeader,
  data: DecreaseData,
  protocolStates: Map<string, ProtocolStateUniswapV3>,
  positionTracker: PositionTracker,
  positionStorageService: PositionStorageService,
  coingeckoApiKey: string,
  chainPlatform: string,
) {
  logger.info(`📉 [PositionManager] Processing DecreaseLiquidity for position ${data.tokenId}...`);

  const position = await positionStorageService.getPosition(data.tokenId);
  if (!position) {
    logger.warn(`⚠️ [PositionManager] Position ${data.tokenId} not found in storage`);
    return;
  }

  const token0 = await positionStorageService.getToken(position.token0Id);
  const token1 = await positionStorageService.getToken(position.token1Id);
  if (!token0 || !token1) {
    logger.warn(
      `⚠️ [PositionManager] Skipping position ${data.tokenId} - missing token data: token0=${!!token0}, token1=${!!token1}`,
    );
    return;
  }

  logger.info(
    `💰 [PositionManager] Fetching prices for tokens ${token0.symbol}/${token1.symbol}...`,
  );
  const [token0inUSD, token1inUSD] = await getOptimizedTokenPrices(
    position.poolId,
    token0,
    token1,
    block,
    coingeckoApiKey,
    chainPlatform,
  );

  logger.info(
    `💰 [PositionManager] Position ${data.tokenId}: -$${data.liquidity} USD (${data.amount0} ${token0.symbol} @ $${token0inUSD.toFixed(4)} + ${data.amount1} ${token1.symbol} @ $${token1inUSD.toFixed(4)})`,
  );

  const trackerData = await positionTracker.handleDecreaseLiquidity(
    block,
    data,
    data.liquidity,
    token0inUSD,
    token1inUSD,
    token0.decimals,
    token1.decimals,
  );

  if (trackerData) {
    const poolState = protocolStates.get(position.poolId);
    if (poolState) {
      poolState.balanceWindows.push(trackerData);
    } else {
      protocolStates.set(position.poolId, {
        balanceWindows: [trackerData],
        transactions: [],
      });
    }
    logger.info(`📊 [PositionManager] Added balance window for pool ${position.poolId}`);
  }
}

async function processTransferData(
  ctx: ContextWithEntityManager,
  block: BlockHeader,
  data: TransferData,
  protocolStates: Map<string, ProtocolStateUniswapV3>,
  positionTracker: PositionTracker,
  positionStorageService: PositionStorageService,
  coingeckoApiKey: string,
  chainPlatform: string,
) {
  logger.info(
    `🔄 [PositionManager] Processing Transfer for position ${data.tokenId} to ${data.to}...`,
  );

  const position = await positionStorageService.getPosition(data.tokenId);
  if (!position) {
    logger.warn(`⚠️ [PositionManager] Position ${data.tokenId} not found in storage`);
    return;
  }

  const token0 = await positionStorageService.getToken(position.token0Id);
  const token1 = await positionStorageService.getToken(position.token1Id);
  if (!token0 || !token1) {
    logger.warn(
      `⚠️ [PositionManager] Skipping position ${data.tokenId} - missing token data: token0=${!!token0}, token1=${!!token1}`,
    );
    return;
  }

  logger.info(
    `💰 [PositionManager] Fetching prices for tokens ${token0!.symbol}/${token1!.symbol}...`,
  );
  const [token0inUSD, token1inUSD] = await getOptimizedTokenPrices(
    position.poolId,
    token0,
    token1,
    block,
    coingeckoApiKey,
    chainPlatform,
  );

  const trackerData = await positionTracker.handleTransfer(
    block,
    data,
    token0inUSD,
    token1inUSD,
    token0!.decimals,
    token1!.decimals,
  );
  if (trackerData) {
    const poolState = protocolStates.get(position.poolId);

    if (poolState) {
      poolState.balanceWindows.push(trackerData);
    } else {
      protocolStates.set(position.poolId, {
        balanceWindows: [trackerData],
        transactions: [],
      });
    }
    logger.info(
      `📊 [PositionManager] Added balance window for pool ${position.poolId} after transfer`,
    );
  }
}

async function initPositions(
  ctx: BlockHandlerContext<Store>,
  ids: string[],
  poolAddresses: string[],
  positionsAddress: string,
  factoryAddress: string,
  multicallAddress: string,
) {
  if (!ids || ids.length === 0) {
    logger.info(`🏗️ [PositionManager] No positions to initialize`);
    return [];
  }

  logger.info(`🏗️ [PositionManager] Initializing ${ids.length} positions...`);
  const startTime = Date.now();

  const positions: PositionData[] = [];
  const positionsByPool = new Map<string, PositionData[]>();
  const tickPoolIds: Set<string> = new Set();
  const poolTicks = new Map<string, number>();
  const multicall = new Multicall(ctx, multicallAddress);
  const batchSize = 3000;

  let totalProcessed = 0;
  let totalSkipped = 0;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    logger.info(
      `🏗️ [PositionManager] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(ids.length / batchSize)} (${batch.length} positions)...`,
    );

    try {
      // Get position data
      const positionResults = await multicall.tryAggregate(
        positionsAbi.functions.positions,
        positionsAddress,
        batch.map((id) => ({ tokenId: BigInt(id) })),
        MULTICALL_PAGE_SIZE,
      );

      // Get owner data
      const ownerResults = await multicall.tryAggregate(
        positionsAbi.functions.ownerOf,
        positionsAddress,
        batch.map((id) => ({ tokenId: BigInt(id) })),
        MULTICALL_PAGE_SIZE,
      );

      // Process results
      for (let j = 0; j < batch.length; j++) {
        const positionResult = positionResults[j];
        const ownerResult = ownerResults[j];
        const positionId = batch[j];

        // Skip if either call failed
        if (!positionResult.success || !ownerResult.success) {
          logger.warn(
            `⚠️ [PositionManager] Skipping ${positionId} - position: ${positionResult.success}, owner: ${ownerResult.success}`,
          );
          totalSkipped++;
          continue;
        }

        // Skip if owner is zero address (burned position)
        if (ownerResult.value === '0x0000000000000000000000000000000000000000') {
          logger.warn(`⚠️ [PositionManager] Skipping ${positionId} - burned position (zero owner)`);
          totalSkipped++;
          continue;
        }

        // Add valid position
        positions.push({
          positionId: positionId.toLowerCase(),
          token0Id: positionResult.value.token0.toLowerCase(),
          token1Id: positionResult.value.token1.toLowerCase(),
          liquidity: '0',
          fee: positionResult.value.fee,
          tickLower: positionResult.value.tickLower,
          tickUpper: positionResult.value.tickUpper,
          depositedToken0: '0',
          depositedToken1: '0',
          owner: ownerResult.value.toLowerCase(),
          isActive: 'false',
          lastUpdatedBlockTs: 0,
          lastUpdatedBlockHeight: 0,
          currentTick: 0,
          poolId: '',
        });
        totalProcessed++;
      }
    } catch (error) {
      logger.error(`❌ [PositionManager] Batch ${Math.floor(i / batchSize) + 1} failed:`, error);
      totalSkipped += batch.length;
      continue;
    }
  }

  logger.info(
    `🏗️ [PositionManager] Position data fetched: ${totalProcessed} valid, ${totalSkipped} skipped`,
  );

  // Get pool IDs for valid positions
  if (positions.length > 0) {
    logger.info(`🏗️ [PositionManager] Fetching pool IDs for ${positions.length} positions...`);
    try {
      const poolIds = await multicall.aggregate(
        factoryAbi.functions.getPool,
        factoryAddress,
        positions.map((p) => ({
          tokenA: p.token0Id,
          tokenB: p.token1Id,
          fee: p.fee,
        })),
        MULTICALL_PAGE_SIZE,
      );

      positions.forEach((position, index) => {
        const poolId = poolIds[index]?.toLowerCase() || '';
        tickPoolIds.add(poolId);
        position.poolId = poolId;
        if (!positionsByPool.has(poolId)) {
          positionsByPool.set(poolId, []);
        }
        positionsByPool.get(poolId)!.push(position);
      });

      logger.info(`🏗️ [PositionManager] Fetching current ticks for ${tickPoolIds.size} pools...`);
      for (const poolId of Array.from(tickPoolIds)) {
        if (poolId) {
          try {
            const result = await multicall.tryAggregate(
              poolAbi.functions.slot0,
              poolId,
              [{}],
              MULTICALL_PAGE_SIZE,
            );
            if (result[0]?.success) {
              poolTicks.set(poolId, result[0].value!.tick);
            }
          } catch (error) {
            logger.warn(`⚠️ [PositionManager] Failed to get slot0 for pool ${poolId}:`, error);
          }
        }
      }

      let activePositions = 0;
      positionsByPool.forEach((positions, poolId) => {
        const currentTick = poolTicks.get(poolId);

        if (currentTick !== undefined) {
          positions.forEach((position) => {
            const isInRange =
              position.tickLower <= currentTick && currentTick <= position.tickUpper;
            position.isActive = isInRange ? 'true' : 'false';
            position.currentTick = currentTick;
            if (isInRange) activePositions++;
          });
        } else {
          positions.forEach((position) => {
            position.isActive = 'false';
            logger.warn(
              `⚠️ [PositionManager] Failed to get tick for position ${position.positionId} (pool: ${poolId})`,
            );
          });
        }
      });

      logger.info(
        `🏗️ [PositionManager] Position status: ${activePositions} active, ${positions.length - activePositions} inactive`,
      );
    } catch (error) {
      logger.error('❌ [PositionManager] Failed to get pool IDs or slot0 data:', error);
      positions.forEach((p) => {
        p.poolId = '';
        p.isActive = 'false';
      });
    }
  }

  const filteredPositions = positions.filter((pos) => poolAddresses.includes(pos.poolId));
  logger.info(
    `🏗️ [PositionManager] Filtered to ${filteredPositions.length} positions in target pools`,
  );

  const duration = Date.now() - startTime;
  logger.info(`🏗️ [PositionManager] Position initialization completed in ${duration}ms`);

  return filteredPositions;
}

// async function updateFeeVars(ctx: BlockHandlerContext<Store>, positions: Position[]) {
//   const multicall = new Multicall(ctx, MULTICALL_ADDRESS);

//   const positionResult = await multicall.tryAggregate(
//     positionsAbi.functions.positions,
//     POSITIONS_ADDRESS,
//     positions.map((p) => {
//       return { tokenId: BigInt(p.id) };
//     }),
//     MULTICALL_PAGE_SIZE,
//   );

//   for (let i = 0; i < positions.length; i++) {
//     const result = positionResult[i];
//     if (result.success) {
//       positions[i].feeGrowthInside0LastX128 = result.value.feeGrowthInside0LastX128;
//       positions[i].feeGrowthInside1LastX128 = result.value.feeGrowthInside1LastX128;
//     }
//   }
// }
interface IncreaseData {
  tokenId: string;
  amount0: bigint;
  amount1: bigint;
  liquidity: bigint;
  transactionHash: string;
}

function processInreaseLiquidity(log: EvmLog): IncreaseData {
  const { tokenId, amount0, amount1, liquidity } =
    positionsAbi.events.IncreaseLiquidity.decode(log);

  return {
    tokenId: tokenId.toString(),
    amount0: amount0,
    amount1: amount1,
    liquidity: liquidity,
    transactionHash: log.transactionHash,
  };
}

interface DecreaseData {
  tokenId: string;
  amount0: bigint;
  amount1: bigint;
  liquidity: bigint;
  transactionHash: string;
}

function processDecreaseLiquidity(log: EvmLog): DecreaseData {
  const event = positionsAbi.events.DecreaseLiquidity.decode(log);

  return {
    tokenId: event.tokenId.toString(),
    amount0: event.amount0,
    amount1: event.amount1,
    liquidity: event.liquidity,
    transactionHash: log.transactionHash,
  };
}

interface TransferData {
  tokenId: string;
  to: string;
  transactionHash: string;
}

function processTransfer(log: EvmLog): TransferData {
  const { tokenId, to } = positionsAbi.events.Transfer.decode(log);
  return {
    tokenId: tokenId.toString(),
    to: to.toLowerCase(),
    transactionHash: log.transactionHash,
  };
}
