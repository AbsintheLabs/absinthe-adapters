import { ActiveBalances, MarketData } from './model';

import {
  AbsintheApiClient,
  ActiveBalance,
  BatchContext,
  Chain,
  Currency,
  logger,
  TimeWeightedBalanceEvent,
  TimeWindowTrigger,
  ValidatedEnvBase,
  ValidatedStakingProtocolConfig,
  ZERO_ADDRESS,
} from '@absinthe/common';
import { processValueChangeBalances } from './utils/helper';
import { processor } from './processor';
import { createHash } from 'crypto';
import { TypeormDatabase } from '@subsquid/typeorm-store';
import {
  loadActiveBalancesFromDb,
  loadMarketDataFromDb,
  loadPoolProcessStateFromDb,
} from './utils/pool';
import { ProtocolStateMorpho } from './utils/types';
import * as morphoAbi from './abi/morphov1';
import { fetchHistoricalUsd } from '@absinthe/common';
import { mapToJson, toTimeWeightedBalance, pricePosition } from '@absinthe/common';
import { PoolProcessState } from './model';
import {
  checkToken,
  flattenNestedMap,
  flattenNestedMapMarketData,
  mapToJsonMarketData,
} from './utils/helper';
import { MarketDataType, MarketIndexes } from './utils/types';
import { Contract } from './abi/morphov1';

export class MorphoStakingProcessor {
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
    this.contractAddress = stakingProtocol.contractAddress.toLowerCase();

