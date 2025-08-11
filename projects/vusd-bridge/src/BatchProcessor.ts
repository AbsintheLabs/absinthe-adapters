import {
  AbsintheApiClient,
  ActiveBalance,
  BatchContext,
  Chain,
  Currency,
  TimeWeightedBalanceEvent,
  TimeWindowTrigger,
  ValidatedEnvBase,
  ValidatedStakingProtocolConfig,
  ZERO_ADDRESS,
  logger,
  processValueChange,
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
import { TOKEN_METADATA } from './utils/consts';

export class VUSDBridgeProcessor {
  private readonly stakingProtocol: ValidatedStakingProtocolConfig;
  private readonly schemaName: string;
  private readonly refreshWindow: number;
  private readonly apiClient: AbsintheApiClient;
  private readonly chainConfig: Chain;
  private readonly env: ValidatedEnvBase;
  private readonly contractAddress: string;

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
    this.contractAddress = stakingProtocol.contractAddress.toLowerCase();
  }

  private generateSchemaName(): string {
    const uniquePoolCombination = this.contractAddress.concat(
      this.chainConfig.networkId.toString(),
    );

    const hash = createHash('md5').update(uniquePoolCombination).digest('hex').slice(0, 8);
    const schemaName = `vusd-bridge-${hash}`;
    return schemaName;
  }

  async run(): Promise<void> {
    processor.run(
      new TypeormDatabase({ supportHotBlocks: false, stateSchema: this.schemaName }),
      async (ctx) => {
        try {
          await this.processBatch(ctx);
        } catch (error) {
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

    const activeBalances = await loadActiveBalancesFromDb(ctx, this.contractAddress);
    const processState = await loadPoolProcessStateFromDb(ctx, this.contractAddress);

    protocolStates.set(this.contractAddress, {
      activeBalances: activeBalances || new Map<string, ActiveBalance>(),
      balanceWindows: [],
      transactions: [],
      processState: processState || new PoolProcessState({}),
    });

    logger.info(`✅ [VUSDBridgeProcessor] Protocol states initialized successfully`);
    return protocolStates;
  }

  private async processBlock(batchContext: BatchContext): Promise<void> {
    const { ctx, block, protocolStates } = batchContext;

    const protocolState = protocolStates.get(this.contractAddress)!;

    await this.processLogsForProtocol(ctx, block, protocolState);

    await this.processPeriodicBalanceFlush(ctx, block, protocolState);
  }

  private async processLogsForProtocol(
    ctx: any,
    block: any,
    protocolState: ProtocolStateHemi,
  ): Promise<void> {
    const poolLogs = block.logs.filter((log: any) => {
      return log.address.toLowerCase() === this.contractAddress;
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
      logger.info(`🌉 [VUSDBridgeProcessor] Processing ERC20BridgeFinalized event`);
      await this.processBridgeEvent(ctx, block, log, protocolState);
    } else {
      logger.info(`ℹ️ [VUSDBridgeProcessor] Ignoring log with unknown topic: ${log.topics[0]}`);
    }
  }

  private async processBridgeEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateHemi,
  ): Promise<void> {
    const { localToken, from, to, amount } = vusdAbi.events.ERC20BridgeFinalized.decode(log);
    logger.info(
      `🌉 [VUSDBridgeProcessor] Bridge event: token=${localToken}, from=${from}, to=${to}, amount=${amount}`,
    );
    logger.info(`🌉 [VUSDBridgeProcessor] Transaction hash: ${log.transactionHash}`);

    const tokenMetadata = checkToken(localToken);
    if (!tokenMetadata) {
      logger.warn(`⚠️ [VUSDBridgeProcessor] Ignoring deposit for unsupported token: ${localToken}`);
      return;
    }

    logger.info(`💰 [VUSDBridgeProcessor] Fetching price for token: ${tokenMetadata.coingeckoId}`);
    const tokenPrice = await fetchHistoricalUsd(
      tokenMetadata.coingeckoId,
      block.header.timestamp,
      this.env.coingeckoApiKey,
    );
    const usdValue = pricePosition(tokenPrice, amount, tokenMetadata.decimals);

    logger.info(`💰 [VUSDBridgeProcessor] Token price: $${tokenPrice}, USD value: $${usdValue}`);

    logger.info(`📊 [VUSDBridgeProcessor] Processing value change balances...`);
    const newHistoryWindows = processValueChange({
      from: ZERO_ADDRESS,
      to: from, // just so that our logic works
      amount: amount,
      usdValue,
      blockTimestamp: block.header.timestamp,
      blockHeight: block.header.height,
      txHash: log.transactionHash,
      activeBalances: protocolState.activeBalances,
      windowDurationMs: this.refreshWindow,
      tokenPrice,
      tokenDecimals: tokenMetadata.decimals,
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

    logger.info(
      `📊 [VUSDBridgeProcessor] Generated ${JSON.stringify(newHistoryWindows)} new history windows`,
    );
    logger.info(
      `💰 [VUSDBridgeProcessor] Active Balances: ${JSON.stringify(protocolState.activeBalances)}`,
    );
    protocolState.balanceWindows.push(...newHistoryWindows);
  }

  private async processPeriodicBalanceFlush(
    ctx: any,
    block: any,
    protocolState: ProtocolStateHemi,
  ): Promise<void> {
    const currentTs = block.header.timestamp;
    logger.info(
      `⏰ [VUSDBridgeProcessor] Processing periodic balance flush at timestamp: ${currentTs}`,
    );

    if (!protocolState.processState?.lastInterpolatedTs) {
      logger.info(`⏰ [VUSDBridgeProcessor] Initializing lastInterpolatedTs to current timestamp`);
      protocolState.processState.lastInterpolatedTs = BigInt(currentTs);
    }

    let flushCount = 0;
    while (
      protocolState.processState.lastInterpolatedTs &&
      Number(protocolState.processState.lastInterpolatedTs) + this.refreshWindow < currentTs
    ) {
      const windowsSinceEpoch = Math.floor(
        Number(protocolState.processState.lastInterpolatedTs) / this.refreshWindow,
      );
      const nextBoundaryTs: number = (windowsSinceEpoch + 1) * this.refreshWindow;

      logger.info(`⏰ [VUSDBridgeProcessor] Processing window boundary: ${nextBoundaryTs}`);

      for (const [userAddress, data] of protocolState.activeBalances.entries()) {
        const oldStart = data.updatedBlockTs;
        if (data.balance > 0n && oldStart < nextBoundaryTs) {
          logger.info(
            `💰 [VUSDBridgeProcessor] Processing balance flush for user: ${userAddress}, balance: ${data.balance}`,
          );

          logger.info(
            `💰 [VUSDBridgeProcessor] Fetching price for token: ${TOKEN_METADATA[0].coingeckoId}`,
          );
          const tokenPrice = await fetchHistoricalUsd(
            TOKEN_METADATA[0].coingeckoId, // we only have 1 asset
            currentTs,
            this.env.coingeckoApiKey,
          );
          const balanceUsd = pricePosition(tokenPrice, data.balance, TOKEN_METADATA[0].decimals);

          logger.info(
            `💰 [VUSDBridgeProcessor] Token price: $${tokenPrice}, balance USD: $${balanceUsd}`,
          );

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
            tokenDecimals: TOKEN_METADATA[0].decimals,
            balanceBefore: data.balance.toString(),
            balanceAfter: data.balance.toString(),
            txHash: null,
            currency: Currency.USD,
            valueUsd: balanceUsd,
            tokens: {
              tokenDecimals: {
                value: `${TOKEN_METADATA[0].decimals}`,
                type: 'string',
              },
              tokenCoinGeckoId: {
                value: `${TOKEN_METADATA[0].coingeckoId}`,
                type: 'string',
              },
            },
          });

          protocolState.activeBalances.set(userAddress, {
            balance: data.balance,
            updatedBlockTs: nextBoundaryTs,
            updatedBlockHeight: block.header.height,
          });

          flushCount++;
        }
      }
      protocolState.processState.lastInterpolatedTs = BigInt(nextBoundaryTs);
    }

    if (flushCount > 0) {
      logger.info(`⏰ [VUSDBridgeProcessor] Flushed ${flushCount} balance windows`);
    } else {
      logger.info(`⏰ [VUSDBridgeProcessor] No balance windows to flush`);
    }
  }

  private async finalizeBatch(
    ctx: any,
    protocolStates: Map<string, ProtocolStateHemi>,
  ): Promise<void> {
    const protocolState = protocolStates.get(this.contractAddress);

    if (!protocolState) {
      return;
    }

    const balances = toTimeWeightedBalance(
      protocolState.balanceWindows,
      this.stakingProtocol,
      this.env,
      this.chainConfig,
    );

    await this.apiClient.send(balances);

    // Save to database
    await ctx.store.upsert(
      new PoolProcessState({
        id: `${this.contractAddress}-process-state`,
        lastInterpolatedTs: protocolState.processState.lastInterpolatedTs,
      }),
    );

    await ctx.store.upsert(
      new ActiveBalances({
        id: `${this.contractAddress}-active-balances`,
        activeBalancesMap: mapToJson(protocolState.activeBalances),
      }),
    );
  }
}
