import { ActiveBalances } from './model';

import {
  AbsintheApiClient,
  ActiveBalance,
  ChainId,
  ChainShortName,
  Staking,
  MessageType,
  TimeWeightedBalanceEvent,
  TimeWindowTrigger,
} from '@absinthe/common';

import { HemiStakingConfig, ValidatedEnv } from '@absinthe/common';
import { processor } from './processor';
import { createHash } from 'crypto';
import { TypeormDatabase } from '@subsquid/typeorm-store';
import { PoolProcessState } from './model';
import { PoolState } from './model';
import {
  initPoolConfigIfNeeded,
  initPoolProcessStateIfNeeded,
  initPoolStateIfNeeded,
  loadActiveBalancesFromDb,
} from './utils/pool';
import { loadPoolProcessStateFromDb, loadPoolStateFromDb } from './utils/pool';
import { loadPoolConfigFromDb } from './utils/pool';
import { BatchContext, ProtocolState } from './utils/types';
import { PoolConfig } from './model';
import * as hemiAbi from './abi/launchPool';
import { pricePosition } from './utils/pricing';
import {
  mapToJson,
  processValueChange,
  toTimeWeightedBalance,
  toTransaction,
} from './utils/helper';

export class HemiStakingProcessor {
  private readonly protocols: HemiStakingConfig[];
  private readonly schemaName: string;
  private readonly refreshWindow: number;
  private readonly apiClient: AbsintheApiClient;

  constructor(env: ValidatedEnv, refreshWindow: number, apiClient: AbsintheApiClient) {
    this.protocols = (env.stakingProtocols as HemiStakingConfig[]).filter(
      (protocol) => protocol.type === Staking.HEMI,
    );

    this.schemaName = this.generateSchemaName();
    this.refreshWindow = refreshWindow;
    this.apiClient = apiClient;
  }

