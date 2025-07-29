import {
  AbsintheApiClient,
  ActiveBalance,
  BatchContext,
  Chain,
  Currency,
  processValueChangeBalances,
  TimeWeightedBalanceEvent,
  TimeWindowTrigger,
  ValidatedEnvBase,
  ValidatedStakingProtocolConfig,
  ZERO_ADDRESS,
} from '@absinthe/common';

import { processor } from './processor';
import { createHash } from 'crypto';
import { TypeormDatabase } from '@subsquid/typeorm-store';
import { loadActiveBalancesFromDb, loadPoolProcessStateFromDb } from './utils/pool';
import { ProtocolStateHemi } from './utils/types';
import * as vusdAbi from './abi/vusd';
import { fetchHistoricalUsd } from '@absinthe/common';
import { mapToJson, toTimeWeightedBalance, pricePosition } from '@absinthe/common';
import { ActiveBalances, PoolProcessState } from './model/index';
import { checkToken, flattenNestedMap } from './utils/helper';

export class VUSDBridgeProcessor {
  private readonly stakingProtocol: ValidatedStakingProtocolConfig;
  private readonly schemaName: string;
  private readonly refreshWindow: number;
  private readonly apiClient: AbsintheApiClient;
  private readonly chainConfig: Chain;
  private readonly env: ValidatedEnvBase;

  constructor(
    stakingProtocol: ValidatedStakingProtocolConfig,
    refreshWindow: number,
    apiClient: AbsintheApiClient,
    env: ValidatedEnvBase,
    chainConfig: Chain,
  ) {
    this.stakingProtocol = stakingProtocol;
    this.refreshWindow = refreshWindow;
    this.apiClient = apiClient;
    this.env = env;
    this.chainConfig = chainConfig;
    this.schemaName = this.generateSchemaName();
  }

  private generateSchemaName(): string {
    const uniquePoolCombination = this.stakingProtocol.contractAddress.concat(
      this.chainConfig.networkId.toString(),
    );

    const hash = createHash('md5').update(uniquePoolCombination).digest('hex').slice(0, 8);
    return `vusd-bridge-${hash}`;
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

  private async initializeProtocolStates(ctx: any): Promise<Map<string, ProtocolStateHemi>> {
    const protocolStates = new Map<string, ProtocolStateHemi>();

    const contractAddress = this.stakingProtocol.contractAddress.toLowerCase();
    protocolStates.set(contractAddress, {
      activeBalances:
        (await loadActiveBalancesFromDb(ctx, contractAddress)) ||
        new Map<string, Map<string, ActiveBalance>>(),
      balanceWindows: [],
      transactions: [],
      processState:
        (await loadPoolProcessStateFromDb(ctx, contractAddress)) || new PoolProcessState({}),
    });

    return protocolStates;
  }

  private async processBlock(batchContext: BatchContext): Promise<void> {
    const { ctx, block, protocolStates } = batchContext;

    const contractAddress = this.stakingProtocol.contractAddress.toLowerCase();
    const protocolState = protocolStates.get(contractAddress.toLowerCase())!;
    await this.processLogsForProtocol(ctx, block, contractAddress, protocolState);
    await this.processPeriodicBalanceFlush(ctx, block, protocolState);
  }

  private async processLogsForProtocol(
    ctx: any,
    block: any,
    contractAddress: string,
    protocolState: ProtocolStateHemi,
  ): Promise<void> {
    const poolLogs = block.logs.filter((log: any) => {
      return log.address.toLowerCase() === contractAddress.toLowerCase();
    });

    for (const log of poolLogs) {
      await this.processLog(ctx, block, log, protocolState);
    }
  }

  private async processLog(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateHemi,
  ): Promise<void> {
    if (log.topics[0] === vusdAbi.events.ERC20BridgeFinalized.topic) {
      await this.processBridgeEvent(ctx, block, log, protocolState);
    }
  }

  private async processBridgeEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateHemi,
  ): Promise<void> {
    const { localToken, from, to, amount } = vusdAbi.events.ERC20BridgeFinalized.decode(log);
    console.log(log.transactionHash);
    const tokenMetadata = checkToken(localToken);
    if (!tokenMetadata) {
      console.warn(`Ignoring deposit for unsupported token: ${localToken}`);
      return;
    }
    const tokenPrice = await fetchHistoricalUsd(
      tokenMetadata.coingeckoId,
      block.header.timestamp,
      this.env.coingeckoApiKey,
    );
    const usdValue = pricePosition(tokenPrice, amount, tokenMetadata.decimals);

    const newHistoryWindows = processValueChangeBalances({
      from: from,
      to: ZERO_ADDRESS,
      amount: amount,
      usdValue,
      blockTimestamp: block.header.timestamp,
      blockHeight: block.header.height,
      txHash: log.transactionHash,
      activeBalances: protocolState.activeBalances,
      windowDurationMs: this.refreshWindow,
      tokenPrice,
      tokenDecimals: tokenMetadata.decimals,
      tokenAddress: localToken,
      tokens: {
        tokenDecimals: {
          value: `${tokenMetadata.decimals}`,
          type: 'string',
        },
        tokenCoinGeckoId: {
          value: `${tokenMetadata.coingeckoId}`,
          type: 'string',
        },
      },
    });

    protocolState.balanceWindows.push(...newHistoryWindows);
  }

