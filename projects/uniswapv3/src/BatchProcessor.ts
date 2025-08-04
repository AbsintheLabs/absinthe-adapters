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
  MULTICALL_ADDRESS,
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
    this.multicallAddress = MULTICALL_ADDRESS;
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

        await processFactory(
          entitiesCtx,
          ctx.blocks,
          this.factoryAddress,
          this.positionStorageService,
        );

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
    for (const [contractAddress, protocolState] of protocolStates.entries()) {
      const positionsByPoolId =
        await positionStorageService.getAllPositionsByPoolId(contractAddress);

      if (positionsByPoolId.length === 0) {
        continue;
      }

      for (const position of positionsByPoolId) {
        if (position.isActive === 'true') {
          await this.processPositionExhaustion(
            position,
            block.header,
            positionStorageService,
            protocolStates,
          );
        }
      }
    }
  }

  private async processPositionExhaustion(
    position: PositionData,
    block: BlockHeader,
    positionStorageService: PositionStorageService,
    protocolStates: Map<string, ProtocolStateUniswapV3>,
  ): Promise<void> {
    const currentTs = block.timestamp;

    if (!position.lastUpdatedBlockTs) {
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

      const oldLiquidityUSD =
        Number(oldHumanAmount0) * token0inUSD + Number(oldHumanAmount1) * token1inUSD;

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
      }

      position.lastUpdatedBlockTs = nextBoundaryTs;
      position.lastUpdatedBlockHeight = block.height;

      await positionStorageService.updatePosition(position);
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

      try {
        if (balances.length > 0) {
          await this.apiClient.send(balances);
        }
      } catch (error) {
        logger.error(`❌ Failed to send balance records for pool ${pool.contractAddress}:`, error);
      }

      try {
        if (transactions.length > 0) {
          await this.apiClient.send(transactions);
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
