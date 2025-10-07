import { ActiveBalances, MarketData } from './model';

import {
  AbsintheApiClient,
  ActiveBalance,
  BatchContext,
  Chain,
  Currency,
  logger,
  MessageType,
  TimeWeightedBalanceEvent,
  TimeWindowTrigger,
  toTransaction,
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
import * as morphoVaultsAbi from './abi/morphov2vaults';
import * as morphoFactoryAbi from './abi/morphofactoryv2';
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
import { POOL_ADDRESS } from './utils/conts';
import { id } from 'zod/v4/locales';

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
    const uniquePoolCombination = POOL_ADDRESS.concat(this.chainConfig.networkId.toString());

    const hash = createHash('md5').update(uniquePoolCombination.join('')).digest('hex').slice(0, 8);
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

    for (const poolAddress of POOL_ADDRESS) {
      protocolStates.set(poolAddress, {
        activeBalances:
          (await loadActiveBalancesFromDb(ctx, poolAddress)) ||
          new Map<string, Map<string, ActiveBalance>>(),
        balanceWindows: [],
        transactions: [],
        processState:
          (await loadPoolProcessStateFromDb(ctx, poolAddress)) || new PoolProcessState({}),
        marketData:
          (await loadMarketDataFromDb(ctx, poolAddress)) || new Map<string, MarketDataType>(),
      });
    }

    return protocolStates;
  }

  private async processBlock(batchContext: BatchContext): Promise<void> {
    const { ctx, block, protocolStates } = batchContext;
    for (const poolAddress of POOL_ADDRESS) {
      const protocolState = protocolStates.get(poolAddress)!;
      await this.processLogsForProtocol(ctx, block, protocolState, poolAddress);
    }
  }

  private async processLogsForProtocol(
    ctx: any,
    block: any,
    protocolState: ProtocolStateMorpho,
    poolAddress: string,
  ): Promise<void> {
    const poolLogs = block.logs.filter(
      (log: any) =>
        log.address.toLowerCase() === poolAddress ||
        log.address.toLowerCase() === this.contractAddress,
    );
    for (const log of poolLogs) {
      await this.processLog(ctx, block, log, protocolState, poolAddress);
    }
  }

  private async processLog(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateMorpho,
    vaultAddress: string,
  ): Promise<void> {
    if (log.topics[0] === morphoVaultsAbi.events.Transfer.topic) {
      await this.processTransferEvent(ctx, block, log, protocolState, vaultAddress);
    }

    if (log.topics[0] === morphoFactoryAbi.events.CreateVaultV2.topic) {
      await this.processCreateVaultV2Event(ctx, block, log, protocolState, vaultAddress);
    }

    if (log.topics[0] === morphoVaultsAbi.events.Allocate.topic) {
      await this.processAllocateEvent(ctx, block, log, protocolState, vaultAddress);
    }

    if (log.topics[0] === morphoVaultsAbi.events.Deallocate.topic) {
      await this.processDeallocateEvent(ctx, block, log, protocolState, vaultAddress);
    }

    if (log.topics[0] === morphoVaultsAbi.events.ForceDeallocate.topic) {
      await this.processForceDeallocateEvent(ctx, block, log, protocolState, vaultAddress);
    }
  }
  private async processTransferEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateMorpho,
    vaultAddress: string,
  ): Promise<void> {
    const { from, to, shares } = morphoVaultsAbi.events.Transfer.decode(log);

    logger.info(`Processing Transfer event for market: ${vaultAddress}`, {
      from,
      to,
      shares,
      txHash: log.transactionHash,
    });

    const marketData = await this.getMarketData(ctx, vaultAddress, protocolState);
    if (!marketData) {
      logger.warn(`Market data not found for market: ${vaultAddress}`);
      return;
    }

    const asset = marketData.asset;
    const tokenMetadata = checkToken(asset);
    if (!tokenMetadata) {
      logger.warn(`Ignoring supply for unsupported token: ${asset}`);
      return;
    }
    const marketIndex = await this.getMarketIndexes(ctx, block, vaultAddress);
    logger.info(`Market indexes: ${marketIndex}`);
    if (!marketIndex) return;

    const supplyAssets = (BigInt(shares) * marketIndex) / 10n ** 18n;

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
      from: from,
      to: to,
      amount: supplyAssets,
      usdValue,
      blockTimestamp: block.header.timestamp,
      blockHeight: block.header.height,
      txHash: log.transactionHash,
      activeBalances: protocolState.activeBalances,
      windowDurationMs: this.refreshWindow,
      tokenPrice, // number
      tokenDecimals: tokenMetadata.decimals, // number
      tokenAddress: asset,
      vaultAddress: vaultAddress,
      tokens: {
        tokenAddress: { value: tokenMetadata.address, type: 'string' },
        coingeckoId: { value: tokenMetadata.coingeckoId, type: 'string' },
        tokenDecimals: { value: tokenMetadata.decimals.toString(), type: 'number' },
        tokenPrice: { value: tokenPrice.toString(), type: 'number' },
        vaultAddress: { value: vaultAddress, type: 'string' },
        totalSupply: { value: marketIndex.toString(), type: 'number' },
        totalAssets: { value: marketIndex.toString(), type: 'number' },
        sharePrice: { value: marketIndex.toString(), type: 'number' },
        positionSide: { value: 'supply', type: 'string' },
        typeMarket: { value: 'morphov2vaults', type: 'string' },
      },
    });

    protocolState.balanceWindows.push(...newHistoryWindows);
  }

  private async processCreateVaultV2Event(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateMorpho,
    vaultAddress: string,
  ): Promise<void> {
    const { owner, asset, salt, newVaultV2 } = morphoFactoryAbi.events.CreateVaultV2.decode(log);

    logger.info(`Processing CreateVaultV2 event for market: ${newVaultV2}`, {
      newVaultV2,
    });

    if (newVaultV2.toLowerCase() != vaultAddress.toLowerCase()) {
      logger.warn(`Market does not match: ${newVaultV2} !== ${vaultAddress}`);
      return;
    }

    protocolState.marketData.set(newVaultV2.toLowerCase(), {
      asset,
      name: '',
      symbol: '',
      salt,
    });

    logger.info(`Market created: ${newVaultV2}`, {
      asset,
      name: '',
      symbol: '',
      salt,
    });

    const { gasPrice, gasUsed, hash } = log.transaction;
    const gasUsedInEth = Number(gasUsed) / 10 ** 18;
    const gasFee = Number(gasUsed) * Number(gasPrice);
    const displayGasFee = gasFee / 10 ** 18;

    // Get WETH price in USD
    let ethPriceUsd = 0;
    try {
      ethPriceUsd = await fetchHistoricalUsd(
        'ethereum',
        block.header.timestamp,
        this.env.coingeckoApiKey,
      );
    } catch (error) {
      console.warn('Could not fetch historical USD price, using 0:', error);
    }
    const gasFeeUsd = displayGasFee * ethPriceUsd;

    const transactionSchema = {
      eventType: MessageType.TRANSACTION,
      eventName: 'CreateVaultV2',
      tokens: {
        asset: {
          value: asset!.toString(),
          type: 'number',
        },
        ethPriceUsd: {
          value: ethPriceUsd.toString(),
          type: 'number',
        },
      },
      rawAmount: '0',
      displayAmount: 0,
      unixTimestampMs: block.header.timestamp,
      txHash: hash,
      logIndex: log.logIndex,
      blockNumber: block.header.height,
      blockHash: block.header.hash,
      userId: owner,
      currency: Currency.USD,
      valueUsd: 0,
      gasUsed: gasUsedInEth,
      gasFeeUsd: gasFeeUsd,
    };
    protocolState.transactions.push(transactionSchema);
  }

  private async processAllocateEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateMorpho,
    vaultAddress: string,
  ): Promise<void> {
    const { sender, adapter, assets, ids, change } = morphoVaultsAbi.events.Allocate.decode(log);

    logger.info(`Processing Allocate event for market: ${vaultAddress}`, {
      sender,
      adapter,
      assets,
      ids,
      change,
    });

    const { gasPrice, gasUsed, hash } = log.transaction;
    const gasUsedInEth = Number(gasUsed) / 10 ** 18;
    const gasFee = Number(gasUsed) * Number(gasPrice);
    const displayGasFee = gasFee / 10 ** 18;

    // Get WETH price in USD
    let ethPriceUsd = 0;
    try {
      ethPriceUsd = await fetchHistoricalUsd(
        'ethereum',
        block.header.timestamp,
        this.env.coingeckoApiKey,
      );
    } catch (error) {
      console.warn('Could not fetch historical USD price, using 0:', error);
    }
    const gasFeeUsd = displayGasFee * ethPriceUsd;

    const transactionSchema = {
      eventType: MessageType.TRANSACTION,
      eventName: 'Allocate',
      tokens: {
        token0Decimals: {
          value: assets!.toString(),
          type: 'number',
        },
        ethPriceUsd: {
          value: ethPriceUsd.toString(),
          type: 'number',
        },
        id: {
          value: ids!.toString(),
          type: 'string',
        },
        change: {
          value: change!.toString(),
          type: 'number',
        },
        adapter: {
          value: adapter!.toString(),
          type: 'string',
        },
      },
      rawAmount: '0',
      displayAmount: 0,
      unixTimestampMs: block.header.timestamp,
      txHash: hash,
      logIndex: log.logIndex,
      blockNumber: block.header.height,
      blockHash: block.header.hash,
      userId: sender,
      currency: Currency.USD,
      valueUsd: 0,
      gasUsed: gasUsedInEth,
      gasFeeUsd: gasFeeUsd,
    };
    protocolState.transactions.push(transactionSchema);
  }
  private async processDeallocateEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateMorpho,
    vaultAddress: string,
  ): Promise<void> {
    const { sender, adapter, assets, ids, change } = morphoVaultsAbi.events.Deallocate.decode(log);

    logger.info(`Processing Deallocate event for market: ${vaultAddress}`, {
      sender,
      adapter,
      assets,
      ids,
      change,
    });

    const { gasPrice, gasUsed, hash } = log.transaction;
    const gasUsedInEth = Number(gasUsed) / 10 ** 18;
    const gasFee = Number(gasUsed) * Number(gasPrice);
    const displayGasFee = gasFee / 10 ** 18;

    // Get WETH price in USD
    let ethPriceUsd = 0;
    try {
      ethPriceUsd = await fetchHistoricalUsd(
        'ethereum',
        block.header.timestamp,
        this.env.coingeckoApiKey,
      );
    } catch (error) {
      console.warn('Could not fetch historical USD price, using 0:', error);
    }
    const gasFeeUsd = displayGasFee * ethPriceUsd;

    const transactionSchema = {
      eventType: MessageType.TRANSACTION,
      eventName: 'Deallocate',
      tokens: {
        token0Decimals: {
          value: assets!.toString(),
          type: 'number',
        },
        ethPriceUsd: {
          value: ethPriceUsd.toString(),
          type: 'number',
        },
        id: {
          value: ids!.toString(),
          type: 'string',
        },
        change: {
          value: change!.toString(),
          type: 'number',
        },
        adapter: {
          value: adapter!.toString(),
          type: 'string',
        },
      },
      rawAmount: '0',
      displayAmount: 0,
      unixTimestampMs: block.header.timestamp,
      txHash: hash,
      logIndex: log.logIndex,
      blockNumber: block.header.height,
      blockHash: block.header.hash,
      userId: sender,
      currency: Currency.USD,
      valueUsd: 0,
      gasUsed: gasUsedInEth,
      gasFeeUsd: gasFeeUsd,
    };
    protocolState.transactions.push(transactionSchema);
  }

  private async processForceDeallocateEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateMorpho,
    vaultAddress: string,
  ): Promise<void> {
    const { sender, adapter, assets, ids, penaltyAssets } =
      morphoVaultsAbi.events.ForceDeallocate.decode(log);

    logger.info(`Processing ForceDeallocate event for market: ${vaultAddress}`, {
      sender,
      adapter,
      assets,
      ids,
      penaltyAssets,
    });

    const { gasPrice, gasUsed, hash } = log.transaction;
    const gasUsedInEth = Number(gasUsed) / 10 ** 18;
    const gasFee = Number(gasUsed) * Number(gasPrice);
    const displayGasFee = gasFee / 10 ** 18;

    // Get WETH price in USD
    let ethPriceUsd = 0;
    try {
      ethPriceUsd = await fetchHistoricalUsd(
        'ethereum',
        block.header.timestamp,
        this.env.coingeckoApiKey,
      );
    } catch (error) {
      console.warn('Could not fetch historical USD price, using 0:', error);
    }
    const gasFeeUsd = displayGasFee * ethPriceUsd;

    const transactionSchema = {
      eventType: MessageType.TRANSACTION,
      eventName: 'ForceDeallocate',
      tokens: {
        token0Decimals: {
          value: assets!.toString(),
          type: 'number',
        },
        ethPriceUsd: {
          value: ethPriceUsd.toString(),
          type: 'number',
        },
        id: {
          value: ids!.toString(),
          type: 'string',
        },
        penaltyAssets: {
          value: penaltyAssets!.toString(),
          type: 'number',
        },
        adapter: {
          value: adapter!.toString(),
          type: 'string',
        },
      },
      rawAmount: '0',
      displayAmount: 0,
      unixTimestampMs: block.header.timestamp,
      txHash: hash,
      logIndex: log.logIndex,
      blockNumber: block.header.height,
      blockHash: block.header.hash,
      userId: sender,
      currency: Currency.USD,
      valueUsd: 0,
      gasUsed: gasUsedInEth,
      gasFeeUsd: gasFeeUsd,
    };
    protocolState.transactions.push(transactionSchema);
  }
  private async getMarketData(
    ctx: any,
    vaultAddress: string,
    protocolState: ProtocolStateMorpho,
  ): Promise<MarketDataType | null> {
    if (protocolState.marketData.has(vaultAddress)) {
      return protocolState.marketData.get(vaultAddress)!;
    }
    return null;
  }

  private async getMarketIndexes(ctx: any, block: any, marketId: string): Promise<bigint | null> {
    try {
      // Create the function call data for the market function
      const marketFunctionTotalAssets = morphoVaultsAbi.functions.totalAssets;
      const marketFunctionTotalSupply = morphoVaultsAbi.functions.totalSupply;

      const assetsResult = await ctx._chain.client.call('eth_call', [
        { to: marketId, data: marketFunctionTotalAssets.encode({}) },
        '0x' + block.header.height.toString(16), // Historical call at specific block
      ]);

      const supplyResult = await ctx._chain.client.call('eth_call', [
        { to: marketId, data: marketFunctionTotalSupply.encode({}) },
        '0x' + block.header.height.toString(16), // Historical call at specific block
      ]);

      // Decode the result
      const market = marketFunctionTotalAssets.decodeResult(assetsResult);
      const supply = marketFunctionTotalSupply.decodeResult(supplyResult);

      logger.info(`assets: ${market}`);
      logger.info(`supply: ${supply}`);

      const tsAssets = BigInt(market ?? 0);
      const tsSupply = BigInt(supply ?? 0);

      logger.info(`Total supply assets: ${tsAssets}`);
      logger.info(`Total supply supply: ${tsSupply}`);

      const SCALE = 10n ** 18n;
      const index = tsSupply === 0n ? SCALE : (tsAssets * SCALE) / tsSupply;

      logger.info(`Supply index: ${index}`);

      return index;
    } catch (error) {
      logger.warn(`Failed to fetch market indexes for ${marketId}:`, error);
      return null;
    }
  }

  private async finalizeBatch(
    ctx: any,
    protocolStates: Map<string, ProtocolStateMorpho>,
  ): Promise<void> {
    for (const poolAddress of POOL_ADDRESS) {
      const protocolState = protocolStates.get(poolAddress)!;

      const transactions = toTransaction(
        protocolState.transactions,
        this.stakingProtocol,
        this.env,
        this.chainConfig,
      );

      const balances = toTimeWeightedBalance(
        protocolState.balanceWindows,
        this.stakingProtocol,
        this.env,
        this.chainConfig,
      );

      logger.info(
        `💰 [MorphoStakingProcessor] Sending transactions: ${JSON.stringify(transactions, null, 2)}`,
      );
      logger.info(
        `💰 [MorphoStakingProcessor] Sending balances: ${JSON.stringify(balances, null, 2)}`,
      );

      await this.apiClient.send(transactions);
      await this.apiClient.send(balances);

      await ctx.store.upsert(
        new PoolProcessState({
          id: `${poolAddress}-process-state`,
          lastInterpolatedTs: protocolState.processState.lastInterpolatedTs,
        }),
      );
      await ctx.store.upsert(
        new ActiveBalances({
          id: `${poolAddress}-active-balances`,
          activeBalancesMap: mapToJson(flattenNestedMap(protocolState.activeBalances)),
        }),
      );
      await ctx.store.upsert(
        new MarketData({
          id: `${poolAddress}-market-data`,
          marketDataMap: mapToJsonMarketData(protocolState.marketData),
        }),
      );
    }
  }
}