    this.schemaName = this.generateSchemaName();
  }

  private generateSchemaName(): string {
    const uniquePoolCombination = this.contractAddress.concat(
      this.chainConfig.networkId.toString(),
    );

    const hash = createHash('md5').update(uniquePoolCombination).digest('hex').slice(0, 8);
    return `morpho-${hash}`;
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

  private async initializeProtocolStates(ctx: any): Promise<Map<string, ProtocolStateMorpho>> {
    const protocolStates = new Map<string, ProtocolStateMorpho>();

    protocolStates.set(this.contractAddress, {
      activeBalances:
        (await loadActiveBalancesFromDb(ctx, this.contractAddress)) ||
        new Map<string, Map<string, ActiveBalance>>(),
      balanceWindows: [],
      transactions: [],
      processState:
        (await loadPoolProcessStateFromDb(ctx, this.contractAddress)) || new PoolProcessState({}),
      marketData:
        (await loadMarketDataFromDb(ctx, this.contractAddress)) ||
        new Map<string, MarketDataType>(),
    });

    return protocolStates;
  }

  private async processBlock(batchContext: BatchContext): Promise<void> {
    const { ctx, block, protocolStates } = batchContext;
    const protocolState = protocolStates.get(this.contractAddress)!;
    await this.processLogsForProtocol(ctx, block, protocolState);
  }

  private async processLogsForProtocol(
    ctx: any,
    block: any,
    protocolState: ProtocolStateMorpho,
  ): Promise<void> {
    const poolLogs = block.logs.filter(
      (log: any) => log.address.toLowerCase() === this.contractAddress,
    );
    for (const log of poolLogs) {
      await this.processLog(ctx, block, log, protocolState);
    }
  }

  private async processLog(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateMorpho,
  ): Promise<void> {
    if (log.topics[0] === morphoAbi.events.Supply.topic) {
      await this.processSupplyEvent(ctx, block, log, protocolState);
    }

    if (log.topics[0] === morphoAbi.events.Borrow.topic) {
      await this.processBorrowEvent(ctx, block, log, protocolState);
    }

    if (log.topics[0] === morphoAbi.events.Repay.topic) {
      await this.processRepayEvent(ctx, block, log, protocolState);
    }

    if (log.topics[0] === morphoAbi.events.Withdraw.topic) {
      await this.processWithdrawEvent(ctx, block, log, protocolState);
    }

    if (log.topics[0] === morphoAbi.events.CreateMarket.topic) {
      await this.processCreateMarketEvent(ctx, block, log, protocolState);
    }
  }
  // SUPPLY -> supplyShares += shares
  private async processSupplyEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateMorpho,
  ): Promise<void> {
    const { id: marketId, onBehalf, assets, shares } = morphoAbi.events.Supply.decode(log);

    logger.info(`Processing Supply event for market: ${marketId}`, {
      onBehalf,
      assets,
      shares,
      txHash: log.transactionHash,
    });

    const marketData = await this.getMarketData(ctx, marketId, protocolState);
    if (!marketData) {
      logger.warn(`Market data not found for market: ${marketId}`);
      return;
    }

    const loanToken = marketData.loanToken;
    const tokenMetadata = checkToken(loanToken);
    if (!tokenMetadata) {
      logger.warn(`Ignoring supply for unsupported token: ${loanToken}`);
      return;
    }
    const marketIndexes = await this.getMarketIndexes(ctx, block, marketId);
    logger.info(`Market indexes: ${marketIndexes}`);
    if (!marketIndexes) return;

    const supplyAssets = (BigInt(shares) * marketIndexes.supplyIndex) / 10n ** 18n;

    const tokenPrice = await fetchHistoricalUsd(
      tokenMetadata.coingeckoId,
      block.header.timestamp,
      this.env.coingeckoApiKey,
    );

    logger.info(`💰 [MorphoStakingProcessor] Token price: $${tokenPrice}`);
    logger.info(`💰 [MorphoStakingProcessor] Supply assets: $${supplyAssets}`);
    logger.info(`💰 [MorphoStakingProcessor] Token metadata decimals: ${tokenMetadata.decimals}`);
    const usdValue = pricePosition(tokenPrice, supplyAssets, tokenMetadata.decimals);

    logger.info(`📊 [MorphoStakingProcessor] Processing value change balances...`);
    const newHistoryWindows = processValueChangeBalances({
      from: ZERO_ADDRESS,
      to: onBehalf,
      amount: supplyAssets,
      usdValue,
      blockTimestamp: block.header.timestamp,
      blockHeight: block.header.height,
      txHash: log.transactionHash,
      activeBalances: protocolState.activeBalances,
      windowDurationMs: this.refreshWindow,
      tokenPrice, // number
      tokenDecimals: tokenMetadata.decimals, // number
      tokenAddress: loanToken,
      marketId: marketId,
      tokens: {
        tokenAddress: { value: tokenMetadata.address, type: 'string' },
        coingeckoId: { value: tokenMetadata.coingeckoId, type: 'string' },
        tokenDecimals: { value: tokenMetadata.decimals.toString(), type: 'number' },
        tokenPrice: { value: tokenPrice.toString(), type: 'number' },
        marketId: { value: marketId, type: 'string' },
        positionSide: { value: 'supply', type: 'string' },
        typeMarket: { value: 'morphov1markets', type: 'string' },
      },
    });

    protocolState.balanceWindows.push(...newHistoryWindows);
  }

  // BORROW -> borrowShares += shares  (per your spec: borrow is +ve)
  private async processBorrowEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateMorpho,
  ): Promise<void> {
    const { id: marketId, caller, onBehalf, assets, shares } = morphoAbi.events.Borrow.decode(log);

    logger.info(`Processing Borrow event for market: ${marketId}`, {
      caller,
      onBehalf,
      assets,
      shares,
      txHash: log.transactionHash,
    });

    const marketData = await this.getMarketData(ctx, marketId, protocolState);
    if (!marketData) {
      logger.warn(`Market data not found for market: ${marketId}`);
      return;
    }

    const loanToken = marketData.loanToken;
    const tokenMetadata = checkToken(loanToken);
    if (!tokenMetadata) {
      logger.warn(`Ignoring borrow for unsupported token: ${loanToken}`);
      return;
    }

    const marketIndexes = await this.getMarketIndexes(ctx, block, marketId);
    if (!marketIndexes) return;

    // borrowIndex is 1e18-scaled
    const borrowAssets = (BigInt(shares) * marketIndexes.borrowIndex) / 10n ** 18n;

    const tokenPrice = await fetchHistoricalUsd(
      tokenMetadata.coingeckoId,
      block.header.timestamp,
      this.env.coingeckoApiKey,
    );
    const usdValue = pricePosition(tokenPrice, borrowAssets, tokenMetadata.decimals);

    const newHistoryWindows = processValueChangeBalances({
      from: ZERO_ADDRESS,
      to: onBehalf,
      amount: borrowAssets,
      usdValue,
      blockTimestamp: block.header.timestamp,
      blockHeight: block.header.height,
      txHash: log.transactionHash,
      activeBalances: protocolState.activeBalances,
      windowDurationMs: this.refreshWindow,
      tokenPrice,
      tokenDecimals: tokenMetadata.decimals,
      tokenAddress: loanToken,
      marketId: marketId,
      tokens: {
        tokenAddress: { value: tokenMetadata.address, type: 'string' },
        coingeckoId: { value: tokenMetadata.coingeckoId, type: 'string' },
        tokenDecimals: { value: tokenMetadata.decimals.toString(), type: 'number' },
        tokenPrice: { value: tokenPrice.toString(), type: 'number' },
        marketId: { value: marketId, type: 'string' },
        positionSide: { value: 'borrow', type: 'string' },
        typeMarket: { value: 'morphov1markets', type: 'string' },
      },
    });

    protocolState.balanceWindows.push(...newHistoryWindows);
  }

  // REPAY -> borrowShares -= shares  (per your spec: repay recorded as -ve)
  private async processRepayEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateMorpho,
  ): Promise<void> {
    const { id: marketId, caller, onBehalf, assets, shares } = morphoAbi.events.Repay.decode(log);

    logger.info(`Processing Repay event for market: ${marketId}`, {
      caller,
      onBehalf,
      assets,
      shares,
      txHash: log.transactionHash,
    });

    const marketData = await this.getMarketData(ctx, marketId, protocolState);
    if (!marketData) {
      logger.warn(`Market data not found for market: ${marketId}`);
      return;
    }

    const loanToken = marketData.loanToken;
    const tokenMetadata = checkToken(loanToken);
    if (!tokenMetadata) {
      logger.warn(`Ignoring repay for unsupported token: ${loanToken}`);
      return;
    }

    const marketIndexes = await this.getMarketIndexes(ctx, block, marketId);
    if (!marketIndexes) return;

    const repayAssets = (BigInt(shares) * marketIndexes.borrowIndex) / 10n ** 18n;

    const tokenPrice = await fetchHistoricalUsd(
      tokenMetadata.coingeckoId,
      block.header.timestamp,
      this.env.coingeckoApiKey,
    );
    const usdValue = pricePosition(tokenPrice, repayAssets, tokenMetadata.decimals);

    const newHistoryWindows = processValueChangeBalances({
      from: onBehalf,
      to: ZERO_ADDRESS,
      amount: repayAssets,
      usdValue,
      blockTimestamp: block.header.timestamp,
      blockHeight: block.header.height,
      txHash: log.transactionHash,
      activeBalances: protocolState.activeBalances,
      windowDurationMs: this.refreshWindow,
      tokenPrice,
      tokenDecimals: tokenMetadata.decimals,
      tokenAddress: loanToken,
      marketId: marketId,
      tokens: {
        tokenAddress: { value: tokenMetadata.address, type: 'string' },
        coingeckoId: { value: tokenMetadata.coingeckoId, type: 'string' },
        tokenDecimals: { value: tokenMetadata.decimals.toString(), type: 'number' },
        tokenPrice: { value: tokenPrice.toString(), type: 'number' },
        marketId: { value: marketId, type: 'string' },
        positionSide: { value: 'borrow', type: 'string' },
        typeMarket: { value: 'morphov1markets', type: 'string' },
      },
    });

    protocolState.balanceWindows.push(...newHistoryWindows);
  }

  // WITHDRAW -> supplyShares -= shares
  private async processWithdrawEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateMorpho,
  ): Promise<void> {
    const {
      id: marketId,
      caller,
      onBehalf,
      receiver,
      assets,
      shares,
    } = morphoAbi.events.Withdraw.decode(log);

    logger.info(`Processing Withdraw event for market: ${marketId}`, {
      caller,
      onBehalf,
      receiver,
      assets,
      shares,
      txHash: log.transactionHash,
    });

    const marketData = await this.getMarketData(ctx, marketId, protocolState);
    if (!marketData) {
      logger.warn(`Market data not found for market: ${marketId}`);
      return;
    }

    const loanToken = marketData.loanToken;
    const tokenMetadata = checkToken(loanToken);
    if (!tokenMetadata) {
      logger.warn(`Ignoring withdraw for unsupported token: ${loanToken}`);
      return;
    }

    const marketIndexes = await this.getMarketIndexes(ctx, block, marketId);
    if (!marketIndexes) return;

    const withdrawAssets = (BigInt(shares) * marketIndexes.supplyIndex) / 10n ** 18n;

    const tokenPrice = await fetchHistoricalUsd(
      tokenMetadata.coingeckoId,
      block.header.timestamp,
      this.env.coingeckoApiKey,
    );
    const usdValue = pricePosition(tokenPrice, withdrawAssets, tokenMetadata.decimals);

    const newHistoryWindows = processValueChangeBalances({
      from: onBehalf,
      to: ZERO_ADDRESS,
      amount: withdrawAssets,
      usdValue,
      blockTimestamp: block.header.timestamp,
      blockHeight: block.header.height,
      txHash: log.transactionHash,
      activeBalances: protocolState.activeBalances,
      windowDurationMs: this.refreshWindow,
      tokenPrice,
      tokenDecimals: tokenMetadata.decimals,
      tokenAddress: loanToken,
      marketId: marketId,
      tokens: {
        tokenAddress: { value: tokenMetadata.address, type: 'string' },
        coingeckoId: { value: tokenMetadata.coingeckoId, type: 'string' },
        tokenDecimals: { value: tokenMetadata.decimals.toString(), type: 'number' },
        tokenPrice: { value: tokenPrice.toString(), type: 'number' },
        marketId: { value: marketId, type: 'string' },
        positionSide: { value: 'supply', type: 'string' },
        typeMarket: { value: 'morphov1markets', type: 'string' },
      },
    });

    protocolState.balanceWindows.push(...newHistoryWindows);
  }

  private async processCreateMarketEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateMorpho,
  ): Promise<void> {
    const { id: marketId, marketParams } = morphoAbi.events.CreateMarket.decode(log);

    logger.info(`Processing CreateMarket event for market: ${marketId}`, {
      marketParams,
    });

    protocolState.marketData.set(marketId, {
      loanToken: marketParams.loanToken,
      collateralToken: marketParams.collateralToken,
      oracle: marketParams.oracle,
      irm: marketParams.irm,
      lltv: marketParams.lltv,
    });

    logger.info(`Market created: ${marketId}`, {
      loanToken: marketParams.loanToken,
      collateralToken: marketParams.collateralToken,
    });
  }

  private async getMarketData(
    ctx: any,
    marketId: string,
    protocolState: ProtocolStateMorpho,
  ): Promise<MarketDataType | null> {
    if (protocolState.marketData.has(marketId)) {
      return protocolState.marketData.get(marketId)!;
    }
    return null;
  }

  private async getMarketIndexes(
    ctx: any,
    block: any,
    marketId: string,
  ): Promise<MarketIndexes | null> {
    try {
      // Create the function call data for the market function
      const marketFunction = morphoAbi.functions.market;
      const callData = marketFunction.encode({ _0: marketId });

      // Make the historical RPC call using the block height
      const result = await ctx._chain.client.call('eth_call', [
        { to: this.contractAddress, data: callData },
        '0x' + block.header.height.toString(16), // Historical call at specific block
      ]);

      // Decode the result
      const market = marketFunction.decodeResult(result);

      logger.info(`Market: ${market}`);
      const tsAssets = BigInt(market.totalSupplyAssets ?? 0);
      const tsShares = BigInt(market.totalSupplyShares ?? 0);
      const tbAssets = BigInt(market.totalBorrowAssets ?? 0);
      const tbShares = BigInt(market.totalBorrowShares ?? 0);

      logger.info(`Total supply assets: ${tsAssets}`);
      logger.info(`Total supply shares: ${tsShares}`);
      logger.info(`Total borrow assets: ${tbAssets}`);
      logger.info(`Total borrow shares: ${tbShares}`);

      const SCALE = 10n ** 18n;

      const supplyIndex = tsShares === 0n ? SCALE : (tsAssets * SCALE) / tsShares;
      const borrowIndex = tbShares === 0n ? SCALE : (tbAssets * SCALE) / tbShares;

      logger.info(`Supply index: ${supplyIndex}`);
      logger.info(`Borrow index: ${borrowIndex}`);

      return { supplyIndex, borrowIndex };
    } catch (error) {
      logger.warn(`Failed to fetch market indexes for ${marketId}:`, error);
      return null;
    }
  }

  private async finalizeBatch(
    ctx: any,
    protocolStates: Map<string, ProtocolStateMorpho>,
  ): Promise<void> {
    const protocolState = protocolStates.get(this.contractAddress)!;
    const balances = toTimeWeightedBalance(
      protocolState.balanceWindows,
      this.stakingProtocol,
      this.env,
      this.chainConfig,
    );
    await this.apiClient.send(balances);

    await ctx.store.upsert(
      new PoolProcessState({
        id: `${this.contractAddress}-process-state`,
        lastInterpolatedTs: protocolState.processState.lastInterpolatedTs,
      }),
    );
    await ctx.store.upsert(
      new ActiveBalances({
        id: `${this.contractAddress}-active-balances`,
        activeBalancesMap: mapToJson(flattenNestedMap(protocolState.activeBalances)),
      }),
    );
    await ctx.store.upsert(
      new MarketData({
        id: `${this.contractAddress}-market-data`,
        marketDataMap: mapToJsonMarketData(protocolState.marketData),
      }),
    );
  }
}
