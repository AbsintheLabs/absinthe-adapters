// imports
import { Store, TypeormDatabase } from '@subsquid/typeorm-store'
import { AbsintheApiClient, validateEnv, Dex } from '@absinthe/common';
import { processor } from './processor';
import * as univ2Abi from './abi/univ2';
import {  
  ActiveBalance,
  SimpleTimeWeightedBalance,
  SimpleTransaction,
} from '@absinthe/common';
import { PoolConfig, PoolState, ActiveBalances, PoolProcessState } from './model';
import { DataHandlerContext } from '@subsquid/evm-processor';
import { loadPoolConfigFromDb, initPoolConfigIfNeeded, loadPoolStateFromDb, initPoolStateIfNeeded, loadPoolProcessStateFromDb, initPoolProcessStateIfNeeded, loadActiveBalancesFromDb } from './utils/pool';
import { computePricedSwapVolume, computeLpTokenPrice, pricePosition } from './utils/pricing';
import { toTimeWeightedBalance, toTransaction } from './utils/interfaceFormatter';
import { processValueChange } from './utils/valueChangeHandler';
import { createHash } from 'crypto';
import { mapToJson } from './utils/helper';
import { UniswapV2Config } from '@absinthe/common/src/types/protocols';

// Validate environment variables at the start
const env = validateEnv();

// Create Absinthe API client for sending data
const apiClient = new AbsintheApiClient({
  baseUrl: env.absintheApiUrl,
  apiKey: env.absintheApiKey,
  minTime: 0 // warn: remove this, it's temporary for testing
});

const WINDOW_DURATION_MS = env.balanceFlushIntervalHours * 60 * 60 * 1000;

// -------------------------------------------------------------------
// --------------------------PROCESSOR.RUN()--------------------------
// -------------------------------------------------------------------
// processor.run() executes data processing with a handler called on each data batch.
// Data is available via ctx.blocks; handler can also use external data sources.
const uniquePoolCombinationName = (env.protocols as UniswapV2Config[])
  .filter(protocol => protocol.type === Dex.UNISWAP_V2)
  .reduce((acc, protocol) => acc + protocol.contractAddress, '')
  .concat(env.chainId.toString());

