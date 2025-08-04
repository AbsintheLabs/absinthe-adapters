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
import { logger } from '@absinthe/common';

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
      .reduce((acc, protocol) => acc + protocol.contractAddress.toLowerCase(), '')
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
          logger.error('Error processing batch:', (error as Error).message);
          throw error;
        }
      },
    );
  }

  private async processBatch(ctx: any): Promise<void> {
    logger.info(`Processing batch with ${ctx.blocks.length} blocks`, {
      blockRange: `${ctx.blocks[0]?.header.height} - ${ctx.blocks[ctx.blocks.length - 1]?.header.height}`,
    });

    const protocolStates = await this.initializeProtocolStates(ctx);

    for (const block of ctx.blocks) {
      logger.info(`Processing block ${block.header.height}`, {
        timestamp: new Date(block.header.timestamp).toISOString(),
      });
      await this.processBlock({ ctx, block, protocolStates });
    }

    await this.finalizeBatch(ctx, protocolStates);
  }

  private async initializeProtocolStates(ctx: any): Promise<Map<string, ProtocolStateUniv2>> {
    const protocolStates = new Map<string, ProtocolStateUniv2>();

    for (const protocol of this.protocols) {
      const contractAddress = protocol.contractAddress.toLowerCase();

      let poolConfig = await loadPoolConfigFromDb(ctx, contractAddress);
      let poolState = await loadPoolStateFromDb(ctx, contractAddress);
      let poolProcessState = await loadPoolProcessStateFromDb(ctx, contractAddress);
      let activeBalances = await loadActiveBalancesFromDb(ctx, contractAddress);

      if (!poolConfig?.id) {
        logger.info(
          `Pool config not found in DB for ${contractAddress}, checking if we can initialize`,
        );

        const initBlock = this.findInitializationBlock(ctx.blocks, protocol.fromBlock);

        if (initBlock) {
          poolConfig = await initPoolConfigIfNeeded(
            ctx,
            initBlock,
            contractAddress,
            poolConfig || new PoolConfig({}),
            protocol,
          );
        } else {
          logger.warn(
            `Cannot initialize ${contractAddress} - startBlock ${protocol.fromBlock} not in current batch (${ctx.blocks[0].header.height}-${ctx.blocks[ctx.blocks.length - 1].header.height})`,
          );
        }
      }

      if (!poolState?.id && poolConfig?.id) {
        const initBlock = this.findInitializationBlock(ctx.blocks, protocol.fromBlock);

        if (initBlock) {
          poolState = await initPoolStateIfNeeded(
            ctx,
            initBlock,
            contractAddress,
            poolState || new PoolState({}),
            poolConfig,
          );
        } else {
          logger.warn(
            `Cannot initialize pool state for ${contractAddress} - no suitable block found`,
          );
        }
      }

      if (!poolProcessState?.id) {
        poolProcessState = await initPoolProcessStateIfNeeded(
          contractAddress,
          poolConfig || new PoolConfig({}),
          poolProcessState || new PoolProcessState({}),
        );
      }

      protocolStates.set(contractAddress, {
        config: poolConfig || new PoolConfig({}),
        state: poolState || new PoolState({}),
        processState: poolProcessState || new PoolProcessState({}),
        activeBalances: activeBalances || new Map<string, ActiveBalance>(),
        balanceWindows: [],
        transactions: [],
      });
    }

    return protocolStates;
  }

  private findInitializationBlock(blocks: any[], startBlock: number): any | null {
    for (const block of blocks) {
      if (block.header.height >= startBlock) {
        return block;
      }
    }
    return null;
  }

  private async processBlock(batchContext: BatchContext): Promise<void> {
    const { ctx, block, protocolStates } = batchContext;

    for (const protocol of this.protocols) {
      const contractAddress = protocol.contractAddress.toLowerCase();
      const protocolState = protocolStates.get(contractAddress)!;

      try {
        if (
          protocolState.config.id &&
          protocolState.config.lpToken &&
          protocolState.config.token0 &&
          protocolState.config.token1
        ) {
          await this.processLogsForProtocol(ctx, block, contractAddress, protocol, protocolState);
          await this.processPeriodicBalanceFlush(ctx, block, protocolState);
        } else {
          logger.warn(`Skipping ${contractAddress} - config not properly initialized`);
        }
      } catch (error) {
        logger.error(
          `Error processing ${contractAddress} in block ${block.header.height}:`,
          (error as Error).message,
        );
      }
    }
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
      'ethereum',
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

  private async processTransferEvent(
    ctx: any,
    block: any,
    log: any,
    protocol: ProtocolConfig,
    protocolState: ProtocolStateUniv2,
  ): Promise<void> {
    const { from, to, value } = univ2Abi.events.Transfer.decode(log);

    const {
      price: lpTokenPrice,
      token0Price,
      token1Price,
      token0Value,
      token1Value,
      totalPoolValue,
      totalSupplyBig,
      reserve0,
      reserve1,
    } = await computeLpTokenPrice(
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
        value: {
          value: value.toString(),
          type: 'number',
        },
        lpTokenDecimals: {
          value: protocolState.config.lpToken.decimals.toString(),
          type: 'number',
        },
        token0Price: {
          value: token0Price.toString(),
          type: 'string',
        },
        token1Price: {
          value: token1Price.toString(),
          type: 'string',
        },
        token0Value: {
          value: token0Value.toString(),
          type: 'string',
        },
        token1Value: {
          value: token1Value.toString(),
          type: 'string',
        },
        totalPoolValue: {
          value: totalPoolValue.toString(),
          type: 'string',
        },
        totalSupplyBig: {
          value: totalSupplyBig.toString(),
          type: 'string',
        },
        reserve0: {
          value: reserve0.toString(),
          type: 'string',
        },
        reserve1: {
          value: reserve1.toString(),
          type: 'string',
        },
      },
      contractAddress: protocol.contractAddress,
    });

    protocolState.balanceWindows.push(...newHistoryWindows);
  }

  private async processPeriodicBalanceFlush(
    ctx: any,
    block: any,
    protocolState: ProtocolStateUniv2,
  ): Promise<void> {
    const currentTs = block.header.timestamp;

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
          const {
            price: lpTokenPrice,
            token0Price,
            token1Price,
            token0Value,
            token1Value,
            totalPoolValue,
            totalSupplyBig,
            reserve0,
            reserve1,
          } = await computeLpTokenPrice(
            ctx,
            block,
            protocolState.config,
            protocolState.state,
            this.env.coingeckoApiKey,
            currentTs,
          );

          const lpTokenSwapUsdValue = pricePosition(
            lpTokenPrice,
            data.balance,
            protocolState.config.lpToken.decimals,
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
            tokenPrice: lpTokenPrice,
            tokenDecimals: protocolState.config.lpToken.decimals,
            balanceBefore: data.balance.toString(),
            balanceAfter: data.balance.toString(),
            txHash: null,
            currency: Currency.USD,
            valueUsd: lpTokenSwapUsdValue,
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
              value: {
                value: '0',
                type: 'number',
              },
              lpTokenDecimals: {
                value: protocolState.config.lpToken.decimals.toString(),
                type: 'number',
              },
              token0Price: {
                value: token0Price.toString(),
                type: 'string',
              },
              token1Price: {
                value: token1Price.toString(),
                type: 'string',
              },
              token0Value: {
                value: token0Value.toString(),
                type: 'string',
              },
              token1Value: {
                value: token1Value.toString(),
                type: 'string',
              },
              totalPoolValue: {
                value: totalPoolValue.toString(),
                type: 'string',
              },
              totalSupplyBig: {
                value: totalSupplyBig.toString(),
                type: 'string',
              },
              reserve0: {
                value: reserve0.toString(),
                type: 'string',
              },
              reserve1: {
                value: reserve1.toString(),
                type: 'string',
              },
            },
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
    logger.info('Finalizing batch...');

    for (const protocol of this.protocols) {
      const protocolState = protocolStates.get(protocol.contractAddress.toLowerCase())!;

      // Skip if config is not properly initialized
      if (
        !protocolState.config.id ||
        !protocolState.config.token0 ||
        !protocolState.config.token1 ||
        !protocolState.config.lpToken
      ) {
        logger.warn(
          `Skipping finalize for ${protocol.contractAddress.toLowerCase()} - config not properly initialized`,
        );
        continue;
      }

      const balances = toTimeWeightedBalance(
        protocolState.balanceWindows,
        { ...protocol, type: this.protocolType },
        this.env,
        this.chainConfig,
      );
      const transactions = toTransaction(
        protocolState.transactions,
        { ...protocol, type: this.protocolType },
        this.env,
        this.chainConfig,
      );

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
          id: `${protocol.contractAddress.toLowerCase()}-active-balances`,
          activeBalancesMap: mapToJson(protocolState.activeBalances),
        }),
      );
    }
  }
}
