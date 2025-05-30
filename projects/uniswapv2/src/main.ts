import { Store, TypeormDatabase } from '@subsquid/typeorm-store'
import { AbsintheApiClient, validateEnv, HOURS_TO_MS, Dex, UniswapV2Config } from '@absinthe/common';
import { processor } from './processor';
import * as univ2Abi from './abi/univ2';
import {
  ActiveBalance,
  SimpleTimeWeightedBalance,
  SimpleTransaction,
} from '@absinthe/common';
import { PoolConfig, PoolState, ActiveBalances, PoolProcessState } from './model';
import { loadPoolConfigFromDb, initPoolConfigIfNeeded, loadPoolStateFromDb, initPoolStateIfNeeded, loadPoolProcessStateFromDb, initPoolProcessStateIfNeeded, loadActiveBalancesFromDb } from './utils/pool';
import { computePricedSwapVolume, computeLpTokenPrice, pricePosition } from './utils/pricing';
import { toTimeWeightedBalance, toTransaction } from './utils/interfaceFormatter';
import { processValueChange } from './utils/valueChangeHandler';
import { createHash } from 'crypto';
import { mapToJson } from './utils/helper';

// Validate environment variables at the start
const env = validateEnv();

// Create Absinthe API client for sending data
const apiClient = new AbsintheApiClient({
  baseUrl: env.absintheApiUrl,
  apiKey: env.absintheApiKey,
  minTime: 0 // warn: remove this, it's temporary for testing
});

const WINDOW_DURATION_MS = env.balanceFlushIntervalHours * HOURS_TO_MS;

interface ProtocolState {
  config: PoolConfig;
  state: PoolState;
  processState: PoolProcessState;
  activeBalances: Map<string, ActiveBalance>;
  balanceWindows: SimpleTimeWeightedBalance[];
  transactions: SimpleTransaction[];
}

interface BatchContext {
  ctx: any;
  block: any;
  protocolStates: Map<string, ProtocolState>;
}

class UniswapV2Processor  {
  private readonly protocols: UniswapV2Config[];
  private readonly schemaName: string;

  constructor() {
    this.protocols = (env.protocols as UniswapV2Config[])
      .filter(protocol => protocol.type === Dex.UNISWAP_V2);
    
    this.schemaName = this.generateSchemaName();
  }

  private generateSchemaName(): string {
    const uniquePoolCombination = this.protocols
      .reduce((acc, protocol) => acc + protocol.contractAddress, '')
      .concat(env.chainId.toString());
    
    const hash = createHash('md5').update(uniquePoolCombination).digest('hex').slice(0, 8);
    return `univ2-${hash}`;
  }

  async run(): Promise<void> {
    processor.run(
      new TypeormDatabase({ supportHotBlocks: false, stateSchema: this.schemaName }), 
      async (ctx) => {
        try {
          await this.processBatch(ctx);
        } catch (error) {
          console.error('Error processing batch:', error);
          throw error;
        }
      }
    );
  }

  private async processBatch(ctx: any): Promise<void> {
    const protocolStates = await this.initializeProtocolStates(ctx);
    
    for (const block of ctx.blocks) {
      await this.processBlock({ ctx, block, protocolStates });
    }
    
    await this.finalizeBatch(ctx, protocolStates);
  }

  private async initializeProtocolStates(ctx: any): Promise<Map<string, ProtocolState>> {
    const protocolStates = new Map<string, ProtocolState>();

    for (const protocol of this.protocols) {
      const contractAddress = protocol.contractAddress;
      
      protocolStates.set(contractAddress, {
        config: await loadPoolConfigFromDb(ctx, contractAddress) || new PoolConfig({}),
        state: await loadPoolStateFromDb(ctx, contractAddress) || new PoolState({}),
        processState: await loadPoolProcessStateFromDb(ctx, contractAddress) || new PoolProcessState({}),
        activeBalances: await loadActiveBalancesFromDb(ctx, contractAddress) || new Map<string, ActiveBalance>(),
        balanceWindows: [],
        transactions: []
      });
    }

    return protocolStates;
  }


  private async processBlock(batchContext: BatchContext): Promise<void> {
    const { ctx, block, protocolStates } = batchContext;

    for (const protocol of this.protocols) {
      const contractAddress = protocol.contractAddress;
      const protocolState = protocolStates.get(contractAddress)!;

      await this.initializeProtocolForBlock(ctx, block, contractAddress, protocol, protocolState);
      await this.processLogsForProtocol(ctx, block, contractAddress, protocol, protocolState);
      await this.processPeriodicBalanceFlush(ctx, block, contractAddress, protocolState);
    }
  }

