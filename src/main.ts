// imports
import { Store, TypeormDatabase } from '@subsquid/typeorm-store'
import { AbsintheApiClient } from './services/apiClient';
import { processor } from './processor';
import * as univ2Abi from './abi/univ2';
import { processValueChange } from './utils/valueChangeHandler';
import {
  ActiveBalance,
  SimpleHistoryWindow,
  SimpleTransaction
} from './interfaces';
import { PoolConfig, PoolState, ActiveBalances } from './model';
import { validateEnv } from './utils/validateEnv';
import { DataHandlerContext } from '@subsquid/evm-processor';
import { loadPoolConfigFromDb, initPoolConfigIfNeeded, loadPoolStateFromDb, initPoolStateIfNeeded } from './utils/pool';
import { computePricedSwapVolume, computeLpTokenPrice } from './services/pricing';
import { toTimeWeightedBalance, toTransaction } from './utils/interfaceFormatter';

// Validate environment variables at the start
const env = validateEnv();

// Create Absinthe API client for sending data
const apiClient = new AbsintheApiClient({
  baseUrl: env.absintheApiUrl,
  apiKey: env.absintheApiKey
});

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

const WINDOW_DURATION_MS = 3600 * 1000 * env.balanceFlushIntervalHours;


// todo: move this into a separate function for readability sake
async function loadActiveBalancesFromDb(ctx: DataHandlerContext<Store>, contractAddress: string): Promise<Map<string, ActiveBalance>> {
  const activeBalancesEntity = await ctx.store.findOne(ActiveBalances, {
    where: { id: `${contractAddress}-active-balances` },
  });
  return activeBalancesEntity ? jsonToMap(activeBalancesEntity.activeBalancesMap as Record<string, ActiveBalance>) : new Map<string, ActiveBalance>();
}

// -------------------------------------------------------------------
// --------------------------PROCESSOR.RUN()--------------------------
// -------------------------------------------------------------------
// processor.run() executes data processing with a handler called on each data batch.
// Data is available via ctx.blocks; handler can also use external data sources.
processor.run(new TypeormDatabase({ supportHotBlocks: false }), async (ctx) => {
  // [INIT] start of batch state
  // load poolState and poolConfig from db
  let poolConfig = await loadPoolConfigFromDb(ctx, env.contractAddress) || new PoolConfig({});
  let poolState = await loadPoolStateFromDb(ctx, env.contractAddress) || new PoolState({});
  let activeBalancesMap = await loadActiveBalancesFromDb(ctx, env.contractAddress) || new Map<string, ActiveBalance>();
  const simpleBalanceHistoryWindows: SimpleHistoryWindow[] = [];
  const simpleTransactions: SimpleTransaction[] = [];

  // [MAIN] batch loop
  // We'll make db and network operations at the end of the batch saving massively on IO
  for (let block of ctx.blocks) {
    poolConfig = await initPoolConfigIfNeeded(ctx, block, env.contractAddress, poolConfig);
    poolState = await initPoolStateIfNeeded(ctx, block, env.contractAddress, poolState, poolConfig);
    for (let log of block.logs) {
      // Swaps (volume)
      if (log.address === env.contractAddress && log.topics[0] === univ2Abi.events.Swap.topic) {
        // todo: move this into a separate function for readability sake
        const { amount0In, amount0Out, amount1In, amount1Out } = univ2Abi.events.Swap.decode(log);
        const token0Amount = amount0In + amount0Out;
        const token1Amount = amount1In + amount1Out;
        const pricedSwapVolume = env.preferredTokenCoingeckoId === 'token0' ?
          await computePricedSwapVolume(token0Amount, poolConfig.token0.coingeckoId!, poolConfig.token0.decimals, block.header.timestamp)
          : await computePricedSwapVolume(token1Amount, poolConfig.token1.coingeckoId!, poolConfig.token1.decimals, block.header.timestamp);
        const userAddress = log.transaction?.from.toLowerCase();
        simpleTransactions.push({
          userAddress: userAddress!,
          assetAddress: env.contractAddress,
          usdValue: pricedSwapVolume,
          timestampMs: block.header.timestamp,
          blockNumber: BigInt(block.header.height),
          txHash: log.transactionHash,
          logIndex: log.logIndex,
          // todo: add metadata here too
        })
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
        const newHistoryWindows = await processValueChange({
          assetAddress: env.contractAddress,
          from,
          to,
          amount: value,
          usdValue: await computeLpTokenPrice(ctx, block, poolConfig, poolState, block.header.timestamp),
          blockTimestamp: block.header.timestamp,
          blockHeight: block.header.height,
          txHash: log.transactionHash, // currently not used for anything
          activeBalances: activeBalancesMap,
        })
        simpleBalanceHistoryWindows.push(...newHistoryWindows);
      }
    }

    // for each block...
    // Case 2: Interpolate balances based on block range and flush balances after the time period is exhausted
    const currentTs = block.header.timestamp;
    const currentBlockHeight = block.header.height;
    // set the last interpolated timestamp to the current timestamp if it's not set
    if (!poolState.lastInterpolatedTs) poolState.lastInterpolatedTs = currentTs;
    while (poolState.lastInterpolatedTs + WINDOW_DURATION_MS < currentTs) {
      // Calculate how many complete windows have passed since epoch
      const windowsSinceEpoch = Math.floor(poolState.lastInterpolatedTs / WINDOW_DURATION_MS);
      // Calculate the next window boundary by multiplying by window duration
      const nextBoundaryTs: number = (windowsSinceEpoch + 1) * WINDOW_DURATION_MS;
      // ... do periodic flush for each asset in the map ...
      for (let [userAddress, data] of activeBalancesMap.entries()) {
        const oldStart = data.updated_at_block_ts;
        if (data.balance > 0 && oldStart < nextBoundaryTs) {
          simpleBalanceHistoryWindows.push({
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
      poolState.lastInterpolatedTs = nextBoundaryTs;
    }
  }

  // Absinthe API
  const balances = toTimeWeightedBalance(simpleBalanceHistoryWindows, WINDOW_DURATION_MS, env.contractAddress)
    .filter((e) => e.timeWindow.startTs !== e.timeWindow.endTs);
  // const transactions = toTransaction(simpleTransactions);
  await apiClient.send(balances);
  // await apiClient.send(transactions);

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
