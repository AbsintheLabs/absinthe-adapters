import { BigDecimal } from '@subsquid/big-decimal';
import { EvmLog } from '@subsquid/evm-processor/lib/interfaces/evm';
import { BlockHeader, SwapData } from '../utils/interfaces/interfaces';
import * as poolAbi from '../abi/pool';
import { BlockData } from '@subsquid/evm-processor/src/interfaces/data';
import { Currency, fetchHistoricalUsd, logger, MessageType } from '@absinthe/common';
import { PositionStorageService } from '../services/PositionStorageService';
import { PositionTracker } from '../services/PositionTracker';
import { ContextWithEntityManager, ProtocolStateUniswapV3 } from '../utils/interfaces/univ3Types';
import { getCGId } from '../utils/pricing';
type EventData = SwapData & { type: 'Swap' };

export async function processPairs(
  ctx: ContextWithEntityManager,
  block: BlockData,
  positionTracker: PositionTracker,
  positionStorageService: PositionStorageService,
  protocolStates: Map<string, ProtocolStateUniswapV3>,
  chainPlatform: string,
  coingeckoApiKey: string,
): Promise<void> {
  const startTime = Date.now();
  logger.info(`🔄 Starting processPairs for block #${block.header.height}`, {
    blockHeight: block.header.height,
    timestamp: block.header.timestamp,
    timestampISO: new Date(block.header.timestamp).toISOString(),
    logCount: block.logs.length,
    chainPlatform,
  });

  let eventsData = await processItems(ctx, block);

  if (!eventsData || eventsData.length == 0) {
    logger.info(`⚪ No events found in block #${block.header.height}, skipping processPairs`);
    return;
  }

  logger.info(`📊 Found ${eventsData.length} events to process in block #${block.header.height}:`, {
    swapEvents: eventsData.filter((e) => e.type === 'Swap').length,
  });

  for (let i = 0; i < eventsData.length; i++) {
    const data = eventsData[i];
    logger.info(`🔄 Processing event ${i + 1}/${eventsData.length}:`, {
      type: data.type,
      poolId: data.poolId,
      logIndex: data.logIndex,
    });

    if (data.type === 'Swap') {
      const swapStartTime = Date.now();
      await processSwapData(
        ctx,
        block.header,
        data,
        positionTracker,
        positionStorageService,
        protocolStates,
        coingeckoApiKey,
        chainPlatform,
      );
      logger.info(`✅ Swap event processed in ${Date.now() - swapStartTime}ms`);
    }
  }

  logger.info(
    `🎯 processPairs completed for block #${block.header.height} in ${Date.now() - startTime}ms`,
  );
}

async function processItems(ctx: ContextWithEntityManager, block: BlockData) {
  const startTime = Date.now();
  logger.info(`🔍 Starting processItems for block #${block.header.height}`, {
    totalLogs: block.logs.length,
  });

  let eventsData: EventData[] = [];
  let swapCount = 0;

  for (let i = 0; i < block.logs.length; i++) {
    const log = block.logs[i];
    logger.info(`📋 Processing log ${i + 1}/${block.logs.length}:`, {
      address: log.address,
      topics: log.topics,
      logIndex: log.logIndex,
      transactionHash: log.transaction?.hash,
    });

    let evmLog = {
      logIndex: log.logIndex,
      transactionIndex: log.transactionIndex,
      transactionHash: log.transaction?.hash || '',
      address: log.address,
      data: log.data,
      topics: log.topics,
    };

    if (log.topics[0] === poolAbi.events.Swap.topic) {
      logger.info(`🔄 Found Swap event in log ${i + 1}`, {
        poolAddress: log.address,
        transactionHash: log.transaction?.hash,
        logIndex: log.logIndex,
      });

      try {
        let data = processSwap(evmLog, log.transaction);
        eventsData.push({
          type: 'Swap',
          ...data,
        });
        swapCount++;
        logger.info(`✅ Swap event decoded successfully:`, {
          poolId: data.poolId,
          amount0: data.amount0.toString(),
          amount1: data.amount1.toString(),
          tick: data.tick,
          sender: data.sender,
          recipient: data.recipient,
        });
      } catch (error) {
        logger.error(`❌ Failed to decode Swap event:`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          logIndex: log.logIndex,
          address: log.address,
        });
      }
    }
  }

  logger.info(`🎯 processItems completed in ${Date.now() - startTime}ms:`, {
    totalLogs: block.logs.length,
    swapEvents: swapCount,
    totalEvents: eventsData.length,
  });

  return eventsData;
}

