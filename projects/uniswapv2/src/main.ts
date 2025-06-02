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


//todo: move to common
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

//todo: move to seperate file
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