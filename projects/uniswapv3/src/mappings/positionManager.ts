import { BigDecimal } from '@subsquid/big-decimal';

import {
  BlockHandlerContext,
  CommonHandlerContext,
  BlockHeader,
} from '../utils/interfaces/interfaces';
import * as factoryAbi from './../abi/factory';
import { Multicall } from '../utils/multicall';
import {
  FACTORY_ADDRESS,
  MULTICALL_ADDRESS,
  MULTICALL_PAGE_SIZE,
  POSITIONS_ADDRESS,
} from '../utils/constants';
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
  coingeckoApiKey: string,
  protocolStates: Map<string, ProtocolStateUniswapV3>,
): Promise<void> {
  const eventsData = processItems(ctx, block, protocolStates);
  if (!eventsData || eventsData.length == 0) return;

  await prefetch(ctx, eventsData, block.header, positionStorageService, protocolStates);

  await processPairs(
    ctx,
    block,
    positionTracker,
    positionStorageService,
    protocolStates,
    coingeckoApiKey,
  );
  for (const data of eventsData) {
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
        );
        break;
    }
  }

  // await updateFeeVars(createContext(last(blocks).header), ctx.entities.values(Position))
}

async function prefetch(
  ctx: ContextWithEntityManager,
  eventsData: EventData[],
  block: BlockHeader,
  positionStorageService: PositionStorageService,
  protocolStates: Map<string, ProtocolStateUniswapV3>,
) {
  const positionIds = new Set<string>();
  for (const data of eventsData) {
    const checkIfPositionExists = await positionStorageService.checkIfPositionExists(data.tokenId);
    if (!checkIfPositionExists) {
      positionIds.add(data.tokenId);
    }
  }
  const positions = await initPositions(
    { ...ctx, block },
    Array.from(positionIds),
    Array.from(protocolStates.keys()),
  );
  if (positions && positions.length > 0) {
    await positionStorageService.storeBatchPositions(positions);
  }
}

function processItems(
  ctx: CommonHandlerContext<unknown>,
  block: BlockData,
  protocolStates: Map<string, ProtocolStateUniswapV3>,
) {
  let eventsData: EventData[] = [];

  for (let log of block.logs) {
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
        console.log('IncreaseLiquidity_event_data_for_current_block');
        eventsData.push({
          type: 'Increase',
          ...data,
        });
        break;
      }
      case positionsAbi.events.DecreaseLiquidity.topic: {
        const data = processDecreaseLiquidity(evmLog);
        console.log('DecreaseLiquidity_event_data_for_current_block');

        eventsData.push({
          type: 'Decrease',
          ...data,
        });
        break;
      }
      case positionsAbi.events.Transfer.topic: {
        const data = processTransfer(evmLog);
        console.log('Transfer_event_data_for_current_block');
        eventsData.push({
          type: 'Transfer',
          ...data,
        });
        break;
      }
    }
  }

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
) {
  const position = await positionStorageService.getPosition(data.tokenId);
  if (!position) return;

  const token0 = await positionStorageService.getToken(position.token0Id);
  const token1 = await positionStorageService.getToken(position.token1Id);
  if (!token0 || !token1) {
    console.warn(
      `Skipping position ${data.tokenId} - missing token data: token0=${!!token0}, token1=${!!token1}`,
    );
    return;
  }
  const [token0inUSD, token1inUSD] = await getOptimizedTokenPrices(
    position.poolId,
    token0,
    token1,
    block,
    coingeckoApiKey,
    { ...ctx, block },
  );

  const amount0 = BigDecimal(data.amount0, token0!.decimals).toNumber();
  const amount1 = BigDecimal(data.amount1, token1!.decimals).toNumber();
  const amountMintedUSD = amount0 * token0inUSD + amount1 * token1inUSD;
  const trackerData = await positionTracker.handleIncreaseLiquidity(block, data, amountMintedUSD);

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
) {
  const position = await positionStorageService.getPosition(data.tokenId);
  if (!position) return;

  const token0 = await positionStorageService.getToken(position.token0Id);
  const token1 = await positionStorageService.getToken(position.token1Id);
  if (!token0 || !token1) {
    console.warn(
      `Skipping position ${data.tokenId} - missing token data: token0=${!!token0}, token1=${!!token1}`,
    );
    return;
  }
  // let prices = sqrtPriceX96ToTokenPrices(
  //   BigInt(priceMetadata?.sqrtPriceX96 || '0'),
  //   token0!.decimals,
  //   token1!.decimals,
  // );
  // const token0Price = prices[0];
  // const token1Price = prices[1];

  const [token0inUSD, token1inUSD] = await getOptimizedTokenPrices(
    position.poolId,
    token0,
    token1,
    block,
    coingeckoApiKey,
    { ...ctx, block },
  );

  const amount0 = BigDecimal(data.amount0, token0!.decimals).toNumber();
  const amount1 = BigDecimal(data.amount1, token1!.decimals).toNumber();
  const amountBurnedUSD = amount0 * token0inUSD + amount1 * token1inUSD; // Direct USD calculation

  const trackerData = await positionTracker.handleDecreaseLiquidity(block, data, amountBurnedUSD);

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
  }
}