// async function processInitializeData(
//   ctx: ContextWithEntityManager,
//   block: BlockHeader,
//   data: InitializeData,
//   positionStorageService: PositionStorageService,
// ) {
//   const poolMetadata = {
//     sqrtPriceX96: data.sqrtPrice.toString(),
//     tick: data.tick,
//   };
//   await positionStorageService.storePoolMetadata(data.poolId, poolMetadata);
// }

async function processSwapData(
  ctx: ContextWithEntityManager,
  block: BlockHeader,
  data: SwapData,
  positionTracker: PositionTracker,
  positionStorageService: PositionStorageService,
  protocolStates: Map<string, ProtocolStateUniswapV3>,
  coingeckoApiKey: string,
  chainPlatform: string,
): Promise<void> {
  const startTime = Date.now();
  logger.info(`🔄 Starting processSwapData:`, {
    poolId: data.poolId,
    amount0: data.amount0.toString(),
    amount1: data.amount1.toString(),
    tick: data.tick,
    sender: data.sender,
    recipient: data.recipient,
    blockHeight: block.height,
  });

  const positionsStartTime = Date.now();
  const positions = await positionStorageService.getAllPositionsByPoolId(data.poolId);
  logger.info(`📊 Retrieved positions for pool in ${Date.now() - positionsStartTime}ms:`, {
    poolId: data.poolId,
    positionCount: positions.length,
  });

  if (positions.length === 0) {
    logger.info(`⚪ No positions found for pool ${data.poolId}, skipping swap processing`);
    return;
  }

  const positionForReference = positions[0];
  logger.info(`🔍 Using reference position:`, {
    positionId: positionForReference.positionId,
    token0Id: positionForReference.token0Id,
  });

  const tokenStartTime = Date.now();
  const token0 = await positionStorageService.getToken(positionForReference.token0Id);
  logger.info(`🔍 Retrieved token data in ${Date.now() - tokenStartTime}ms:`, {
    token0: token0 ? { id: token0.id, symbol: token0.symbol, decimals: token0.decimals } : null,
  });

  if (!token0) {
    logger.warn(`❌ Skipping swap for pool ${data.poolId} - missing token data:`, {
      token0Exists: !!token0,
      token0Id: positionForReference.token0Id,
    });
    return;
  }

  const amount0 = BigDecimal(data.amount0, token0.decimals).toNumber();

  logger.info(`🧮 Calculated amounts:`, {
    poolId: data.poolId,
    rawAmount0: data.amount0.toString(),
    rawAmount1: data.amount1.toString(),
    amount0: amount0,
    token0Decimals: token0.decimals,
  });

  const amount0Abs = Math.abs(amount0);

  logger.info(`📊 Absolute amounts:`, {
    amount0Abs,
  });

  const pricingStartTime = Date.now();
  logger.info(`💰 Starting price calculation for tokens`);

  const token0inUSD = await fetchHistoricalUsd(
    getCGId(token0.id)!,
    block.timestamp,
    coingeckoApiKey,
  );

  logger.info(`💰 Price calculation completed in ${Date.now() - pricingStartTime}ms:`, {
    token0inUSD,
    token0Symbol: token0.symbol,
  });

  const swappedAmountUSD = amount0Abs * token0inUSD;

  logger.info(`💵 USD value calculation:`, {
    calculation: `${amount0Abs} * ${token0inUSD} = ${swappedAmountUSD}`,
    amount0USD: amount0Abs * token0inUSD,
    totalSwappedAmountUSD: swappedAmountUSD,
  });

  const transactionSchema = {
    eventType: MessageType.TRANSACTION,
    eventName: 'Swap',
    tokens: {
      token0Decimals: {
        value: token0!.decimals.toString(),
        type: 'number',
      },
      token0Address: {
        value: token0!.id,
        type: 'string',
      },
      token0Symbol: {
        value: token0!.symbol,
        type: 'string',
      },
      token0PriceUsd: {
        value: token0inUSD.toString(),
        type: 'number',
      },
      amount0: {
        value: amount0.toString(),
        type: 'number',
      },

      amount0Abs: {
        value: amount0Abs.toString(),
        type: 'number',
      },
      poolId: {
        value: data.poolId,
        type: 'string',
      },
      tick: {
        value: data.tick.toString(),
        type: 'number',
      },
    },
    rawAmount: amount0Abs.toString(),
    displayAmount: swappedAmountUSD,
    unixTimestampMs: block.timestamp,
    txHash: data.transaction.hash,
    logIndex: data.logIndex,
    blockNumber: block.height,
    blockHash: block.hash,
    userId: data.sender,
    currency: Currency.USD,
    valueUsd: swappedAmountUSD,
    gasUsed: Number(data.transaction.gas),
    gasFeeUsd: Number(data.transaction.gasPrice) * Number(data.transaction.gas),
  };

  logger.info(`📋 Created transaction schema:`, {
    txHash: data.transaction.hash,
    userId: data.sender,
    valueUsd: swappedAmountUSD,
    gasUsed: Number(data.transaction.gas),
    gasFeeUsd: Number(data.transaction.gasPrice) * Number(data.transaction.gas),
  });

  const protocolState = protocolStates.get(data.poolId);
  if (protocolState) {
    protocolState.transactions.push(transactionSchema);
    logger.info(`✅ Added transaction to existing protocol state for pool ${data.poolId}:`, {
      totalTransactions: protocolState.transactions.length,
    });
  } else {
    protocolStates.set(data.poolId, {
      balanceWindows: [],
      transactions: [transactionSchema],
    });
    logger.info(`🆕 Created new protocol state for pool ${data.poolId} with first transaction`);
  }

  const swapHandlingStartTime = Date.now();
  logger.info(`🔄 Starting position tracker handleSwap`);

  await positionTracker.handleSwap(
    block,
    data,
    positions,
    protocolStates,
    coingeckoApiKey,
    chainPlatform,
  );

  logger.info(
    `✅ Position trackerx handleSwap completed in ${Date.now() - swapHandlingStartTime}ms`,
  );
  logger.info(
    `🎯 processSwapData completed in ${Date.now() - startTime}ms for pool ${data.poolId}`,
  );
}

