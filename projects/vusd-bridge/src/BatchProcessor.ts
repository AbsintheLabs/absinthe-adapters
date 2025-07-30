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

  constructor(
    stakingProtocol: ValidatedStakingProtocolConfig,
    refreshWindow: number,
    apiClient: AbsintheApiClient,
    env: ValidatedEnvBase,
    chainConfig: Chain,
  ) {
    logger.info(
      `🔧 [VUSDBridgeProcessor] Initializing processor for contract: ${stakingProtocol.contractAddress}`,
    );
    logger.info(
      `🔧 [VUSDBridgeProcessor] Chain: ${chainConfig.chainName} (${chainConfig.networkId})`,
    );
    logger.info(`🔧 [VUSDBridgeProcessor] Refresh window: ${refreshWindow}ms`);

    this.stakingProtocol = stakingProtocol;
    this.refreshWindow = refreshWindow;
    this.apiClient = apiClient;
    this.env = env;
    this.chainConfig = chainConfig;
    this.schemaName = this.generateSchemaName();

    logger.info(`🔧 [VUSDBridgeProcessor] Generated schema name: ${this.schemaName}`);
  }

  private generateSchemaName(): string {
    const uniquePoolCombination = this.stakingProtocol.contractAddress.concat(
      this.chainConfig.networkId.toString(),
    );

    const hash = createHash('md5').update(uniquePoolCombination).digest('hex').slice(0, 8);
    const schemaName = `vusd-bridge-${hash}`;
    logger.info(
      `🔧 [VUSDBridgeProcessor] Generated schema name: ${schemaName} from combination: ${uniquePoolCombination}`,
    );
    return schemaName;
  }

  async run(): Promise<void> {
    logger.info(`🚀 [VUSDBridgeProcessor] Starting processor with schema: ${this.schemaName}`);

    processor.run(
      new TypeormDatabase({ supportHotBlocks: false, stateSchema: this.schemaName }),
      async (ctx) => {
        try {
          logger.info(`📦 [VUSDBridgeProcessor] Processing batch with ${ctx.blocks.length} blocks`);
          await this.processBatch(ctx);
        } catch (error) {
          logger.error(`❌ [VUSDBridgeProcessor] Error processing batch:`, error);
          throw error;
        }
      },
    );
  }

  private async processBatch(ctx: any): Promise<void> {
    logger.info(`🔄 [VUSDBridgeProcessor] Initializing protocol states...`);
    const protocolStates = await this.initializeProtocolStates(ctx);
    logger.info(
      `✅ [VUSDBridgeProcessor] Protocol states initialized for ${protocolStates.size} contracts`,
    );

    for (const block of ctx.blocks) {
      logger.info(
        `📦 [VUSDBridgeProcessor] Processing block ${block.header.height} with ${block.logs.length} logs`,
      );
      await this.processBlock({ ctx, block, protocolStates });
    }

    logger.info(`🏁 [VUSDBridgeProcessor] Finalizing batch...`);
    await this.finalizeBatch(ctx, protocolStates);
    logger.info(`✅ [VUSDBridgeProcessor] Batch processing completed successfully`);
  }

  private async initializeProtocolStates(ctx: any): Promise<Map<string, ProtocolStateHemi>> {
    logger.info(`🔧 [VUSDBridgeProcessor] Initializing protocol states...`);
    const protocolStates = new Map<string, ProtocolStateHemi>();

    const contractAddress = this.stakingProtocol.contractAddress.toLowerCase();
    logger.info(`🔧 [VUSDBridgeProcessor] Loading state for contract: ${contractAddress}`);

    const activeBalances = await loadActiveBalancesFromDb(ctx, contractAddress);
    const processState = await loadPoolProcessStateFromDb(ctx, contractAddress);

    logger.info(
      `📊 [VUSDBridgeProcessor] Loaded active balances: ${activeBalances ? 'found' : 'not found'}`,
    );
    logger.info(
      `📊 [VUSDBridgeProcessor] Loaded process state: ${processState ? 'found' : 'not found'}`,
    );

    protocolStates.set(contractAddress, {
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

    const contractAddress = this.stakingProtocol.contractAddress.toLowerCase();
    const protocolState = protocolStates.get(contractAddress.toLowerCase())!;

    logger.info(`🔍 [VUSDBridgeProcessor] Processing logs for contract: ${contractAddress}`);
    await this.processLogsForProtocol(ctx, block, contractAddress, protocolState);

    logger.info(`⏰ [VUSDBridgeProcessor] Processing periodic balance flush...`);
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

    logger.info(
      `📋 [VUSDBridgeProcessor] Found ${poolLogs.length} logs for contract ${contractAddress} out of ${block.logs.length} total logs`,
    );

    for (const log of poolLogs) {
      logger.info(`🔍 [VUSDBridgeProcessor] Processing log with topic: ${log.topics[0]}`);
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
    const contractAddress = this.stakingProtocol.contractAddress.toLowerCase();
    const protocolState = protocolStates.get(contractAddress);

    if (!protocolState) {
      logger.error(
        `❌ [VUSDBridgeProcessor] Protocol state not found for contract: ${contractAddress}`,
      );
      return;
    }

    logger.info(
      `📊 [VUSDBridgeProcessor] Finalizing batch with ${protocolState.balanceWindows.length} balance windows`,
    );

    // Send data to Absinthe API
    logger.info(
      `📤 [VUSDBridgeProcessor] Converting balance windows to time-weighted balance events...`,
    );
    const balances = toTimeWeightedBalance(
      protocolState.balanceWindows,
      this.stakingProtocol,
      this.env,
      this.chainConfig,
    ).filter((e: TimeWeightedBalanceEvent) => e.startUnixTimestampMs !== e.endUnixTimestampMs);

    logger.info(
      `📤 [VUSDBridgeProcessor] Sending ${balances.length} balance events to Absinthe API`,
    );
    console.log(JSON.stringify(balances));
    await this.apiClient.send(balances);
    logger.info(`✅ [VUSDBridgeProcessor] Successfully sent data to Absinthe API`);

    // Save to database
    logger.info(`💾 [VUSDBridgeProcessor] Saving process state to database...`);
    await ctx.store.upsert(
      new PoolProcessState({
        id: `${contractAddress.toLowerCase()}-process-state`,
        lastInterpolatedTs: protocolState.processState.lastInterpolatedTs,
      }),
    );

    logger.info(`💾 [VUSDBridgeProcessor] Saving active balances to database...`);
    await ctx.store.upsert(
      new ActiveBalances({
        id: `${contractAddress.toLowerCase()}-active-balances`,
        activeBalancesMap: mapToJson(protocolState.activeBalances),
      }),
    );

    logger.info(`✅ [VUSDBridgeProcessor] Successfully saved state to database`);
  }
}