  private generateSchemaName(): string {
    const uniquePoolCombination = this.protocols
      .reduce((acc, protocol) => acc + protocol.contractAddress, '')
      .concat(ChainId.MAINNET.toString());

    const hash = createHash('md5').update(uniquePoolCombination).digest('hex').slice(0, 8);
    return `hemi-staking-${hash}`;
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
      },
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
        config: (await loadPoolConfigFromDb(ctx, contractAddress)) || new PoolConfig({}),
        state: (await loadPoolStateFromDb(ctx, contractAddress)) || new PoolState({}),
        processState:
          (await loadPoolProcessStateFromDb(ctx, contractAddress)) || new PoolProcessState({}),
        activeBalances:
          (await loadActiveBalancesFromDb(ctx, contractAddress)) ||
          new Map<string, ActiveBalance>(),
        balanceWindows: [],
        transactions: [],
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
    protocol: HemiStakingConfig,
    protocolState: ProtocolState,
  ): Promise<void> {
    // Initialize config, state, and process state
    protocolState.config = await initPoolConfigIfNeeded(
      ctx,
      block,
      contractAddress,
      protocolState.config,
      protocol,
    );
    protocolState.state = await initPoolStateIfNeeded(
      ctx,
      block,
      contractAddress,
      protocolState.state,
      protocolState.config,
    );
    protocolState.processState = await initPoolProcessStateIfNeeded(
      ctx,
      block,
      contractAddress,
      protocolState.config,
      protocolState.processState,
    );
  }

  private async processLogsForProtocol(
    ctx: any,
    block: any,
    contractAddress: string,
    protocol: HemiStakingConfig,
    protocolState: ProtocolState,
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
    protocol: HemiStakingConfig,
    protocolState: ProtocolState,
  ): Promise<void> {
    if (log.topics[0] === hemiAbi.events.Deposit.topic) {
      await this.processDepositEvent(ctx, block, log, protocol, protocolState);
    }

    if (log.topics[0] === hemiAbi.events.Withdraw.topic) {
      await this.processWithdrawEvent(ctx, block, log, protocol, protocolState);
    }
  }

  private async processDepositEvent(
    ctx: any,
    block: any,
    log: any,
    protocol: HemiStakingConfig,
    protocolState: ProtocolState,
  ): Promise<void> {
    // Decode the Deposit event
    const { depositor, token, amount } = hemiAbi.events.Deposit.decode(log);
    
    // Get token price and create transaction record
    // We'll simplify this compared to the swap function since it's a deposit
    const transactionSchema = {
      eventType: MessageType.TRANSACTION,
      tokens: JSON.stringify([
        {
          token: {
            // Use the token from the event
            address: token,
            // We'll need to get this information from the protocol config
            coingeckoId: protocolState.config.token.coingeckoId || '',
            decimals: protocolState.config.token.decimals,
            symbol: protocolState.config.token.symbol || '',
          },
          amount: amount.toString(),
          amountIn: amount.toString(),
          amountOut: '0', // No outgoing amount for a deposit
        },
      ]),
      rawAmount: amount.toString(),
      displayAmount: Number(amount) / 10 ** protocolState.config.token.decimals,
      unixTimestampMs: block.header.timestamp,
      txHash: log.transactionHash,
      logIndex: log.logIndex,
      blockNumber: block.header.height,
      blockHash: block.header.hash,
      userId: depositor,
    };

    protocolState.transactions.push(transactionSchema);
    
    // Update the user's active balance
    const userAddress = depositor;
    const currentBalance = protocolState.activeBalances.get(userAddress)?.balance || 0n;
    const newBalance = currentBalance + amount;
    
    protocolState.activeBalances.set(userAddress, {
      balance: newBalance,
      updatedBlockTs: block.header.timestamp,
      updatedBlockHeight: block.header.height,
    });
  }

  private async processWithdrawEvent(
    ctx: any,
    block: any,
    log: any,
    protocol: HemiStakingConfig,
    protocolState: ProtocolState,
  ): Promise<void> {
    // Decode the Withdraw event
    const { withdrawer, token, amount } = hemiAbi.events.Withdraw.decode(log);
    
    // Create transaction record for the withdrawal
    const transactionSchema = {
      eventType: MessageType.TRANSACTION,
      tokens: JSON.stringify([
        {
          token: {
            address: token,
            coingeckoId: protocolState.config.token.coingeckoId || '',
            decimals: protocolState.config.token.decimals,
            symbol: protocolState.config.token.symbol || '',
          },
          amount: amount.toString(),
          amountIn: '0', // No incoming amount for a withdrawal
          amountOut: amount.toString(), // The amount is being withdrawn
        },
      ]),
      rawAmount: amount.toString(),
      displayAmount: Number(amount) / 10 ** protocolState.config.token.decimals,
      unixTimestampMs: block.header.timestamp,
      txHash: log.transactionHash,
      logIndex: log.logIndex,
      blockNumber: block.header.height,
      blockHash: block.header.hash,
      userId: withdrawer,
    };

    protocolState.transactions.push(transactionSchema);
    
    // Update the user's active balance
    const userAddress = withdrawer;
    const currentBalance = protocolState.activeBalances.get(userAddress)?.balance || 0n;
    const newBalance = currentBalance >= amount ? currentBalance - amount : 0n;
    
    protocolState.activeBalances.set(userAddress, {
      balance: newBalance,
      updatedBlockTs: block.header.timestamp,
      updatedBlockHeight: block.header.height,
    });
  }

  private async processPeriodicBalanceFlush(
    ctx: any,
    block: any,
    contractAddress: string,
    protocolState: ProtocolState,
  ): Promise<void> {
    const currentTs = block.header.timestamp;
    const currentBlockHeight = block.header.height;

    if (!protocolState.processState?.lastInterpolatedTs) {
      protocolState.processState.lastInterpolatedTs = currentTs;
    }

    while (
      protocolState.processState.lastInterpolatedTs &&
      Number(protocolState.processState.lastInterpolatedTs) + this.refreshWindow < currentTs
    ) {
      const windowsSinceEpoch = Math.floor(
        Number(protocolState.processState.lastInterpolatedTs) / this.refreshWindow,
      );
      const nextBoundaryTs: number = (windowsSinceEpoch + 1) * this.refreshWindow;

      for (const [userAddress, data] of protocolState.activeBalances.entries()) {
        const oldStart = data.updatedBlockTs;
        if (data.balance > 0n && oldStart < nextBoundaryTs) {
          // Use getHourlyPrice instead of computeLpTokenPrice
          const tokenPrice = await this.apiClient.getHourlyPrice(
            protocolState.config.token.coingeckoId as string,
            nextBoundaryTs
          );
          
          // Calculate the USD value of the token balance
          const balanceUsd = pricePosition(
            tokenPrice,
            data.balance,
            protocolState.config.token.decimals,
          );
          
          // calculate the usd value of the token before and after the transfer
          protocolState.balanceWindows.push({
            userAddress: userAddress,
            deltaAmount: 0,
            trigger: TimeWindowTrigger.EXHAUSTED,
            startTs: oldStart,
            endTs: nextBoundaryTs,
            windowDurationMs: this.refreshWindow,
            startBlockNumber: data.updatedBlockHeight,
            endBlockNumber: block.header.height,
            balanceBeforeUsd: balanceUsd,
            balanceAfterUsd: balanceUsd,
            balanceBefore: data.balance.toString(),
            balanceAfter: data.balance.toString(),
            txHash: null,
          });

          protocolState.activeBalances.set(userAddress, {
            balance: data.balance,
            updatedBlockTs: nextBoundaryTs,
            updatedBlockHeight: block.header.height,
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
      const balances = toTimeWeightedBalance(protocolState.balanceWindows, protocol).filter(
        (e: TimeWeightedBalanceEvent) => e.startUnixTimestampMs !== e.endUnixTimestampMs,
      );
      const transactions = toTransaction(protocolState.transactions, protocol);
      await this.apiClient.send(balances);
      await this.apiClient.send(transactions);

      // Save to database
      await ctx.store.upsert(protocolState.config.token); //saves to Token table
      await ctx.store.upsert(protocolState.config);
      await ctx.store.upsert(protocolState.state);
      await ctx.store.upsert(protocolState.processState);
      await ctx.store.upsert(
        new ActiveBalances({
          id: `${protocol.contractAddress}-active-balances`,
          activeBalancesMap: mapToJson(protocolState.activeBalances),
        }),
      );
    }
  }
}