function processSwap(log: EvmLog, transaction: any): SwapData {
  const startTime = Date.now();
  logger.info(`🔄 Starting processSwap for log:`, {
    address: log.address,
    logIndex: log.logIndex,
    transactionHash: log.transactionHash,
  });

  try {
    let event = poolAbi.events.Swap.decode(log);

    const swapData = {
      transaction: {
        hash: transaction.hash,
        gasPrice: transaction.gasPrice,
        from: transaction.from,
        gas: BigInt(transaction.gasUsed || 0),
      },
      poolId: log.address,
      amount0: event.amount0,
      amount1: event.amount1,
      tick: event.tick,
      sqrtPrice: event.sqrtPriceX96,
      sender: event.sender,
      recipient: event.recipient,
      logIndex: log.logIndex,
      liquidity: event.liquidity,
    };

    logger.info(`✅ processSwap completed in ${Date.now() - startTime}ms:`, {
      poolId: swapData.poolId,
      amount0: swapData.amount0.toString(),
      amount1: swapData.amount1.toString(),
      tick: swapData.tick,
      sender: swapData.sender,
      recipient: swapData.recipient,
      liquidity: swapData.liquidity.toString(),
      sqrtPrice: swapData.sqrtPrice.toString(),
    });

    return swapData;
  } catch (error) {
    logger.error(`❌ Failed to decode swap event in ${Date.now() - startTime}ms:`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      logAddress: log.address,
      logIndex: log.logIndex,
    });
    throw error;
  }
}