  private async initializeProtocolForBlock(
    ctx: any, 
    block: any, 
    contractAddress: string, 
    protocol: UniswapV2Config, 
    protocolState: ProtocolState
  ): Promise<void> {
    // Initialize config, state, and process state
    protocolState.config = await initPoolConfigIfNeeded(ctx, block, contractAddress, protocolState.config, protocol);
    protocolState.state = await initPoolStateIfNeeded(ctx, block, contractAddress, protocolState.state, protocolState.config);
    protocolState.processState = await initPoolProcessStateIfNeeded(ctx, block, contractAddress, protocolState.config, protocolState.processState);
  }

  private async processLogsForProtocol(
    ctx: any, 
    block: any, 
    contractAddress: string, 
    protocol: UniswapV2Config, 
    protocolState: ProtocolState
  ): Promise<void> {
    const poolLogs = block.logs.filter((log: any) => log.address === contractAddress);
    
    for (const log of poolLogs) {
      await this.processLog(ctx, block, log, protocol, protocolState);
    }
  }

  private async processLog(
    ctx: any,
    block: any,
    log: any,
    protocol: UniswapV2Config,
    protocolState: ProtocolState
  ): Promise<void> {
    if (log.topics[0] === univ2Abi.events.Swap.topic) {
      await this.processSwapEvent(ctx, block, log, protocol, protocolState);
    }

    if (log.topics[0] === univ2Abi.events.Sync.topic) {
      this.processSyncEvent(protocolState);
    }

    if (log.topics[0] === univ2Abi.events.Transfer.topic) {
      await this.processTransferEvent(ctx, block, log, protocol, protocolState);
    }
  }

  private async processSwapEvent(
    ctx: any,
    block: any,
    log: any,
    protocol: UniswapV2Config,
    protocolState: ProtocolState
  ): Promise<void> {
    const { sender, amount0In, amount0Out, amount1In, amount1Out } = univ2Abi.events.Swap.decode(log);
    const token0Amount = amount0In + amount0Out;
    const token1Amount = amount1In + amount1Out;
    
    const pricedSwapVolume = protocol.preferredTokenCoingeckoId === 'token0' ?
      await computePricedSwapVolume(token0Amount, protocolState.config.token0.coingeckoId as string, protocolState.config.token0.decimals, block.header.timestamp)
      : await computePricedSwapVolume(token1Amount, protocolState.config.token1.coingeckoId as string, protocolState.config.token1.decimals, block.header.timestamp);
    
    protocolState.transactions.push({
      user: sender,
      amount: pricedSwapVolume,
      timestampMs: block.header.timestamp,
      blockNumber: BigInt(block.header.height),
      txHash: log.transactionHash,
      logIndex: log.logIndex,
      protocolMetadata: {
        token0Amount,
        token1Amount
      }
    });
  }

  private processSyncEvent(protocolState: ProtocolState): void {
    // If we see a sync event, we need to update the pool state later since reserves and/or total supply have changed
    protocolState.state.isDirty = true;
  }

  private async processTransferEvent(
    ctx: any,
    block: any,
    log: any,
    protocol: UniswapV2Config,
    protocolState: ProtocolState
  ): Promise<void> {
    const { from, to, value } = univ2Abi.events.Transfer.decode(log);  
    const lpTokenPrice = await computeLpTokenPrice(ctx, block, protocolState.config, protocolState.state, block.header.timestamp);
    const usdValue = pricePosition(lpTokenPrice, value, protocolState.config.lpToken.decimals);
    
    const newHistoryWindows = processValueChange({
      assetAddress: protocol.contractAddress,
      from,
      to,
      amount: value,
      usdValue,
      blockTimestamp: block.header.timestamp,
      blockHeight: block.header.height,
      txHash: log.transactionHash,
      activeBalances: protocolState.activeBalances,
      windowDurationMs: WINDOW_DURATION_MS
    });
    
    protocolState.balanceWindows.push(...newHistoryWindows);
  }