async function processTransferData(
  ctx: ContextWithEntityManager,
  block: BlockHeader,
  data: TransferData,
  protocolStates: Map<string, ProtocolStateUniswapV3>,
  positionTracker: PositionTracker,
  positionStorageService: PositionStorageService,
) {
  const position = await positionStorageService.getPosition(data.tokenId);
  if (!position) return;

  const trackerData = await positionTracker.handleTransfer(block, data);
  if (trackerData) {
    const poolState = protocolStates.get(position.poolId);

    if (poolState) {
      poolState.balanceWindows.push(trackerData);
    } else {
      console.log('Setting pool state for position', position.poolId);
      protocolStates.set(position.poolId, {
        balanceWindows: [trackerData],
        transactions: [],
      });
    }
  }
}

async function initPositions(
  ctx: BlockHandlerContext<Store>,
  ids: string[],
  poolAddresses: string[],
) {
  console.log('🚀 Starting initPositions', { totalIds: ids.length });

  if (!ids || ids.length === 0) {
    console.log('⚠️ No IDs provided');
    return [];
  }

  const positions: PositionData[] = [];
  const positionsByPool = new Map<string, PositionData[]>();
  const tickPoolIds: Set<string> = new Set();
  const poolTicks = new Map<string, number>();
  const multicall = new Multicall(ctx, MULTICALL_ADDRESS);
  const batchSize = 3000;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    console.log(
      `📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(ids.length / batchSize)} (IDs ${i + 1}-${i + batch.length})`,
    );

    try {
      // Get position data
      const positionResults = await multicall.tryAggregate(
        positionsAbi.functions.positions,
        POSITIONS_ADDRESS,
        batch.map((id) => ({ tokenId: BigInt(id) })),
        MULTICALL_PAGE_SIZE,
      );

      // Get owner data
      const ownerResults = await multicall.tryAggregate(
        positionsAbi.functions.ownerOf,
        POSITIONS_ADDRESS,
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
          console.warn(
            `⚠️ Skipping ${positionId} - position: ${positionResult.success}, owner: ${ownerResult.success}`,
          );
          continue;
        }

        // Skip if owner is zero address (burned position)
        if (ownerResult.value === '0x0000000000000000000000000000000000000000') {
          console.warn(`⚠️ Skipping ${positionId} - burned position (zero owner)`);
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
          poolId: '',
        });
      }

      console.log(`✅ Batch completed. Total positions: ${positions.length}`);
    } catch (error) {
      console.error(`❌ Batch failed:`, error);
      continue; // Continue with next batch
    }
  }

  // Get pool IDs for valid positions
  if (positions.length > 0) {
    console.log(`🏊 Getting pool IDs for ${positions.length} positions...`);

    try {
      const poolIds = await multicall.aggregate(
        factoryAbi.functions.getPool,
        FACTORY_ADDRESS,
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
      console.log(`🎯 Getting current ticks for ${tickPoolIds.size} pools...`);

      for (const poolId of Array.from(tickPoolIds)) {
        if (poolId) {
          try {
            //todo: think of reducing the rpc calls over here
            const result = await multicall.tryAggregate(
              poolAbi.functions.slot0,
              poolId, // Call on the actual pool address
              [{}],
              MULTICALL_PAGE_SIZE,
            );
            if (result[0]?.success) {
              poolTicks.set(poolId, result[0].value!.tick);
            }
          } catch (error) {
            console.warn(`Failed to get slot0 for pool ${poolId}:`, error);
          }
        }
      }

      positionsByPool.forEach((positions, poolId) => {
        const currentTick = poolTicks.get(poolId);

        if (currentTick !== undefined) {
          // Update all positions in this pool
          positions.forEach((position) => {
            const isInRange =
              position.tickLower <= currentTick && currentTick <= position.tickUpper;
            position.isActive = isInRange ? 'true' : 'false';

            console.log(
              `Position ${position.positionId}: tickLower=${position.tickLower}, tickUpper=${position.tickUpper}, currentTick=${currentTick}, isActive=${position.isActive}`,
            );
          });
        } else {
          positions.forEach((position) => {
            position.isActive = 'false';
            console.warn(
              `Failed to get tick for position ${position.positionId} (pool: ${poolId})`,
            );
          });
        }
      });
    } catch (error) {
      console.error('❌ Failed to get pool IDs or slot0 data:', error);
      positions.forEach((p) => {
        p.poolId = '';
        p.isActive = 'false';
      });
    }
  }

  const filteredPositions = positions.filter((pos) => poolAddresses.includes(pos.poolId));

  console.log('🎉 initPositions completed:', {
    totalPositions: filteredPositions.length,
    successRate: `${((filteredPositions.length / ids.length) * 100).toFixed(1)}%`,
  });

  //todo: improve redis saving op by sending the map later on
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
