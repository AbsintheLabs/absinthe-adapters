import { ActiveBalances, PoolState, PoolProcessState, PoolConfig } from './model';

import {
  AbsintheApiClient,
  ActiveBalance,
  BatchContext,
  Chain,
  ChainId,
  ChainShortName,
  Currency,
  ProtocolType,
  fetchHistoricalUsd,
  MessageType,
  ProtocolConfig,
  TimeWeightedBalanceEvent,
  TimeWindowTrigger,
  ValidatedDexProtocolConfig,
  ValidatedEnvBase,
} from '@absinthe/common';

import { processor } from './processor';
import { createHash } from 'crypto';
import { TypeormDatabase } from '@subsquid/typeorm-store';
import {
  initPoolConfigIfNeeded,
  initPoolProcessStateIfNeeded,
  initPoolStateIfNeeded,
  loadActiveBalancesFromDb,
} from './utils/pool';
import { loadPoolProcessStateFromDb, loadPoolStateFromDb } from './utils/pool';
import { loadPoolConfigFromDb } from './utils/pool';
import { ProtocolStateUniv2 } from './utils/types';
import * as univ2Abi from './abi/univ2';
import { computeLpTokenPrice, computePricedSwapVolume } from './utils/pricing';
import {
  mapToJson,
  processValueChange,
  toTimeWeightedBalance,
  toTransaction,
  pricePosition,
} from '@absinthe/common';

export class UniswapV2Processor {
  private readonly protocols: ProtocolConfig[];
  private readonly protocolType: ProtocolType;
  private readonly schemaName: string;
  private readonly refreshWindow: number;
  private readonly apiClient: AbsintheApiClient;
  private readonly chainConfig: Chain;
  private readonly env: ValidatedEnvBase;

  constructor(
    dexProtocol: ValidatedDexProtocolConfig,
    refreshWindow: number,
    apiClient: AbsintheApiClient,
    env: ValidatedEnvBase,
    chainConfig: Chain,
  ) {
    this.protocols = dexProtocol.protocols;
    this.protocolType = dexProtocol.type;
    this.refreshWindow = refreshWindow;
    this.apiClient = apiClient;
    this.env = env;
    this.chainConfig = chainConfig;
    this.schemaName = this.generateSchemaName();
  }

