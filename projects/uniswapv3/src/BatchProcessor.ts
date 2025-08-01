import { TypeormDatabase } from '@subsquid/typeorm-store';
import { processor } from './processor';
import { EntityManager } from './utils/entityManager';
import { processFactory } from './mappings/factory';
import { processPositions } from './mappings/positionManager';

import { createHash } from 'crypto';
import {
  AbsintheApiClient,
  Chain,
  Currency,
  HistoryWindow,
  MULTICALL_ADDRESS_HEMI,
  TimeWindowTrigger,
  toTimeWeightedBalance,
  toTransaction,
  Transaction,
  ValidatedEnvBase,
} from '@absinthe/common';
import { PositionStorageService } from './services/PositionStorageService';
import { PositionTracker } from './services/PositionTracker';
import { ContextWithEntityManager, PositionData } from './utils/interfaces/univ3Types';
import { BlockData, BlockHeader } from '@subsquid/evm-processor';
import { logger } from '@absinthe/common';
import { getOptimizedTokenPrices } from './utils/pricing';
import { BigDecimal } from '@subsquid/big-decimal';
import { getAmountsForLiquidityRaw } from './utils/liquidityMath';

interface ProtocolStateUniswapV3 {
  balanceWindows: HistoryWindow[];
  transactions: Transaction[];
}

export class UniswapV3Processor {
  private readonly uniswapV3DexProtocol: any;
  private readonly schemaName: string;
  private readonly refreshWindow: number;
  private readonly apiClient: AbsintheApiClient;
  private readonly env: ValidatedEnvBase;
  private readonly chainConfig: Chain;
  private readonly factoryAddress: string;
  private readonly positionsAddress: string;
  private readonly multicallAddress: string;
  private positionStorageService: PositionStorageService;
  private positionTracker: PositionTracker;

  constructor(
    uniswapV3DexProtocol: any,
    refreshWindow: number,
    apiClient: AbsintheApiClient,
    env: ValidatedEnvBase,
    chainConfig: Chain,
  ) {
    this.refreshWindow = refreshWindow;
    this.apiClient = apiClient;
    this.env = env;
    this.chainConfig = chainConfig;
    this.uniswapV3DexProtocol = uniswapV3DexProtocol;
    this.schemaName = this.generateSchemaName();
    this.factoryAddress = uniswapV3DexProtocol.factoryAddress;
    this.positionsAddress = uniswapV3DexProtocol.positionsAddress;
    this.multicallAddress = MULTICALL_ADDRESS_HEMI;
    this.positionStorageService = new PositionStorageService();
    this.positionTracker = new PositionTracker(this.positionStorageService, this.refreshWindow);
  }

  private generateSchemaName(): string {
    const uniquePoolCombination = this.uniswapV3DexProtocol.factoryAddress.concat(
      this.chainConfig.networkId.toString(),
    );

    const hash = createHash('md5').update(uniquePoolCombination).digest('hex').slice(0, 8);
    return `uniswapv3-${hash}`;
  }

  private async initializeProtocolStates(): Promise<Map<string, ProtocolStateUniswapV3>> {
    const protocolStates = new Map<string, ProtocolStateUniswapV3>();
    const poolAddresses = this.uniswapV3DexProtocol.pools.map((pool: any) =>
      pool.contractAddress.toLowerCase(),
    );
    for (const poolAddress of poolAddresses) {
      protocolStates.set(poolAddress, {
        balanceWindows: [],
        transactions: [],
      });
    }

    return protocolStates;
  }