  private async processPeriodicBalanceFlush(
    ctx: any,
    block: any,
    protocolState: ProtocolStateHemi,
  ): Promise<void> {
    const currentTs = block.header.timestamp;

    if (!protocolState.processState?.lastInterpolatedTs) {
      protocolState.processState.lastInterpolatedTs = BigInt(currentTs);
    }

    while (
      protocolState.processState.lastInterpolatedTs &&
      Number(protocolState.processState.lastInterpolatedTs) + this.refreshWindow < currentTs
    ) {
      const windowsSinceEpoch = Math.floor(
        Number(protocolState.processState.lastInterpolatedTs) / this.refreshWindow,
      );
      const nextBoundaryTs: number = (windowsSinceEpoch + 1) * this.refreshWindow;

      for (const [tokenAddress, userBalances] of protocolState.activeBalances.entries()) {
        for (const [userAddress, data] of userBalances.entries()) {
          const oldStart = data.updatedBlockTs;
          if (data.balance > 0n && oldStart < nextBoundaryTs) {
            const tokenMetadata = checkToken(tokenAddress);
            if (!tokenMetadata) {
              console.warn(`Ignoring withdraw for unsupported token: ${tokenAddress}`);
              return;
            }
            const tokenPrice = await fetchHistoricalUsd(
              tokenMetadata.coingeckoId,
              currentTs,
              this.env.coingeckoApiKey,
            );
            const balanceUsd = pricePosition(tokenPrice, data.balance, tokenMetadata.decimals);
            protocolState.balanceWindows.push({
              userAddress: userAddress,
              deltaAmount: 0,
              trigger: TimeWindowTrigger.EXHAUSTED,
              startTs: oldStart,
              endTs: nextBoundaryTs,
              windowDurationMs: this.refreshWindow,
              startBlockNumber: data.updatedBlockHeight,
              endBlockNumber: block.header.height,
              tokenPrice: tokenPrice,
              tokenDecimals: tokenMetadata.decimals,
              balanceBefore: data.balance.toString(),
              balanceAfter: data.balance.toString(),
              txHash: null,
              currency: Currency.USD,
              valueUsd: balanceUsd,
              tokens: {
                tokenDecimals: {
                  value: `${tokenMetadata.decimals}`,
                  type: 'string',
                },
                tokenCoinGeckoId: {
                  value: `${tokenMetadata.coingeckoId}`,
                  type: 'string',
                },
              },
            });

            protocolState.activeBalances.get(tokenAddress)!.set(userAddress, {
              balance: data.balance,
              updatedBlockTs: nextBoundaryTs,
              updatedBlockHeight: block.header.height,
            });
          }
        }
        protocolState.processState.lastInterpolatedTs = BigInt(nextBoundaryTs);
      }
    }
  }

  private async finalizeBatch(
    ctx: any,
    protocolStates: Map<string, ProtocolStateHemi>,
  ): Promise<void> {
    const contractAddress = this.stakingProtocol.contractAddress.toLowerCase();
    const protocolState = protocolStates.get(contractAddress);

    if (!protocolState) {
      console.error(`Protocol state not found for contract: ${contractAddress}`);
      return;
    }

    // Send data to Absinthe API
    const balances = toTimeWeightedBalance(
      protocolState.balanceWindows,
      this.stakingProtocol,
      this.env,
      this.chainConfig,
    ).filter((e: TimeWeightedBalanceEvent) => e.startUnixTimestampMs !== e.endUnixTimestampMs);

    console.log(JSON.stringify(balances));
    await this.apiClient.send(balances);

    // Save to database
    await ctx.store.upsert(
      new PoolProcessState({
        id: `${this.stakingProtocol.contractAddress}-process-state`,
        lastInterpolatedTs: protocolState.processState.lastInterpolatedTs,
      }),
    );
    await ctx.store.upsert(
      new ActiveBalances({
        id: `${this.stakingProtocol.contractAddress}-active-balances`,
        activeBalancesMap: mapToJson(flattenNestedMap(protocolState.activeBalances)),
      }),
    );
  }
}