  private generateSchemaName(): string {
    const uniquePoolCombination = this.protocols
      .reduce((acc, protocol) => acc + protocol.contractAddress, '')
      .concat(this.chainConfig.networkId.toString());

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
          console.error('Error processing batch:', (error as Error).message);
          throw error;
        }
      },
    );
  }

  private async processBatch(ctx: any): Promise<void> {
    const protocolStates = await this.initializeProtocolStates(ctx);

    for (const block of ctx.blocks) {
      console.log(block.header.height, 'block');
      await this.processBlock({ ctx, block, protocolStates });
    }
    await this.finalizeBatch(ctx, protocolStates);
  }

  private async initializeProtocolStates(ctx: any): Promise<Map<string, ProtocolStateUniv2>> {
    const protocolStates = new Map<string, ProtocolStateUniv2>();

    for (const protocol of this.protocols) {
      const contractAddress = protocol.contractAddress.toLowerCase();

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
      try {
        await this.initializeProtocolForBlock(ctx, block, contractAddress, protocol, protocolState);

        // Only process logs if we have a valid config
        if (
          protocolState.config.id &&
          protocolState.config.lpToken &&
          protocolState.config.token0 &&
          protocolState.config.token1
        ) {
          await this.processLogsForProtocol(ctx, block, contractAddress, protocol, protocolState);
          await this.processPeriodicBalanceFlush(ctx, block, contractAddress, protocolState);
        }
      } catch (error) {}
    }
  }

  private async initializeProtocolForBlock(
    ctx: any,
    block: any,
    contractAddress: string,
    protocol: ProtocolConfig,
    protocolState: ProtocolStateUniv2,
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
    protocol: ProtocolConfig,
    protocolState: ProtocolStateUniv2,
  ): Promise<void> {
    const poolLogs = block.logs.filter(
      (log: any) => log.address.toLowerCase() === contractAddress.toLowerCase(),
    );

    for (const log of poolLogs) {
      await this.processLog(ctx, block, log, protocol, protocolState);
    }
  }

  private async processLog(
    ctx: any,
    block: any,
    log: any,
    protocol: ProtocolConfig,
    protocolState: ProtocolStateUniv2,
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
    protocol: ProtocolConfig,
    protocolState: ProtocolStateUniv2,
  ): Promise<void> {
    const { sender, amount0In, amount0Out, amount1In, amount1Out } =
      univ2Abi.events.Swap.decode(log);
    const token0Amount = amount0In + amount0Out;
    const token1Amount = amount1In + amount1Out;

    const { gasPrice, gasUsed } = log.transaction;
    const gasFee = Number(gasUsed) * Number(gasPrice);
    const displayGasFee = gasFee / 10 ** 18;
    const ethPriceUsd = await fetchHistoricalUsd(
      'hemi',
      block.header.timestamp,
      this.env.coingeckoApiKey,
    );
    const gasFeeUsd = displayGasFee * ethPriceUsd;

    const pricedSwapVolume =
      protocol.preferredTokenCoingeckoId === 'token0'
        ? await computePricedSwapVolume(
            token0Amount,
            protocolState.config.token0.coingeckoId as string,
            protocolState.config.token0.decimals,
            block.header.timestamp,
            this.env.coingeckoApiKey,
          )
        : await computePricedSwapVolume(
            token1Amount,
            protocolState.config.token1.coingeckoId as string,
            protocolState.config.token1.decimals,
            block.header.timestamp,
            this.env.coingeckoApiKey,
          );

    const transactionSchema = {
      eventType: MessageType.TRANSACTION,
      eventName: 'Swap',
      tokens: {
        token0Decimals: {
          value: protocolState.config.token0.decimals.toString(),
          type: 'number',
        },
        token0Address: {
          value: protocolState.config.token0.address,
          type: 'string',
        },
        token0Symbol: {
          value: ChainShortName.HEMI,
          type: 'string',
        },
        token0PriceUsd: {
          value: pricedSwapVolume.toString(),
          type: 'number',
        },
        token0Amount: {
          value: token0Amount.toString(),
          type: 'number',
        },
        token0AmountIn: {
          value: token0Amount.toString(),
          type: 'number',
        },
        token0AmountOut: {
          value: token0Amount.toString(),
          type: 'number',
        },
        token1Decimals: {
          value: protocolState.config.token1.decimals.toString(),
          type: 'number',
        },
        token1Address: {
          value: protocolState.config.token1.address,
          type: 'string',
        },
        token1Amount: {
          value: token1Amount.toString(),
          type: 'number',
        },
        token1AmountIn: {
          value: token1Amount.toString(),
          type: 'number',
        },
        token1AmountOut: {
          value: token1Amount.toString(),
          type: 'number',
        },
      },
      rawAmount:
        protocol.preferredTokenCoingeckoId === 'token0'
          ? token0Amount.toString()
          : token1Amount.toString(),
      displayAmount:
        protocol.preferredTokenCoingeckoId === 'token0'
          ? Number(BigInt(token0Amount) / BigInt(10 ** protocolState.config.token0.decimals))
          : Number(BigInt(token1Amount) / BigInt(10 ** protocolState.config.token1.decimals)),
      unixTimestampMs: block.header.timestamp,
      txHash: log.transactionHash,
      logIndex: log.logIndex,
      blockNumber: block.header.height,
      blockHash: block.header.hash,
      userId: sender,
      currency: Currency.USD,
      valueUsd: pricedSwapVolume,
      gasUsed: Number(gasUsed),
      gasFeeUsd: gasFeeUsd,
    };

    protocolState.transactions.push(transactionSchema);
  }

  private processSyncEvent(protocolState: ProtocolStateUniv2): void {
    // If we see a sync event, we need to update the pool state later since reserves and/or total supply have changed
    protocolState.state.isDirty = true;
  }

  private async processTransferEvent(
    ctx: any,
    block: any,
    log: any,
    protocol: ProtocolConfig,
    protocolState: ProtocolStateUniv2,
  ): Promise<void> {
    //todo: fix if the value is +ve or -ve
    const { from, to, value } = univ2Abi.events.Transfer.decode(log);
    const lpTokenPrice = await computeLpTokenPrice(
      ctx,
      block,
      protocolState.config,
      protocolState.state,
      this.env.coingeckoApiKey,
      block.header.timestamp,
    );
    const lpTokenSwapUsdValue = pricePosition(
      lpTokenPrice,
      value,
      protocolState.config.lpToken.decimals,
    );

    const newHistoryWindows = processValueChange({
      from,
      to,
      amount: value,
      usdValue: lpTokenSwapUsdValue,
      blockTimestamp: block.header.timestamp,
      blockHeight: block.header.height,
      txHash: log.transactionHash,
      activeBalances: protocolState.activeBalances,
      windowDurationMs: this.refreshWindow,
      tokenPrice: lpTokenPrice,
      tokenDecimals: protocolState.config.lpToken.decimals,
      tokens: {
        token0Decimals: {
          value: protocolState.config.token0.decimals.toString(),
          type: 'number',
        },
        token0Address: {
          value: protocolState.config.token0.address,
          type: 'string',
        },
        token0Symbol: {
          value: ChainShortName.HEMI,
          type: 'string',
        },

        token1Address: {
          value: protocolState.config.token1.address,
          type: 'string',
        },
        token1Decimals: {
          value: protocolState.config.token1.decimals.toString(),
          type: 'number',
        },
        lpTokenPrice: {
          value: lpTokenPrice.toString(),
          type: 'string',
        },
      },
    });
    protocolState.balanceWindows.push(...newHistoryWindows);
  }

  private async processPeriodicBalanceFlush(
    ctx: any,
    block: any,
    contractAddress: string,
    protocolState: ProtocolStateUniv2,
  ): Promise<void> {
    const currentTs = block.header.timestamp;
    const currentBlockHeight = block.header.height; // needed as we need to calculate lpTokenPrice

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
          const lpTokenPrice = await computeLpTokenPrice(
            ctx,
            block,
            protocolState.config,
            protocolState.state,
            this.env.coingeckoApiKey,
            currentBlockHeight,
          );
          const balanceUsd = pricePosition(
            lpTokenPrice,
            data.balance,
            protocolState.config.lpToken.decimals,
          );
          // calculate the usd value of the lp token before and after the transfer
          protocolState.balanceWindows.push({
            userAddress: userAddress,
            deltaAmount: 0,
            trigger: TimeWindowTrigger.EXHAUSTED,
            startTs: oldStart,
            endTs: nextBoundaryTs,
            windowDurationMs: this.refreshWindow,
            startBlockNumber: data.updatedBlockHeight,
            endBlockNumber: block.header.height,
            tokenPrice: lpTokenPrice,
            tokenDecimals: protocolState.config.lpToken.decimals,
            balanceBefore: data.balance.toString(),
            balanceAfter: data.balance.toString(),
            txHash: null,
            currency: Currency.USD,
            valueUsd: balanceUsd, //balanceBeforeUsd
            tokens: {},
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

  private async finalizeBatch(
    ctx: any,
    protocolStates: Map<string, ProtocolStateUniv2>,
  ): Promise<void> {
    for (const protocol of this.protocols) {
      const protocolState = protocolStates.get(protocol.contractAddress)!;

      // Skip if config is not properly initialized
      if (
        !protocolState.config.id ||
        !protocolState.config.token0 ||
        !protocolState.config.token1 ||
        !protocolState.config.lpToken
      ) {
        // console.warn(
        //   `Skipping finalize for ${protocol.contractAddress} - config not properly initialized`,
        // );
        continue;
      }

      const balances = toTimeWeightedBalance(
        protocolState.balanceWindows,
        { ...protocol, type: this.protocolType },
        this.env,
        this.chainConfig,
      ).filter((e: TimeWeightedBalanceEvent) => e.startUnixTimestampMs !== e.endUnixTimestampMs);
      const transactions = toTransaction(
        protocolState.transactions,
        { ...protocol, type: this.protocolType },
        this.env,
        this.chainConfig,
      );

      console.log(balances, 'balances');
      console.log(transactions, 'transactions');

      await this.apiClient.send(balances);
      await this.apiClient.send(transactions);

      // Save to database - only if entities exist
      if (protocolState.config.token0) {
        await ctx.store.upsert(protocolState.config.token0);
      }
      if (protocolState.config.token1) {
        await ctx.store.upsert(protocolState.config.token1);
      }
      if (protocolState.config.lpToken) {
        await ctx.store.upsert(protocolState.config.lpToken);
      }
      if (protocolState.config.id) {
        await ctx.store.upsert(protocolState.config);
      }
      if (protocolState.state.id) {
        await ctx.store.upsert(protocolState.state);
      }
      if (protocolState.processState.id) {
        await ctx.store.upsert(protocolState.processState);
      }

      await ctx.store.upsert(
        new ActiveBalances({
          id: `${protocol.contractAddress}-active-balances`,
          activeBalancesMap: mapToJson(protocolState.activeBalances),
        }),
      );
    }
  }
}