  //todo: add the prefetch step over here, and we can then also add the processPair function in this file only.
  //todo: we can first process all the ctx.blocks in one go for the position Events, and we would store all the things in memory, we would not process the events in this step
  //todo: then when we will do each block processing, we would just use this from the memory and then process the events, and clear these events from the memory.
  async run(): Promise<void> {
    processor.run(
      new TypeormDatabase({ supportHotBlocks: false, stateSchema: this.schemaName }),
      async (ctx) => {
        const batchStartTime = Date.now();

        const entities = new EntityManager(ctx.store);
        const entitiesCtx = { ...ctx, entities };
        const protocolStates = await this.initializeProtocolStates();
        logger.info(`blocks length: ${ctx.blocks.length}`);
        if (ctx.blocks.length > 0) {
          const firstBlock = ctx.blocks[0].header.height;
          const lastBlock = ctx.blocks[ctx.blocks.length - 1].header.height;

          logger.info(
            `📦 BATCH RANGE: Block ${firstBlock} → ${lastBlock} (${ctx.blocks.length} blocks)`,
          );
          logger.info(
            `📅 TIME RANGE: ${new Date(ctx.blocks[0].header.timestamp).toISOString()} → ${new Date(ctx.blocks[ctx.blocks.length - 1].header.timestamp).toISOString()}`,
          );

          // Optional: Log each block for detailed debugging
          logger.info(
            `📋 BLOCK DETAILS: ${ctx.blocks.map((b) => `#${b.header.height}`).join(', ')}`,
          );
        }
        //process all blocks for factory in one go
        logger.info('🏭 Starting factory processing for all blocks');
        const factoryStartTime = Date.now();

        await processFactory(
          entitiesCtx,
          ctx.blocks,
          this.factoryAddress,
          this.positionStorageService,
        );

        logger.info(`🏭 Factory processing completed in ${Date.now() - factoryStartTime}ms`);

        logger.info('🔄 Starting individual block processing');

        for (const block of ctx.blocks) {
          const blockStartTime = Date.now();
          logger.info(
            `📋 Processing block #${block.header.height} (${new Date(block.header.timestamp).toISOString()})`,
          );

          await this.processBlock(
            entitiesCtx,
            block,
            this.positionStorageService,
            this.positionTracker,
            protocolStates,
          );

          logger.info(
            `✅ Block #${block.header.height} processed in ${Date.now() - blockStartTime}ms`,
          );
        }

        logger.info('🎯 Starting batch finalization');
        const finalizeStartTime = Date.now();
        await this.finalizeBatch(entitiesCtx, protocolStates);
        logger.info(`🎯 Batch finalization completed in ${Date.now() - finalizeStartTime}ms`);

        logger.info(`🏁 Batch processing completed in ${Date.now() - batchStartTime}ms`);
      },
    );
  }

  private async processBlock(
    entitiesCtx: ContextWithEntityManager,
    block: BlockData,
    positionStorageService: PositionStorageService,
    positionTracker: PositionTracker,

    protocolStates: Map<string, ProtocolStateUniswapV3>,
  ): Promise<void> {
    logger.info(`🎯 Starting processBlock for #${block.header.height}`);
    const eventCount = block.logs.length;
    logger.info(`📊 Block #${block.header.height} contains ${eventCount} events`);

    const positionsStartTime = Date.now();

    await processPositions(
      entitiesCtx,
      block,
      positionTracker,
      positionStorageService,
      this.chainConfig.chainName.toLowerCase(),
      this.env.coingeckoApiKey,
      this.positionsAddress,
      this.factoryAddress,
      this.multicallAddress,
      protocolStates,
    );

    logger.info(
      `🎯 Position processing for block #${block.header.height} completed in ${Date.now() - positionsStartTime}ms`,
    );

    // await processPairs(
    //   entitiesCtx,
    //   block,
    //   positionTracker,
    //   positionStorageService,
    //   protocolStates,
    //   this.chainConfig.chainName.toLowerCase(),
    //   this.env.coingeckoApiKey,
    // );

    const flushStartTime = Date.now();
    await this.processPeriodicBalanceFlush(
      entitiesCtx,
      block,
      protocolStates,
      positionStorageService,
    );
    logger.info(
      `🔄 Periodic balance flush for block #${block.header.height} completed in ${Date.now() - flushStartTime}ms`,
    );
  }