const schemaName = 'univ2-' + createHash('md5').update(uniquePoolCombinationName).digest('hex').slice(0, 8);
processor.run(new TypeormDatabase({ supportHotBlocks: false, stateSchema: schemaName}), async (ctx) => {
  // [INIT] start of batch state
  // load poolState and poolConfig from db

  const poolConfigs = new Map<string, PoolConfig>();
  const poolStates = new Map<string, PoolState>();
  const poolProcessStates = new Map<string, PoolProcessState>();
  const activeBalancesMaps = new Map<string, Map<string, ActiveBalance>>();

  // cleared on every run
  const simpleBalanceHistoryWindows = new Map<string, SimpleTimeWeightedBalance[]>();
  const simpleTransactions = new Map<string, SimpleTransaction[]>();

  for (const protocol of env.protocols as UniswapV2Config[]) {
    const ca = protocol.contractAddress;
    poolConfigs.set(ca, await loadPoolConfigFromDb(ctx, ca) || new PoolConfig({}));
    poolStates.set(ca, await loadPoolStateFromDb(ctx, ca) || new PoolState({}));
    poolProcessStates.set(ca, await loadPoolProcessStateFromDb(ctx, ca) || new PoolProcessState({}));
    activeBalancesMaps.set(ca, await loadActiveBalancesFromDb(ctx, ca) || new Map<string, ActiveBalance>());

    simpleBalanceHistoryWindows.set(ca, []);
    simpleTransactions.set(ca, []);
  }


  // [MAIN] batch loop
  // We'll make db and network operations at the end of the batch saving massively on IO
  for (let block of ctx.blocks) {
    for (const protocol of env.protocols as UniswapV2Config[]) {
      const contractAddress = protocol.contractAddress;


      // Use let so we can reassign after each init call
      let poolCfg = poolConfigs.get(contractAddress)!;
      let poolState = poolStates.get(contractAddress)!;
      let poolProcessState = poolProcessStates.get(contractAddress)!;
      let activeBalancesMap = activeBalancesMaps.get(contractAddress)!;

      // 1. Init/override config, then store back into map
      poolCfg = await initPoolConfigIfNeeded(ctx, block, contractAddress, poolCfg, protocol as UniswapV2Config);
      poolConfigs.set(contractAddress, poolCfg);

      // 2. Init state with updated config
      poolState = await initPoolStateIfNeeded(ctx, block, contractAddress, poolState, poolCfg);
      poolStates.set(contractAddress, poolState);

      // 3. Init process state with updated config
      poolProcessState = await initPoolProcessStateIfNeeded(ctx, block, contractAddress, poolCfg, poolProcessState);
      poolProcessStates.set(contractAddress, poolProcessState);

      const poolLogs = block.logs.filter(l => l.address === contractAddress);
      for (let log of poolLogs) {
        // Swaps (volume)
        if (log.topics[0] === univ2Abi.events.Swap.topic) {
          // todo: move this into a separate function for readability sake
          const { amount0In, amount0Out, amount1In, amount1Out } = univ2Abi.events.Swap.decode(log);
          const token0Amount = amount0In + amount0Out;
          const token1Amount = amount1In + amount1Out;
          const pricedSwapVolume = protocol.preferredTokenCoingeckoId === 'token0' ?
            await computePricedSwapVolume(token0Amount, poolCfg.token0.coingeckoId as string, poolCfg.token0.decimals, block.header.timestamp)
            : await computePricedSwapVolume(token1Amount, poolCfg.token1.coingeckoId as string, poolCfg.token1.decimals, block.header.timestamp);
          const userAddress = log.transaction?.from.toLowerCase();
          simpleTransactions.get(contractAddress)!.push({
            user: userAddress!,
            amount: pricedSwapVolume,
            timestampMs: block.header.timestamp,
            blockNumber: BigInt(block.header.height),
            txHash: log.transactionHash,
            logIndex: log.logIndex,
            protocolMetadata: {
              token0Amount,
              token1Amount
            }
          })
        }

        // If we see a sync event, we need to update the pool state later since reserves and/or total supply have changed
        if (log.topics[0] === univ2Abi.events.Sync.topic) {
          poolState.isDirty = true;
        }

        // todo: add this assumption to the readme
        // warn: transfers: assume that we will always index from the beginning of all events so we need pool state + pool config
        // warn: swaps: we can index from anywhere so we only need the pool config (can handle that separately in the swap topic handler)
        // Transfer Event
        if (log.topics[0] === univ2Abi.events.Transfer.topic) {
          // Case 1: Emit events on transfer
          const { from, to, value } = univ2Abi.events.Transfer.decode(log);
          const newHistoryWindows = await processValueChange({
            assetAddress: protocol.contractAddress,
            from,
            to,
            amount: value,
            usdValue: pricePosition(await computeLpTokenPrice(ctx, block, poolCfg, poolState, block.header.timestamp), value, poolCfg.lpToken.decimals),
            blockTimestamp: block.header.timestamp,
            blockHeight: block.header.height,
            txHash: log.transactionHash, // currently not used for anything
            activeBalances: activeBalancesMap,
            windowDurationMs: WINDOW_DURATION_MS
          })
          simpleBalanceHistoryWindows.get(contractAddress)!.push(...newHistoryWindows);
        }
      }

      // for each block...
      // Case 2: Interpolate balances based on block range and flush balances after the time period is exhausted
      const currentTs = block.header.timestamp;
      const currentBlockHeight = block.header.height;
      // set the last interpolated timestamp to the current timestamp if it's not set
      if (!poolProcessState?.lastInterpolatedTs) poolProcessState.lastInterpolatedTs = BigInt(currentTs);
      while (Number(poolProcessState.lastInterpolatedTs) + WINDOW_DURATION_MS < currentTs) {
        // Calculate how many complete windows have passed since epoch
        const windowsSinceEpoch = Math.floor(Number(poolProcessState.lastInterpolatedTs) / WINDOW_DURATION_MS);
        // Calculate the next window boundary by multiplying by window duration
        const nextBoundaryTs: number = (windowsSinceEpoch + 1) * WINDOW_DURATION_MS;
        // ... do periodic flush for each asset in the map ...
        for (let [userAddress, data] of activeBalancesMap.entries()) {
          const oldStart = data.updated_at_block_ts;
          if (data.balance > 0 && oldStart < nextBoundaryTs) {
            simpleBalanceHistoryWindows.get(contractAddress)!.push({
              user: userAddress,
              amount: pricePosition(await computeLpTokenPrice(ctx, block, poolCfg, poolState, currentBlockHeight), data.balance, poolCfg.lpToken.decimals),
              timeWindow: {
                trigger: 'exhausted' as const,
                startTs: oldStart,
                endTs: nextBoundaryTs,
                windowDurationMs: WINDOW_DURATION_MS,
                windowId: windowsSinceEpoch // todo: ensure that this is correct
              },
              protocolMetadata: {
                lpTokenAmount: data.balance
              }
            })
            activeBalancesMap.set(userAddress, {
              balance: data.balance,
              updated_at_block_ts: nextBoundaryTs,
              updated_at_block_height: block.header.height
            });
          }
        }
        poolProcessState.lastInterpolatedTs = BigInt(nextBoundaryTs);
      }
    }
  }

  for (const protocol of env.protocols as UniswapV2Config[]) {
    const sbhw = simpleBalanceHistoryWindows.get(protocol.contractAddress)!;
    const st = simpleTransactions.get(protocol.contractAddress)!;
    const poolCfg = poolConfigs.get(protocol.contractAddress)!;
    const poolState = poolStates.get(protocol.contractAddress)!;
    const poolProcessState = poolProcessStates.get(protocol.contractAddress)!;
    const abm = activeBalancesMaps.get(protocol.contractAddress)!;
    // Absinthe API
    const balances = toTimeWeightedBalance(sbhw, env, poolCfg)
      .filter((e) => e.timeWindow.startTs !== e.timeWindow.endTs);
    const transactions = toTransaction(st, env, poolCfg);
    await apiClient.send(balances);
    await apiClient.send(transactions);

    // [FINAL] save batch state
    // Save active balances to database
    await ctx.store.upsert(poolCfg.token0);
    await ctx.store.upsert(poolCfg.token1);
    await ctx.store.upsert(poolCfg.lpToken);
    await ctx.store.upsert(poolCfg);
    await ctx.store.upsert(poolState);
    await ctx.store.upsert(poolProcessState!); //warn; why is it throwing errors? where could it have been undefined?
    await ctx.store.upsert(new ActiveBalances({
      id: `${env.protocols[0].contractAddress}-active-balances`,
      activeBalancesMap: mapToJson(abm)
    }));
  }

})
