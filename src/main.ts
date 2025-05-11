// imports
import { Store, TypeormDatabase } from '@subsquid/typeorm-store'
import { AbsintheApiClient } from './services/apiClient';
import { processor, ProcessorContext } from './processor';
import * as univ2Abi from './abi/univ2';
import { processValueChange } from './utils/valueChangeHandler';
import { TimeWeightedBalance, UniswapV2TWBMetadata, TimeWindow, Transaction, UniswapV2SwapMetadata } from './interfaces';
import Big from 'big.js';
import { PoolConfig, PoolState, ActiveBalances } from './model';
import { validateEnv } from './utils/validateEnv';
import { DataHandlerContext, BlockData } from '@subsquid/evm-processor';
import { loadPoolConfigFromDb, updatePoolStateFromOnChain, initPoolConfigIfNeeded, initPoolStateIfNeeded, loadPoolStateFromDb } from './utils/pool';
import { computePricedSwapVolume, getHourlyPrice, computeLpTokenPrice } from './services/pricing';
// Validate environment variables at the start
const env = validateEnv();

// Create API client for sending data
const apiClient = new AbsintheApiClient({
  baseUrl: env.absintheApiUrl,
  apiKey: env.absintheApiKey
});

let lastInterpolatedTs: number | null = null;
const WINDOW_DURATION_MS = 3600 * 1000 * env.balanceFlushIntervalHours;

// todo: these should be pulled from the db state on each batch run
export type ActiveBalance = {
  balance: bigint,
  updated_at_block_ts: number,
  updated_at_block_height: number
}

export type HistoryWindow = {
  userAddress: string,
  assetAddress: string,
  balance: bigint,
  usdValue: number,
  ts_start: number,
  ts_end: number,
  block_start?: number,
  block_end?: number,
  trigger: 'transfer' | 'exhausted',
  txHash?: string
}
// let activeBalancesMap = new Map<string, ActiveBalance>();
const balanceHistoryWindows: HistoryWindow[] = [];
// NOTE: we should use the TimeWeightedBalance interface instead. but for now, we can skip while we do pricing...
// const balanceHistoryWindows: TimeWeightedBalance[] = [];

// Helper functions to convert between Map and JSON for storage
function mapToJson(map: Map<string, ActiveBalance>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of map.entries()) {
    result[key] = {
      balance: value.balance.toString(),
      updated_at_block_ts: value.updated_at_block_ts,
      updated_at_block_height: value.updated_at_block_height
    };
  }
  return result;
}

function jsonToMap(json: Record<string, any>): Map<string, ActiveBalance> {
  const result = new Map<string, ActiveBalance>();
  if (!json) return result;

  for (const [key, value] of Object.entries(json)) {
    if (key === '__metadata') continue;
    result.set(key, {
      balance: BigInt(value.balance),
      updated_at_block_ts: value.updated_at_block_ts,
      updated_at_block_height: value.updated_at_block_height
    });
  }
  return result;
}


// -------------------------------------------------------------------
// -------------------------------------------------------------------
// --------------------------PROCESSOR.RUN()--------------------------
// -------------------------------------------------------------------
// -------------------------------------------------------------------
// processor.run() executes data processing with a handler called on each data batch.
// Data is available via ctx.blocks; handler can also use external data sources.

async function loadActiveBalancesFromDb(ctx: DataHandlerContext<Store>, contractAddress: string): Promise<Map<string, ActiveBalance>> {
  const activeBalancesMap = new Map<string, ActiveBalance>();
  const activeBalancesEntity = await ctx.store.findOne(ActiveBalances, {
    where: { id: `${contractAddress}-active-balances` },
  });
  return activeBalancesEntity ? jsonToMap(activeBalancesEntity.activeBalancesMap as Record<string, ActiveBalance>) : new Map<string, ActiveBalance>();
}