  private async processPeriodicBalanceFlush(
    ctx: ContextWithEntityManager,
    block: BlockData,
    protocolStates: Map<string, ProtocolStateUniswapV3>,
    positionStorageService: PositionStorageService,
  ): Promise<void> {
    logger.info(`🔄 Starting periodic balance flush for block #${block.header.height}`);

    let totalProcessedPositions = 0;
    let totalExhaustedPositions = 0;

    for (const [contractAddress, protocolState] of protocolStates.entries()) {
      logger.info(`🔍 Processing pool: ${contractAddress}`);
      const positionsByPoolId =
        await positionStorageService.getAllPositionsByPoolId(contractAddress);

      logger.info(`🔍 Positions by pool id: ${positionsByPoolId.length}`);
      if (positionsByPoolId.length === 0) {
        logger.info(`⚪ No positions found for pool: ${contractAddress}`);

        continue;
      }

      let processedPositions = 0;
      let exhaustedPositions = 0;

      for (const position of positionsByPoolId) {
        const beforeBalanceWindows = protocolState.balanceWindows.length;
        logger.info(`🔍 Checking position ${position.positionId} for exhaustion`);

        if (position.isActive === 'true') {
          await this.processPositionExhaustion(
            position,
            block.header,
            positionStorageService,
            protocolStates,
          );
        } else {
          logger.info(`⚪ Skipping inactive position ${position.positionId}`);
        }

        const afterBalanceWindows = protocolState.balanceWindows.length;
        const windowsCreated = afterBalanceWindows - beforeBalanceWindows;

        if (windowsCreated > 0) {
          exhaustedPositions++;
          logger.info(
            `⚡ Position ${position.positionId} created ${windowsCreated} exhaustion windows`,
          );
        }

        processedPositions++;
      }
      logger.info(
        `📊 Pool ${contractAddress}: ${processedPositions} positions processed, ${exhaustedPositions} exhausted`,
      );
      totalProcessedPositions += processedPositions;
      totalExhaustedPositions += exhaustedPositions;
    }

    logger.info(
      `🎯 Periodic balance flush completed: ${totalProcessedPositions} positions processed, ${totalExhaustedPositions} exhausted`,
    );
  }

  private async processPositionExhaustion(
    position: PositionData,
    block: BlockHeader,
    positionStorageService: PositionStorageService,
    protocolStates: Map<string, ProtocolStateUniswapV3>,
  ): Promise<void> {
    const currentTs = block.timestamp;

    if (!position.lastUpdatedBlockTs) {
      logger.info(`⚪ Position ${position.positionId} has no lastUpdatedBlockTs, adding it`);
      position.lastUpdatedBlockTs = currentTs;
      await positionStorageService.updatePosition(position);
      return;
    }

    while (
      position.lastUpdatedBlockTs &&
      Number(position.lastUpdatedBlockTs) + this.refreshWindow <= currentTs
    ) {
      const windowsSinceEpoch = Math.floor(
        Number(position.lastUpdatedBlockTs) / this.refreshWindow,
      );
      const nextBoundaryTs: number = (windowsSinceEpoch + 1) * this.refreshWindow;

      const token0 = await this.positionStorageService.getToken(position.token0Id);
      const token1 = await this.positionStorageService.getToken(position.token1Id);
      if (!token0 || !token1) {
        logger.warn(`❌ Skipping position ${position.positionId} - missing token data:`, {
          token0Exists: !!token0,
          token0Id: position.token0Id,
        });
        return;
      }
      const liquidity = BigInt(position.liquidity);

      const { humanAmount0: oldHumanAmount0, humanAmount1: oldHumanAmount1 } =
        getAmountsForLiquidityRaw(
          liquidity,
          position.tickLower,
          position.tickUpper,
          position.currentTick,
          token0.decimals,
          token1.decimals,
        );

      const [token0inUSD, token1inUSD] = await getOptimizedTokenPrices(
        position.poolId,
        token0,
        token1,
        block,
        this.env.coingeckoApiKey,
        this.chainConfig.chainName.toLowerCase(),
      );

      logger.info(`🔍 Token0 in USD: ${token0inUSD}`);
      logger.info(`🔍 Token1 in USD: ${token1inUSD}`);

      const oldLiquidityUSD =
        Number(oldHumanAmount0) * token0inUSD + Number(oldHumanAmount1) * token1inUSD;
      logger.info(`🔍 Old Liquidity in USD: ${oldLiquidityUSD}`, {
        oldHumanAmount0,
        oldHumanAmount1,
        token0inUSD,
        token1inUSD,
      });

      logger.info(`🔍 Position lastUpdatedBlockTs: ${position.lastUpdatedBlockTs}`);
      logger.info(`🔍 Next boundary Ts: ${nextBoundaryTs}`);

      if (oldLiquidityUSD > 0 && position.lastUpdatedBlockTs < nextBoundaryTs) {
        const balanceWindow = {
          userAddress: position.owner,
          deltaAmount: 0,
          trigger: TimeWindowTrigger.EXHAUSTED,
          startTs: position.lastUpdatedBlockTs,
          endTs: nextBoundaryTs,
          windowDurationMs: this.refreshWindow,
          startBlockNumber: position.lastUpdatedBlockHeight,
          endBlockNumber: block.height,
          txHash: null,
          currency: Currency.USD,
          valueUsd: 0,
          balanceBefore: oldLiquidityUSD.toString(),
          balanceAfter: oldLiquidityUSD.toString(),
          tokenPrice: 0,
          tokenDecimals: 0,
          tokens: {
            isActive: {
              value: 'true',
              type: 'boolean',
            },
            currentTick: {
              value: position.currentTick.toString(),
              type: 'number',
            },
            tickLower: {
              value: position.tickLower.toString(),
              type: 'number',
            },
            tickUpper: {
              value: position.tickUpper.toString(),
              type: 'number',
            },
            liquidity: {
              value: position.liquidity.toString(),
              type: 'number',
            },
            token0Id: {
              value: position.token0Id,
              type: 'string',
            },
            token1Id: {
              value: position.token1Id,
              type: 'string',
            },
          },
        };

        const poolState = protocolStates.get(position.poolId);

        if (poolState) {
          poolState.balanceWindows.push(balanceWindow);
        } else {
          protocolStates.set(position.poolId, {
            balanceWindows: [balanceWindow],
            transactions: [],
          });
        }

        logger.info(
          `✅ Created balance window for position ${position.positionId}: ${JSON.stringify(balanceWindow)}`,
        );
      } else {
        logger.info(
          `⚪ Skipping balance window creation for position ${position.positionId} (active: ${position.isActive}, liquidity: ${position.liquidity})`,
        );
      }
      position.lastUpdatedBlockTs = nextBoundaryTs;
      position.lastUpdatedBlockHeight = block.height;

      await positionStorageService.updatePosition(position);
      logger.info(
        `📝 Updated position ${position.positionId} with new timestamp: ${nextBoundaryTs}`,
      );
    }
  }