  private async processPeriodicBalanceFlush(
    ctx: any,
    block: any,
    contractAddress: string,
    protocolState: ProtocolState
  ): Promise<void> {
    const currentTs = block.header.timestamp;
    const currentBlockHeight = block.header.height;
    
    if (!protocolState.processState?.lastInterpolatedTs) {
      protocolState.processState.lastInterpolatedTs = BigInt(currentTs);
    }
    
    while (Number(protocolState.processState.lastInterpolatedTs) + WINDOW_DURATION_MS < currentTs) {
      const windowsSinceEpoch = Math.floor(Number(protocolState.processState.lastInterpolatedTs) / WINDOW_DURATION_MS);
      const nextBoundaryTs: number = (windowsSinceEpoch + 1) * WINDOW_DURATION_MS;

      console.log("Processing periodic balance flush", windowsSinceEpoch, nextBoundaryTs);
      
      for (let [userAddress, data] of protocolState.activeBalances.entries()) {
        const oldStart = data.updated_at_block_ts;
        console.log("Processing user", userAddress, data.balance, oldStart, nextBoundaryTs);
        if (data.balance > 0 && oldStart < nextBoundaryTs) {
          console.log("Pushing to balance windows", userAddress, data.balance, oldStart, nextBoundaryTs);
          protocolState.balanceWindows.push({
            user: userAddress,
            amount: pricePosition(await computeLpTokenPrice(ctx, block, protocolState.config, protocolState.state, currentBlockHeight), data.balance, protocolState.config.lpToken.decimals),
            timeWindow: {
              trigger: 'exhausted' as const,
              startTs: oldStart,
              endTs: nextBoundaryTs,
              windowDurationMs: WINDOW_DURATION_MS,
              windowId: windowsSinceEpoch
            },
            protocolMetadata: {
              lpTokenAmount: data.balance
            }
          });
          
          protocolState.activeBalances.set(userAddress, {
            balance: data.balance,
            updated_at_block_ts: nextBoundaryTs,
            updated_at_block_height: block.header.height
          });
        }
      }
      protocolState.processState.lastInterpolatedTs = BigInt(nextBoundaryTs);
    }
  }

  private async finalizeBatch(ctx: any, protocolStates: Map<string, ProtocolState>): Promise<void> {
    for (const protocol of this.protocols) {
      const protocolState = protocolStates.get(protocol.contractAddress)!;
      
      // Send data to Absinthe API
      const balances = toTimeWeightedBalance(protocolState.balanceWindows, env, protocolState.config)
        .filter((e) => e.timeWindow.startTs !== e.timeWindow.endTs);
      const transactions = toTransaction(protocolState.transactions, env, protocolState.config);
      
      await apiClient.send(balances);
      await apiClient.send(transactions);

      // Save to database
      await ctx.store.upsert(protocolState.config.token0); //saves to Token table
      await ctx.store.upsert(protocolState.config.token1);
      await ctx.store.upsert(protocolState.config.lpToken);
      await ctx.store.upsert(protocolState.config);
      await ctx.store.upsert(protocolState.state);
      await ctx.store.upsert(protocolState.processState);
      await ctx.store.upsert(new ActiveBalances({
        id: `${protocol.contractAddress}-active-balances`,
        activeBalancesMap: mapToJson(protocolState.activeBalances)
      }));
    }
  }

  
}

const uniswapProcessor = new UniswapV2Processor();
uniswapProcessor.run();
    

// -------------------------------------------------------------------
// --------------------------PROCESSOR.RUN()--------------------------
// -------------------------------------------------------------------
// processor.run() executes data processing with a handler called on each data batch.
// Data is available via ctx.blocks; handler can also use external data sources.
// const uniquePoolCombinationName = (env.protocols as UniswapV2Config[])
//   .filter(protocol => protocol.type === Dex.UNISWAP_V2)
//   .reduce((acc, protocol) => acc + protocol.contractAddress, '')
//   .concat(env.chainId.toString());

// const schemaName = 'univ2-' + createHash('md5').update(uniquePoolCombinationName).digest('hex').slice(0, 8);
// processor.run(new TypeormDatabase({ supportHotBlocks: false, stateSchema: schemaName }), async (ctx) => {
//   // [INIT] start of batch state
//   // load poolState and poolConfig from db

//   const poolConfigs = new Map<string, PoolConfig>();
//   const poolStates = new Map<string, PoolState>();
//   const poolProcessStates = new Map<string, PoolProcessState>();
//   const activeBalancesMaps = new Map<string, Map<string, ActiveBalance>>();