// incorrect timing of flushes (store gets put onto a queue. if we need it immediately, we should keep state in memory)
// new algo: 
// 1. per run, get the poolState and poolConfig from the db
// 2. if we need to update either, then do it in the memory (keep memory state of this)
// 3. at the end of the batch, upsert the new poolState and poolConfig into the db
processor.run(new TypeormDatabase({ supportHotBlocks: false }), async (ctx) => {
  // [INIT] batch state
  // load poolState and poolConfig from db
  let poolConfig = await loadPoolConfigFromDb(ctx, env.contractAddress) || new PoolConfig({});
  let poolState = await loadPoolStateFromDb(ctx, env.contractAddress) || new PoolState({});
  let activeBalancesMap = await loadActiveBalancesFromDb(ctx, env.contractAddress) || new Map<string, ActiveBalance>();

  let transactions: Transaction<UniswapV2SwapMetadata>[] = [];
  // user, usdValue, token0Amount, token1Amount, timestamp, blockHeight, txHash

  // [MAIN] batch loop
  // We'll make db and network operations at the end of the batch saving massively on IO
  for (let block of ctx.blocks) {
    poolConfig = await initPoolConfigIfNeeded(ctx, block, env.contractAddress, poolConfig);
    poolState = await initPoolStateIfNeeded(ctx, block, env.contractAddress, poolState, poolConfig);
    for (let log of block.logs) {
      // Swaps (volume)
      if (log.address === env.contractAddress && log.topics[0] === univ2Abi.events.Swap.topic) {
        const { amount0In, amount0Out, amount1In, amount1Out } = univ2Abi.events.Swap.decode(log);
        const token0Amount = amount0In + amount0Out;
        const token1Amount = amount1In + amount1Out;
        const pricedSwapVolume = env.preferredTokenCoingeckoId === 'token0' ?
          await computePricedSwapVolume(token0Amount, poolConfig.token0.coingeckoId!, poolConfig.token0.decimals, block.header.timestamp)
          : await computePricedSwapVolume(token1Amount, poolConfig.token1.coingeckoId!, poolConfig.token1.decimals, block.header.timestamp);
        const userAddress = log.transaction?.from.toLowerCase();
        // todo: get this sorted properly
        // transactions.push({
        //   user: userAddress!,
        //   value: pricedSwapVolume,
        //   token0Amount,
        //   token1Amount,
        //   timestamp: block.header.timestamp,
        //   blockHeight: block.header.height,
        //   txHash: log.transactionHash,
        //   source: {
        //     sourceId: `${env.contractAddress}-${block.header.height}`,
        //     chainId: 1,
        //     protocolName: 'uniswapv2',
        //     poolAddress: env.contractAddress,
        //     adapterVersion: '1.0.0',
        //   }
        // })
      }

      // If we see a sync event, we need to update the pool state later since reserves and/or total supply have changed
      if (log.address === env.contractAddress && log.topics[0] === univ2Abi.events.Sync.topic) {
        poolState.isDirty = true;
      }

      // warn: transfers: assume that we will always index from the beginning of all events so we need pool state + pool config
      // warn: swaps: we can index from anywhere so we only need the pool config (can handle that separately in the swap topic handler)
      // Transfer Event
      if (log.address === env.contractAddress && log.topics[0] === univ2Abi.events.Transfer.topic) {
        // Case 1: Emit events on transfer
        const { from, to, value } = univ2Abi.events.Transfer.decode(log);
        await processValueChange({
          assetAddress: env.contractAddress,
          from,
          to,
          amount: value,
          usdValue: await computeLpTokenPrice(ctx, block, poolConfig, poolState, block.header.timestamp),
          blockTimestamp: block.header.timestamp,
          blockHeight: block.header.height,
          txHash: log.transactionHash, // currently not used for anything
          activeBalances: activeBalancesMap,
          historyWindows: balanceHistoryWindows,
        })
      }
    }

    // for each block...
    // Case 2: Interpolate balances based on block range and flush balances after the time period is exhausted
    const currentTs = block.header.timestamp;
    const currentBlockHeight = block.header.height;
    // set the last interpolated timestamp to the current timestamp if it's not set
    if (!lastInterpolatedTs) lastInterpolatedTs = currentTs;
    while (lastInterpolatedTs + WINDOW_DURATION_MS < currentTs) {
      // Calculate how many complete windows have passed since epoch
      const windowsSinceEpoch = Math.floor(lastInterpolatedTs / WINDOW_DURATION_MS);
      // Calculate the next window boundary by multiplying by window duration
      const nextBoundaryTs: number = (windowsSinceEpoch + 1) * WINDOW_DURATION_MS;
      // ... do periodic flush for each asset in the map ...
      for (let [userAddress, data] of activeBalancesMap.entries()) {
        const oldStart = data.updated_at_block_ts;
        if (data.balance > 0 && oldStart < nextBoundaryTs) {
          balanceHistoryWindows.push({
            userAddress,
            assetAddress: env.contractAddress,
            balance: data.balance,
            usdValue: await computeLpTokenPrice(ctx, block, poolConfig, poolState, currentBlockHeight),
            ts_start: oldStart,
            ts_end: nextBoundaryTs,
            trigger: 'exhausted'
          });
          activeBalancesMap.set(userAddress, {
            balance: data.balance,
            updated_at_block_ts: nextBoundaryTs,
            updated_at_block_height: block.header.height
          });
        }
      }
      lastInterpolatedTs = nextBoundaryTs;
    }

    // Absinthe API
    // Write balance records to Balances table after each periodic flush
    // Prepare the data to fit the TimeWeightedBalance interface
    const balances: TimeWeightedBalance<UniswapV2TWBMetadata>[] = balanceHistoryWindows.map((e) => {
      const trigger = e.trigger === 'exhausted' ? 'exhausted' as const : 'transfer' as const;
      const windowId = Math.floor(e.ts_start / WINDOW_DURATION_MS);

      // Create appropriate timeWindow based on trigger type
      const baseTimeWindow = {
        startTs: e.ts_start,
        endTs: e.ts_end,
        windowDurationMs: WINDOW_DURATION_MS,
        windowId,
      };

      // Add block numbers for transfer triggers
      const timeWindow: TimeWindow = trigger === 'transfer'
        ? {
          ...baseTimeWindow,
          trigger,
          startBlocknumber: BigInt(e.block_start || 0),
          endBlocknumber: BigInt(e.block_end || 0),
          txHash: e.txHash || ''
        }
        : {
          startTs: e.ts_start,
          endTs: e.ts_end,
          windowDurationMs: WINDOW_DURATION_MS,
          windowId,
          trigger
        };

      return {
        version: 1 as const,
        dataType: 'time_weighted_balance' as const,
        user: e.userAddress,
        chain: { networkId: 1, name: 'mainnet', chainType: 'evm' as const },
        value: Number(e.usdValue),
        timeWindow,
        protocolMetadata: {
          poolAddress: env.contractAddress,
          lpTokenAmount: e.balance,
        },
      }
    }).filter((e) => e.timeWindow.startTs !== e.timeWindow.endTs);
    await apiClient.sendBalances(balances);
    // clear the balance history windows after sending
    balanceHistoryWindows.length = 0;
  }

  // [FINAL] save batch state
  // Save active balances to database
  await ctx.store.upsert(poolConfig.token0);
  await ctx.store.upsert(poolConfig.token1);
  await ctx.store.upsert(poolConfig.lpToken);
  await ctx.store.upsert(poolConfig);
  await ctx.store.upsert(poolState);
  await ctx.store.upsert(new ActiveBalances({
    id: `${env.contractAddress}-active-balances`,
    activeBalancesMap: mapToJson(activeBalancesMap)
  }));
})
