import { ActiveBalances } from './model';

import {
  AbsintheApiClient,
  ActiveBalance,
  BatchContext,
  Chain,
  Currency,
  logger,
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
import { ProtocolStateMorpho } from './utils/types';
import * as morphoAbi from './abi/morphov1';
import { fetchHistoricalUsd } from '@absinthe/common';
import { mapToJson, toTimeWeightedBalance, pricePosition } from '@absinthe/common';
import { PoolProcessState } from './model';
import { checkToken, flattenNestedMap } from './utils/helper';

// Type definitions
interface MarketData {
  loanToken: string;
  collateralToken: string;
  oracle: string;
  irm: string;
  lltv: bigint;
}

interface MarketIndexes {
  supplyIndex: bigint; // 1e18-scaled
  borrowIndex: bigint; // 1e18-scaled
}

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
    this.schemaName = this.generateSchemaName();
    this.contractAddress = stakingProtocol.contractAddress.toLowerCase();
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
      marketData: new Map<string, MarketData>(),
      // marketId -> userAddress -> UserPosition
      userPositions: new Map<string, Map<string, bigint>>(),
    });

    return protocolStates;
  }

  private async processBlock(batchContext: BatchContext): Promise<void> {
    const { ctx, block, protocolStates } = batchContext;
    const protocolState = protocolStates.get(this.contractAddress)!;
    await this.processLogsForProtocol(ctx, block, protocolState);
    // await this.processPeriodicBalanceFlush(ctx, block, protocolState);
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

  // -----------------------
  // Event handlers
  // -----------------------

  // SUPPLY -> supplyShares += shares
  private async processSupplyEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateMorpho,
  ): Promise<void> {
    const { id: marketId, onBehalf, assets, shares } = morphoAbi.events.Supply.decode(log);

    console.log(`Processing Supply event for market: ${marketId}`, {
      onBehalf,
      assets,
      shares,
    });

    const marketData = await this.getMarketData(ctx, marketId, protocolState);
    if (!marketData) {
      console.warn(`Market data not found for market: ${marketId}`);
      return;
    }

    const loanToken = marketData.loanToken;
    const tokenMetadata = checkToken(loanToken);
    if (!tokenMetadata) {
      console.warn(`Ignoring supply for unsupported token: ${loanToken}`);
      return;
    }

    // Update user supply position (+)
    await this.updateUserSupply(protocolState, marketId, onBehalf, BigInt(shares));

    const marketIndexes = await this.getMarketIndexes(ctx, marketId);
    logger.info(`💰 [MorphoStakingProcessor] Market indexes: ${marketIndexes}`);
    if (!marketIndexes) return;

    // supplyIndex is 1e18-scaled
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
      tokens: {
        tokenAddress: { value: tokenMetadata.address, type: 'string' },
        coingeckoId: { value: tokenMetadata.coingeckoId, type: 'string' },
        tokenDecimals: { value: tokenMetadata.decimals.toString(), type: 'number' },
        tokenPrice: { value: tokenPrice.toString(), type: 'number' },
        marketId: { value: marketId, type: 'string' },
        positionSide: { value: 'supply', type: 'string' },
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

    console.log(`Processing Borrow event for market: ${marketId}`, {
      caller,
      onBehalf,
      assets,
      shares,
    });

    const marketData = await this.getMarketData(ctx, marketId, protocolState);
    if (!marketData) {
      console.warn(`Market data not found for market: ${marketId}`);
      return;
    }

    const loanToken = marketData.loanToken;
    const tokenMetadata = checkToken(loanToken);
    if (!tokenMetadata) {
      console.warn(`Ignoring borrow for unsupported token: ${loanToken}`);
      return;
    }

    // Update user borrow position (+)
    await this.updateUserBorrow(protocolState, marketId, onBehalf, BigInt(shares));

    const marketIndexes = await this.getMarketIndexes(ctx, marketId);
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
      from: onBehalf,
      to: ZERO_ADDRESS,
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
      tokens: {
        tokenAddress: { value: tokenMetadata.address, type: 'string' },
        coingeckoId: { value: tokenMetadata.coingeckoId, type: 'string' },
        tokenDecimals: { value: tokenMetadata.decimals.toString(), type: 'number' },
        tokenPrice: { value: tokenPrice.toString(), type: 'number' },
        marketId: { value: marketId, type: 'string' },
        positionSide: { value: 'borrow', type: 'string' },
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

    console.log(`Processing Repay event for market: ${marketId}`, {
      caller,
      onBehalf,
      assets,
      shares,
    });

    const marketData = await this.getMarketData(ctx, marketId, protocolState);
    if (!marketData) {
      console.warn(`Market data not found for market: ${marketId}`);
      return;
    }

    const loanToken = marketData.loanToken;
    const tokenMetadata = checkToken(loanToken);
    if (!tokenMetadata) {
      console.warn(`Ignoring repay for unsupported token: ${loanToken}`);
      return;
    }

    // Update user borrow position (-)
    await this.updateUserBorrow(protocolState, marketId, onBehalf, -BigInt(shares));

    const marketIndexes = await this.getMarketIndexes(ctx, marketId);
    if (!marketIndexes) return;

    const repayAssets = (BigInt(shares) * marketIndexes.borrowIndex) / 10n ** 18n;

    const tokenPrice = await fetchHistoricalUsd(
      tokenMetadata.coingeckoId,
      block.header.timestamp,
      this.env.coingeckoApiKey,
    );
    const usdValue = pricePosition(tokenPrice, repayAssets, tokenMetadata.decimals);

    const newHistoryWindows = processValueChangeBalances({
      from: ZERO_ADDRESS,
      to: onBehalf,
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
      tokens: {
        tokenAddress: { value: tokenMetadata.address, type: 'string' },
        coingeckoId: { value: tokenMetadata.coingeckoId, type: 'string' },
        tokenDecimals: { value: tokenMetadata.decimals.toString(), type: 'number' },
        tokenPrice: { value: tokenPrice.toString(), type: 'number' },
        marketId: { value: marketId, type: 'string' },
        positionSide: { value: 'borrow', type: 'string' },
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

    console.log(`Processing Withdraw event for market: ${marketId}`, {
      caller,
      onBehalf,
      receiver,
      assets,
      shares,
    });

    const marketData = await this.getMarketData(ctx, marketId, protocolState);
    if (!marketData) {
      console.warn(`Market data not found for market: ${marketId}`);
      return;
    }

    const loanToken = marketData.loanToken;
    const tokenMetadata = checkToken(loanToken);
    if (!tokenMetadata) {
      console.warn(`Ignoring withdraw for unsupported token: ${loanToken}`);
      return;
    }

    // Update user supply position (-)
    await this.updateUserSupply(protocolState, marketId, onBehalf, -BigInt(shares));

    const marketIndexes = await this.getMarketIndexes(ctx, marketId);
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
      tokens: {
        tokenAddress: { value: tokenMetadata.address, type: 'string' },
        coingeckoId: { value: tokenMetadata.coingeckoId, type: 'string' },
        tokenDecimals: { value: tokenMetadata.decimals.toString(), type: 'number' },
        tokenPrice: { value: tokenPrice.toString(), type: 'number' },
        marketId: { value: marketId, type: 'string' },
        positionSide: { value: 'supply', type: 'string' },
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

    console.log(`Processing CreateMarket event for market: ${marketId}`, {
      marketParams,
    });

    // Store market data
    protocolState.marketData.set(marketId, {
      loanToken: marketParams.loanToken,
      collateralToken: marketParams.collateralToken,
      oracle: marketParams.oracle,
      irm: marketParams.irm,
      lltv: marketParams.lltv,
    });

    console.log(`Market created: ${marketId}`, {
      loanToken: marketParams.loanToken,
      collateralToken: marketParams.collateralToken,
    });
  }

  // -----------------------
  // Helpers
  // -----------------------

  private async getMarketData(
    ctx: any,
    marketId: string,
    protocolState: ProtocolStateMorpho,
  ): Promise<MarketData | null> {
    if (protocolState.marketData.has(marketId)) {
      return protocolState.marketData.get(marketId)!;
    }
    return null;
  }

  private async getMarketIndexes(ctx: any, marketId: string): Promise<MarketIndexes | null> {
    try {
      // NOTE: Replace with the actual Morpho Blue contract read for this network.
      const market = await ctx.contract.market(marketId);

      const tsAssets = BigInt(market.totalSupplyAssets ?? 0);
      const tsShares = BigInt(market.totalSupplyShares ?? 0);
      const tbAssets = BigInt(market.totalBorrowAssets ?? 0);
      const tbShares = BigInt(market.totalBorrowShares ?? 0);

      const SCALE = 10n ** 18n;

      const supplyIndex = tsShares === 0n ? SCALE : (tsAssets * SCALE) / tsShares;

      const borrowIndex = tbShares === 0n ? SCALE : (tbAssets * SCALE) / tbShares;

      return { supplyIndex, borrowIndex };
    } catch (error) {
      console.warn(`Failed to fetch market indexes for ${marketId}:`, error);
      return null;
    }
  }

  private ensureUserPosition(
    protocolState: ProtocolStateMorpho,
    marketId: string,
    userAddress: string,
  ): bigint {
    if (!protocolState.userPositions.has(marketId)) {
      protocolState.userPositions.set(marketId, new Map());
    }
    const marketPositions = protocolState.userPositions.get(marketId)!;
    if (!marketPositions.has(userAddress)) {
      marketPositions.set(userAddress, 0n);
    }
    return marketPositions.get(userAddress)!;
  }

  private async updateUserSupply(
    protocolState: ProtocolStateMorpho,
    marketId: string,
    userAddress: string,
    sharesDelta: bigint,
  ): Promise<void> {
    let pos = this.ensureUserPosition(protocolState, marketId, userAddress);
    pos = pos + sharesDelta;
    protocolState.userPositions.get(marketId)!.set(userAddress, pos);
  }

  private async updateUserBorrow(
    protocolState: ProtocolStateMorpho,
    marketId: string,
    userAddress: string,
    sharesDelta: bigint, // + for borrow, - for repay (as requested)
  ): Promise<void> {
    let pos = this.ensureUserPosition(protocolState, marketId, userAddress);
    pos = pos + sharesDelta;
    protocolState.userPositions.get(marketId)!.set(userAddress, pos);
  }

  // Periodic snapshot of balances (time-weighted)
  // private async processPeriodicBalanceFlush(
  //   ctx: any,
  //   block: any,
  //   protocolState: ProtocolStateMorpho,
  // ): Promise<void> {
  //   const currentTs = block.header.timestamp;

  //   if (!protocolState.processState?.lastInterpolatedTs) {
  //     protocolState.processState.lastInterpolatedTs = BigInt(currentTs);
  //   }

  //   while (
  //     protocolState.processState.lastInterpolatedTs &&
  //     Number(protocolState.processState.lastInterpolatedTs) + this.refreshWindow < currentTs
  //   ) {
  //     const windowsSinceEpoch = Math.floor(
  //       Number(protocolState.processState.lastInterpolatedTs) / this.refreshWindow,
  //     );
  //     const nextBoundaryTs: number = (windowsSinceEpoch + 1) * this.refreshWindow;

  //     for (const [marketId, userPositions] of protocolState.userPositions.entries()) {
  //       const marketData = protocolState.marketData.get(marketId);
  //       if (!marketData) continue;

  //       const tokenMetadata = checkToken(marketData.loanToken);
  //       if (!tokenMetadata) continue;

  //       const marketIndexes = await this.getMarketIndexes(ctx, marketId);
  //       if (!marketIndexes) continue;

  //       for (const [userAddress, position] of userPositions.entries()) {
  //         const SCALE = 10n ** 18n;

  //         // Supply snapshot (if any)
  //         if (position > 0n) {
  //           const supplyAssets = (position * marketIndexes.supplyIndex) / SCALE;
  //           if (supplyAssets > 0n) {
  //             const tokenPrice = await fetchHistoricalUsd(
  //               tokenMetadata.coingeckoId,
  //               currentTs,
  //               this.env.coingeckoApiKey,
  //             );
  //             const balanceUsd = pricePosition(tokenPrice, supplyAssets, tokenMetadata.decimals);

  //             protocolState.balanceWindows.push({
  //               userAddress: userAddress,
  //               deltaAmount: 0,
  //               trigger: TimeWindowTrigger.EXHAUSTED,
  //               startTs: Number(protocolState.processState.lastInterpolatedTs),
  //               endTs: nextBoundaryTs,
  //               windowDurationMs: this.refreshWindow,
  //               startBlockNumber: 0, // fill if you track start block
  //               endBlockNumber: block.header.height,
  //               tokenPrice: tokenPrice,
  //               tokenDecimals: tokenMetadata.decimals,
  //               balanceBefore: supplyAssets.toString(),
  //               balanceAfter: supplyAssets.toString(),
  //               txHash: null,
  //               currency: Currency.USD,
  //               valueUsd: balanceUsd,
  //               tokens: {
  //                 tokenAddress: { value: tokenMetadata.address, type: 'string' },
  //                 coingeckoId: { value: tokenMetadata.coingeckoId, type: 'string' },
  //                 tokenDecimals: { value: tokenMetadata.decimals.toString(), type: 'number' },
  //                 tokenPrice: { value: tokenPrice.toString(), type: 'number' },
  //                 marketId: { value: marketId, type: 'string' },
  //                 positionSide: { value: 'supply', type: 'string' },
  //               },
  //             });
  //           }
  //         }

  //         // Borrow snapshot (if any) — borrowShares are stored positive as per your spec
  //         if (position > 0n) {
  //           const borrowAssets = (position * marketIndexes.borrowIndex) / SCALE;
  //           if (borrowAssets > 0n) {
  //             const tokenPrice = await fetchHistoricalUsd(
  //               tokenMetadata.coingeckoId,
  //               currentTs,
  //               this.env.coingeckoApiKey,
  //             );
  //             const balanceUsd = pricePosition(tokenPrice, borrowAssets, tokenMetadata.decimals);

  //             protocolState.balanceWindows.push({
  //               userAddress: userAddress,
  //               deltaAmount: 0,
  //               trigger: TimeWindowTrigger.EXHAUSTED,
  //               startTs: Number(protocolState.processState.lastInterpolatedTs),
  //               endTs: nextBoundaryTs,
  //               windowDurationMs: this.refreshWindow,
  //               startBlockNumber: 0,
  //               endBlockNumber: block.header.height,
  //               tokenPrice: tokenPrice,
  //               tokenDecimals: tokenMetadata.decimals,
  //               balanceBefore: borrowAssets.toString(),
  //               balanceAfter: borrowAssets.toString(),
  //               txHash: null,
  //               currency: Currency.USD,
  //               valueUsd: balanceUsd,
  //               tokens: {
  //                 tokenAddress: { value: tokenMetadata.address, type: 'string' },
  //                 coingeckoId: { value: tokenMetadata.coingeckoId, type: 'string' },
  //                 tokenDecimals: { value: tokenMetadata.decimals.toString(), type: 'number' },
  //                 tokenPrice: { value: tokenPrice.toString(), type: 'number' },
  //                 marketId: { value: marketId, type: 'string' },
  //                 positionSide: { value: 'borrow', type: 'string' },
  //               },
  //             });
  //           }
  //         }
  //       }
  //     }

  //     protocolState.processState.lastInterpolatedTs = BigInt(nextBoundaryTs);
  //   }
  // }

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
        activeBalancesMap: mapToJson(flattenNestedMap(protocolState.activeBalances)),
      }),
    );
  }
}
