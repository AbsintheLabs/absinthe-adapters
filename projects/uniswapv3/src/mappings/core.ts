import { BigDecimal } from '@subsquid/big-decimal';
import { EvmLog } from '@subsquid/evm-processor/lib/interfaces/evm';
import { BlockHeader, SwapData } from '../utils/interfaces/interfaces';
import * as poolAbi from '../abi/pool';
import { BlockData } from '@subsquid/evm-processor/src/interfaces/data';
import { Currency, fetchHistoricalUsd, MessageType } from '@absinthe/common';
import { PositionStorageService } from '../services/PositionStorageService';
import { PositionTracker } from '../services/PositionTracker';
import { ContextWithEntityManager, ProtocolStateUniswapV3 } from '../utils/interfaces/univ3Types';
import { getOptimizedTokenPrices } from '../utils/pricing';
type EventData = SwapData & { type: 'Swap' };

export async function processPairs(
  ctx: ContextWithEntityManager,
  block: BlockData,
  positionTracker: PositionTracker,
  positionStorageService: PositionStorageService,
  protocolStates: Map<string, ProtocolStateUniswapV3>,
  coingeckoApiKey: string,
): Promise<void> {
  let eventsData = await processItems(ctx, block);
  console.log('Swap_event_data_for_current_block', eventsData.length);
  if (!eventsData || eventsData.length == 0) return;

  for (let data of eventsData) {
    if (data.type === 'Swap') {
      await processSwapData(
        ctx,
        block.header,
        data,
        positionTracker,
        positionStorageService,
        protocolStates,
        coingeckoApiKey,
      );
    }
    // if (data.type === 'Initialize') {
    //   await processInitializeData(ctx, block, data, positionStorageService);
    // }
  }
}

//todo: research
// await Promise.all([
//   updatePoolFeeVars({ ...ctx, block: last(blocks).header }, ctx.entities.values(Pool)),
//   updateTickFeeVars({ ...ctx, block: last(blocks).header }, ctx.entities.values(Tick)),
// ]);

async function processItems(ctx: ContextWithEntityManager, block: BlockData) {
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
    if (log.topics[0] === poolAbi.events.Swap.topic) {
      let data = processSwap(evmLog, log.transaction);
      eventsData.push({
        type: 'Swap',
        ...data,
      });
    }
  }
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
): Promise<void> {
  const positions = await positionStorageService.getAllPositionsByPoolId(data.poolId);
  if (positions.length === 0) return;

  const positionForReference = positions[0];

  const token0 = await positionStorageService.getToken(positionForReference.token0Id);
  const token1 = await positionStorageService.getToken(positionForReference.token1Id);

  if (!token0 || !token1) {
    console.warn(
      `Skipping swap for pool ${data.poolId} - missing token data: token0=${!!token0}, token1=${!!token1}, token0Id=${positionForReference.token0Id}, token1Id=${positionForReference.token1Id}`,
    );
    return;
  }

  const amount0 = BigDecimal(data.amount0, token0.decimals).toNumber();
  const amount1 = BigDecimal(data.amount1, token1.decimals).toNumber();

  // need absolute amounts for volume
  const amount0Abs = Math.abs(amount0);
  const amount1Abs = Math.abs(amount1);

  // Use optimized pricing strategy - returns USD prices directly
  const [token0inUSD, token1inUSD] = await getOptimizedTokenPrices(
    data.poolId,
    token0,
    token1,
    block,
    coingeckoApiKey,
    { ...ctx, block },
  );

  // Direct USD calculation - no need to convert through ETH
  const swappedAmountUSD = amount0Abs * token0inUSD + amount1Abs * token1inUSD;

  const transactionSchema = {
    eventType: MessageType.TRANSACTION,
    eventName: 'Swap',
    // tokens: {
    //   gasFee: {
    //     value: gasFee.toString(),
    //     type: 'string',
    //   },
    //   ethPriceUsd: {
    //     value: ethPriceUsd.toString(),
    //     type: 'string',
    //   },
    // },
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
      token1Decimals: {
        value: token1!.decimals.toString(),
        type: 'number',
      },
      token1Address: {
        value: token1!.id,
        type: 'string',
      },
      token1Symbol: {
        value: token1!.symbol,
        type: 'string',
      },
      token1PriceUsd: {
        value: token1inUSD.toString(),
        type: 'number',
      },
    },
    rawAmount: (amount0Abs + amount1Abs).toString(),
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

  const protocolState = protocolStates.get(data.poolId);
  if (protocolState) {
    protocolState.transactions.push(transactionSchema);
  } else {
    protocolStates.set(data.poolId, {
      balanceWindows: [],
      transactions: [transactionSchema],
    });
  }
  await positionTracker.handleSwap(block, data, positions);
}
// interface InitializeData {
//   poolId: string;
//   tick: number;
//   sqrtPrice: bigint;
// }

