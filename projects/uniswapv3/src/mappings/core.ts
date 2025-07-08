import { BigDecimal } from '@subsquid/big-decimal';
import { EvmLog } from '@subsquid/evm-processor/lib/interfaces/evm';
import { BlockHeader, SwapData } from '../utils/interfaces/interfaces';
import { DataHandlerContext } from '@subsquid/evm-processor';

import { Store } from '@subsquid/typeorm-store';
import * as poolAbi from '../abi/pool';
import { BlockMap } from '../utils/blockMap';
import { EntityManager } from '../utils/entityManager';
import { BlockData } from '@subsquid/evm-processor/src/interfaces/data';
import {
  Currency,
  fetchHistoricalUsd,
  HistoryWindow,
  MessageType,
  Transaction,
} from '@absinthe/common';
import { PositionStorageService } from '../services/PositionStorageService';
import { PositionTracker } from '../services/PositionTracker';
type EventData = SwapData & { type: 'Swap' };

type ContextWithEntityManager = DataHandlerContext<Store> & {
  entities: EntityManager;
};

interface ProtocolStateUniswapV3 {
  balanceWindows: HistoryWindow[];
  transactions: Transaction[];
}

export async function processPairs(
  ctx: ContextWithEntityManager,
  blocks: BlockData[],
  positionTracker: PositionTracker,
  positionStorageService: PositionStorageService,
  protocolStates: Map<string, ProtocolStateUniswapV3>,
): Promise<void> {
  console.log('processPairs', blocks.length, blocks[0].header);
  let eventsData = await processItems(ctx, blocks);
  console.log(eventsData.size, 'eventsData');
  if (!eventsData || eventsData.size == 0) return;

  for (let [block, blockEventsData] of eventsData) {
    for (let data of blockEventsData) {
      if (data.type === 'Swap') {
        await processSwapData(
          ctx,
          block,
          data,
          positionTracker,
          positionStorageService,
          protocolStates,
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
}

async function processItems(ctx: ContextWithEntityManager, blocks: BlockData[]) {
  let eventsData = new BlockMap<EventData>();

  for (let block of blocks) {
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
        eventsData.push(block.header, {
          type: 'Swap',
          ...data,
        });
      }
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
): Promise<void> {
  const positions = await positionStorageService.getAllPositionsByPoolId(data.poolId);
  if (positions.length === 0) return;

  const positionForReference = positions[0];

  const token0 = await positionStorageService.getToken(positionForReference.token0Id);
  const token1 = await positionStorageService.getToken(positionForReference.token1Id);

  if (!token0 || !token1) {
    console.warn(
      `Skipping swap for pool ${data.poolId} - missing token data: token0=${!!token0}, token1=${!!token1}`,
    );
    return;
  }

  const amount0 = BigDecimal(data.amount0, token0.decimals).toNumber();
  const amount1 = BigDecimal(data.amount1, token1.decimals).toNumber();

  // need absolute amounts for volume
  const amount0Abs = Math.abs(amount0);
  const amount1Abs = Math.abs(amount1);

  // const amount0ETH = amount0Abs * token0.derivedETH;
  // const amount1ETH = amount1Abs * token1.derivedETH;

  // const amount0USD = amount0ETH * bundle.ethPriceUSD;
  // const amount1USD = amount1ETH * bundle.ethPriceUSD;

  //swap fees calculation
  // const amountTotalUSDTracked = getTrackedAmountUSD(token0.id, amount0USD, token1.id, amount1USD);
  // const amountTotalETHTracked = safeDiv(amountTotalUSDTracked, bundle.ethPriceUSD);
  // const feesETH = (Number(amountTotalETHTracked) * Number(pool.feeTier)) / 1000000;
  // const feesUSD = (Number(amountTotalUSDTracked) * Number(pool.feeTier)) / 1000000;

  // update USD pricing
  const token0inETH = await fetchHistoricalUsd(
    token0.id, //todo: should be coingecko id
    block.timestamp,
    process.env.COINGECKO_API_KEY || '',
  );
  const token1inETH = await fetchHistoricalUsd(
    token1.id, //todo: should be coingecko id
    block.timestamp,
    process.env.COINGECKO_API_KEY || '',
  );

  const ethPriceUSD = await positionStorageService.getEthUsdPrice();
  const swappedAmountETH = amount0Abs * token0inETH + amount1Abs * token1inETH;
  const swappedAmountUSD = swappedAmountETH * ethPriceUSD;

  const transactionSchema = {
    eventType: MessageType.TRANSACTION,
    eventName: 'Swap',
    tokens: JSON.stringify([
      {
        token0Decimals: token0!.decimals,
        token0Address: token0!.id,
        token0Symbol: token0!.symbol,
        token0PriceUsd: token0inETH,
        token0Amount: amount0.toString(),
        token1Decimals: token1!.decimals,
        token1Address: token1!.id,
        token1Symbol: token1!.symbol,
        token1PriceUsd: token1inETH,
      },
    ]),
    rawAmount: swappedAmountETH.toString(), //todo: decimal adjusted
    displayAmount: swappedAmountETH,
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