//   // cleared on every run
//   const simpleBalanceHistoryWindows = new Map<string, SimpleTimeWeightedBalance[]>();
//   const simpleTransactions = new Map<string, SimpleTransaction[]>();

//   for (const protocol of env.protocols as UniswapV2Config[]) {
//     const ca = protocol.contractAddress;
//     poolConfigs.set(ca, await loadPoolConfigFromDb(ctx, ca) || new PoolConfig({}));
//     poolStates.set(ca, await loadPoolStateFromDb(ctx, ca) || new PoolState({}));
//     poolProcessStates.set(ca, await loadPoolProcessStateFromDb(ctx, ca) || new PoolProcessState({}));
//     activeBalancesMaps.set(ca, await loadActiveBalancesFromDb(ctx, ca) || new Map<string, ActiveBalance>());

//     simpleBalanceHistoryWindows.set(ca, []);
//     simpleTransactions.set(ca, []);
//   }


//   // [MAIN] batch loop
//   // We'll make db and network operations at the end of the batch saving massively on IO
//   for (let block of ctx.blocks) {
//     for (const protocol of env.protocols as UniswapV2Config[]) {
//       const contractAddress = protocol.contractAddress;


//       // Use let so we can reassign after each init call
//       let poolCfg = poolConfigs.get(contractAddress)!;
//       let poolState = poolStates.get(contractAddress)!;
//       let poolProcessState = poolProcessStates.get(contractAddress)!;
//       let activeBalancesMap = activeBalancesMaps.get(contractAddress)!;

//       // reads immutable data from the contract
//       // 1. Init/override config, then store back into map
//       poolCfg = await initPoolConfigIfNeeded(ctx, block, contractAddress, poolCfg, protocol as UniswapV2Config);
//       poolConfigs.set(contractAddress, poolCfg);

//       // 2. Init state with updated config
//       poolState = await initPoolStateIfNeeded(ctx, block, contractAddress, poolState, poolCfg);
//       poolStates.set(contractAddress, poolState);

//       // 3. Init process state with updated config
//       poolProcessState = await initPoolProcessStateIfNeeded(ctx, block, contractAddress, poolCfg, poolProcessState);
//       poolProcessStates.set(contractAddress, poolProcessState);

//       // l.address == contractAddress (lowercase)
//       const poolLogs = block.logs.filter(l => l.address === contractAddress);
//       //todo: remove this
//       console.log("In the block ", block.header.height, " there are ", poolLogs.length, " logs", "for the contract ", contractAddress)
//       for (let log of poolLogs) {
//         // Swaps (volume)
//         if (log.topics[0] === univ2Abi.events.Swap.topic) {
//           const { sender, amount0In, amount0Out, amount1In, amount1Out } = univ2Abi.events.Swap.decode(log);
//           const token0Amount = amount0In + amount0Out;
//           const token1Amount = amount1In + amount1Out;
//           const pricedSwapVolume = protocol.preferredTokenCoingeckoId === 'token0' ?
//             await computePricedSwapVolume(token0Amount, poolCfg.token0.coingeckoId as string, poolCfg.token0.decimals, block.header.timestamp)
//             : await computePricedSwapVolume(token1Amount, poolCfg.token1.coingeckoId as string, poolCfg.token1.decimals, block.header.timestamp);
//           simpleTransactions.get(contractAddress)!.push({
//             user: sender,
//             amount: pricedSwapVolume,
//             timestampMs: block.header.timestamp,
//             blockNumber: BigInt(block.header.height),
//             txHash: log.transactionHash,
//             logIndex: log.logIndex,
//             protocolMetadata: {
//               token0Amount,
//               token1Amount
//             }
//           })
//         }

//         // If we see a sync event, we need to update the pool state later since reserves and/or total supply have changed
//         if (log.topics[0] === univ2Abi.events.Sync.topic) {
//           poolState.isDirty = true;
//         }