// function processInitialize(log: EvmLog): InitializeData {
//   let { tick, sqrtPriceX96 } = poolAbi.events.Initialize.decode(log);
//   return {
//     poolId: log.address,
//     tick: tick,
//     sqrtPrice: sqrtPriceX96,
//   };
// }

function processSwap(log: EvmLog, transaction: any): SwapData {
  let event = poolAbi.events.Swap.decode(log);
  return {
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
}

//todo: read this
// export async function handleFlash(ctx: LogHandlerContext<Store>): Promise<void> {
//   // update fee growth
//   let pool = await ctx.store.get(Pool, ctx.evmLog.address).then(assertNotNull);
//   let poolContract = new poolAbi.Contract(ctx, ctx.evmLog.address);
//   let feeGrowthGlobal0X128 = await poolContract.feeGrowthGlobal0X128();
//   let feeGrowthGlobal1X128 = await poolContract.feeGrowthGlobal1X128();
//   pool.feeGrowthGlobal0X128 = feeGrowthGlobal0X128;
//   pool.feeGrowthGlobal1X128 = feeGrowthGlobal1X128;
//   await ctx.store.save(pool);
// }

//todo: read this
// async function updateTickFeeVars(ctx: BlockHandlerContext<Store>, ticks: Tick[]): Promise<void> {
//   // not all ticks are initialized so obtaining null is expected behavior
//   let multicall = new Multicall(ctx, MULTICALL_ADDRESS);

//   const tickResult = await multicall.aggregate(
//     poolAbi.functions.ticks,
//     ticks.map<[string, { tick: bigint }]>((t) => {
//       return [
//         t.poolId,
//         {
//           tick: t.tickIdx,
//         },
//       ];
//     }),
//     MULTICALL_PAGE_SIZE,
//   );

//   for (let i = 0; i < ticks.length; i++) {
//     ticks[i].feeGrowthOutside0X128 = tickResult[i].feeGrowthOutside0X128;
//     ticks[i].feeGrowthOutside1X128 = tickResult[i].feeGrowthOutside1X128;
//   }
// }

// //todo: read this
// async function updatePoolFeeVars(ctx: BlockHandlerContext<Store>, pools: Pool[]): Promise<void> {
//   let multicall = new Multicall(ctx, MULTICALL_ADDRESS);

//   const calls: [string, {}][] = pools.map((p) => {
//     return [p.id, {}];
//   });
//   let fee0 = await multicall.aggregate(
//     poolAbi.functions.feeGrowthGlobal0X128,
//     calls,
//     MULTICALL_PAGE_SIZE,
//   );
//   let fee1 = await multicall.aggregate(
//     poolAbi.functions.feeGrowthGlobal1X128,
//     calls,
//     MULTICALL_PAGE_SIZE,
//   );

//   for (let i = 0; i < pools.length; i++) {
//     pools[i].feeGrowthGlobal0X128 = fee0[i];
//     pools[i].feeGrowthGlobal1X128 = fee1[i];
//   }
// }