  private async finalizeBatch(
    ctx: ContextWithEntityManager,
    protocolStates: Map<string, ProtocolStateUniswapV3>,
  ): Promise<void> {
    logger.info('🎯 Starting batch finalization');

    let totalBalanceWindows = 0;
    let totalTransactions = 0;

    for (const pool of this.uniswapV3DexProtocol.pools) {
      logger.info(`🔍 Finalizing pool: ${pool.contractAddress}`);

      const protocolState = protocolStates.get(pool.contractAddress);
      if (!protocolState) {
        logger.info(`⚪ No protocol state found for pool: ${pool.contractAddress}`);
        continue;
      }

      logger.info(
        `📊 Pool ${pool.contractAddress}: ${protocolState.balanceWindows.length} balance windows, ${protocolState.transactions.length} transactions`,
      );

      const balances = toTimeWeightedBalance(
        protocolState.balanceWindows,
        { ...pool, type: this.uniswapV3DexProtocol.type },
        this.env,
        this.chainConfig,
      );

      const transactions = toTransaction(
        protocolState.transactions,
        { ...pool, type: this.uniswapV3DexProtocol.type },
        this.env,
        this.chainConfig,
      );

      logger.info(
        `📤 Sending ${balances.length} balance records and ${transactions.length} transaction records for pool ${pool.contractAddress}`,
      );
      logger.info('📋 Balance data:', JSON.stringify(balances, null, 2));
      logger.info('📋 Transaction data:', JSON.stringify(transactions, null, 2));

      try {
        if (balances.length > 0) {
          await this.apiClient.send(balances);
          logger.info(
            `✅ Successfully sent ${balances.length} balance records for pool ${pool.contractAddress}`,
          );
        }
      } catch (error) {
        logger.error(`❌ Failed to send balance records for pool ${pool.contractAddress}:`, error);
      }

      try {
        if (transactions.length > 0) {
          await this.apiClient.send(transactions);
          logger.info(
            `✅ Successfully sent ${transactions.length} transaction records for pool ${pool.contractAddress}`,
          );
        }
      } catch (error) {
        logger.error(
          `❌ Failed to send transaction records for pool ${pool.contractAddress}:`,
          error,
        );
      }

      totalBalanceWindows += balances.length;
      totalTransactions += transactions.length;
    }

    logger.info(
      `🎉 Batch finalization completed: ${totalBalanceWindows} total balance windows, ${totalTransactions} total transactions sent`,
    );
  }
}