//         // todo: add this assumption to the readme
//         // warn: transfers: assume that we will always index from the beginning of all events so we need pool state + pool config
//         // warn: swaps: we can index from anywhere so we only need the pool config (can handle that separately in the swap topic handler)
//         // Transfer Event
//         if (log.topics[0] === univ2Abi.events.Transfer.topic) {
//           // Case 1: Emit events on transfer
//           const { from, to, value } = univ2Abi.events.Transfer.decode(log);
//           console.log("Processing transfer event", univ2Abi.events.Transfer.decode(log))
//           const newHistoryWindows = processValueChange({
//             assetAddress: contractAddress,
//             from,
//             to,
//             amount: value,
//             usdValue: pricePosition(await computeLpTokenPrice(ctx, block, poolCfg, poolState, block.header.timestamp), value, poolCfg.lpToken.decimals),
//             blockTimestamp: block.header.timestamp,
//             blockHeight: block.header.height,
//             txHash: log.transactionHash, //todo: resolve -  currently not used for anything (we'll send this to kafka)
//             activeBalances: activeBalancesMap,
//             windowDurationMs: WINDOW_DURATION_MS
//           })
//           simpleBalanceHistoryWindows.get(contractAddress)!.push(...newHistoryWindows);
//         }
//       }

//       // for each block...
//       // Case 2: Interpolate balances based on block range and flush balances after the time period is exhausted
//       const currentTs = block.header.timestamp;
//       const currentBlockHeight = block.header.height;
//       // set the last interpolated timestamp to the current timestamp if it's not set
//       if (!poolProcessState?.lastInterpolatedTs) poolProcessState.lastInterpolatedTs = BigInt(currentTs);
//       while (Number(poolProcessState.lastInterpolatedTs) + WINDOW_DURATION_MS < currentTs) {
//         // Calculate how many complete windows have passed since epoch
//         const windowsSinceEpoch = Math.floor(Number(poolProcessState.lastInterpolatedTs) / WINDOW_DURATION_MS);
//         // Calculate the next window boundary by multiplying by window duration
//         const nextBoundaryTs: number = (windowsSinceEpoch + 1) * WINDOW_DURATION_MS;
//         // ... do periodic flush for each asset in the map ...
//         for (let [userAddress, data] of activeBalancesMap.entries()) {
//           const oldStart = data.updated_at_block_ts;
//           if (data.balance > 0 && oldStart < nextBoundaryTs) {
//             simpleBalanceHistoryWindows.get(contractAddress)!.push({
//               user: userAddress,
//               amount: pricePosition(await computeLpTokenPrice(ctx, block, poolCfg, poolState, currentBlockHeight), data.balance, poolCfg.lpToken.decimals),
//               timeWindow: {
//                 trigger: 'exhausted' as const,
//                 startTs: oldStart,
//                 endTs: nextBoundaryTs,
//                 windowDurationMs: WINDOW_DURATION_MS,
//                 windowId: windowsSinceEpoch // todo: ensure that this is correct
//               },
//               protocolMetadata: {
//                 lpTokenAmount: data.balance
//               }
//             })
//             activeBalancesMap.set(userAddress, {
//               balance: data.balance,
//               updated_at_block_ts: nextBoundaryTs,
//               updated_at_block_height: block.header.height
//             });
//           }
//         }
//         poolProcessState.lastInterpolatedTs = BigInt(nextBoundaryTs);
//       }
//     }
//   }

//   for (const protocol of env.protocols as UniswapV2Config[]) {
//     const sbhw = simpleBalanceHistoryWindows.get(protocol.contractAddress)!;
//     const st = simpleTransactions.get(protocol.contractAddress)!;
//     const poolCfg = poolConfigs.get(protocol.contractAddress)!;
//     const poolState = poolStates.get(protocol.contractAddress)!;
//     const poolProcessState = poolProcessStates.get(protocol.contractAddress)!;
//     const abm = activeBalancesMaps.get(protocol.contractAddress)!;
//     // Absinthe API
//     const balances = toTimeWeightedBalance(sbhw, env, poolCfg)
//       .filter((e) => e.timeWindow.startTs !== e.timeWindow.endTs);
//     const transactions = toTransaction(st, env, poolCfg);
//     await apiClient.send(balances);
//     await apiClient.send(transactions);

//     // [FINAL] save batch state
//     // Save active balances to database
//     await ctx.store.upsert(poolCfg.token0);
//     await ctx.store.upsert(poolCfg.token1);
//     await ctx.store.upsert(poolCfg.lpToken);
//     await ctx.store.upsert(poolCfg);
//     await ctx.store.upsert(poolState);
//     await ctx.store.upsert(poolProcessState!); //warn; why is it throwing errors? where could it have been undefined?
//     await ctx.store.upsert(new ActiveBalances({
//       id: `${protocol.contractAddress}-active-balances`,
//       activeBalancesMap: mapToJson(abm)
//     }));
//   }

// })
