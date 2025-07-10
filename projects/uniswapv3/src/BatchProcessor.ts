import { TypeormDatabase } from '@subsquid/typeorm-store';
import { processor } from './processor';
import { EntityManager } from './utils/entityManager';
import { processFactory } from './mappings/factory';
import { processPairs } from './mappings/core';
import { processPositions } from './mappings/positionManager';

import { createHash } from 'crypto';
import {
  AbsintheApiClient,
  Chain,
  Currency,
  HistoryWindow,
  TimeWindowTrigger,
  toTimeWeightedBalance,
  toTransaction,
  Transaction,
  ValidatedEnvBase,
} from '@absinthe/common';
import { PositionStorageService } from './services/PositionStorageService';
import { PositionTracker } from './services/PositionTracker';
import { ContextWithEntityManager, PositionData } from './utils/interfaces/univ3Types';
import { BlockData } from '@subsquid/evm-processor';

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
    console.log('poolAddresses', poolAddresses);
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
        const entities = new EntityManager(ctx.store);
        const entitiesCtx = { ...ctx, entities };
        const positionStorageService = new PositionStorageService();
        const positionTracker = new PositionTracker(positionStorageService, this.refreshWindow);
        const protocolStates = await this.initializeProtocolStates();

        //process all blocks for factory in one go
        await processFactory(entitiesCtx, ctx.blocks, positionStorageService);

        for (const block of ctx.blocks) {
          console.log('processing block', block.header.height);
          await this.processBlock(
            entitiesCtx,
            block,
            positionStorageService,
            positionTracker,
            protocolStates,
          );
        }

        await this.finalizeBatch(entitiesCtx, protocolStates);
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
      this.env.coingeckoApiKey,
      protocolStates,
    );
    // await processPairs(entitiesCtx, block, positionTracker, positionStorageService, protocolStates);

    await this.processPeriodicBalanceFlush(
      entitiesCtx,
      block,
      protocolStates,
      positionStorageService,
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

      let processedPositions = 0;
      let exhaustedPositions = 0;

      for (const position of positionsByPoolId) {
        const beforeBalanceWindows = protocolState.balanceWindows.length;

        await this.processPositionExhaustion(
          position,
          block,
          protocolState,
          positionStorageService,
        );

        const afterBalanceWindows = protocolState.balanceWindows.length;
        const windowsCreated = afterBalanceWindows - beforeBalanceWindows;

        if (windowsCreated > 0) {
          exhaustedPositions++;
        }

        processedPositions++;
      }
    }
  }

  private async processPositionExhaustion(
    position: PositionData,
    block: any,
    protocolState: ProtocolStateUniswapV3,
    positionStorageService: PositionStorageService,
  ): Promise<void> {
    const currentTs = block.header.timestamp;
    const currentBlockHeight = block.header.height;

    console.log(`🔍 Exhaustion check for position ${position.positionId}:`);
    console.log(`   - Current timestamp: ${currentTs}`);
    console.log(`   - Current block height: ${currentBlockHeight}`);
    console.log(`   - Last updated timestamp: ${position.lastUpdatedBlockTs}`);
    console.log(`   - Refresh window: ${this.refreshWindow}ms`);

    if (!position.lastUpdatedBlockTs) {
      console.log(
        `⚠️ Position ${position.positionId} has no lastUpdatedBlockTs, skipping exhaustion`,
      );
      return;
    }

    const timeSinceLastUpdate = Number(currentTs) - Number(position.lastUpdatedBlockTs);
    console.log(`⏰ Time since last update: ${timeSinceLastUpdate}ms`);

    if (timeSinceLastUpdate < this.refreshWindow) {
      console.log(
        `⏭️ Position ${position.positionId} doesn't need exhaustion (${timeSinceLastUpdate}ms < ${this.refreshWindow}ms)`,
      );
      return;
    }

    let exhaustionCount = 0;

    while (
      position.lastUpdatedBlockTs &&
      Number(position.lastUpdatedBlockTs) + this.refreshWindow < currentTs
    ) {
      const windowsSinceEpoch = Math.floor(
        Number(position.lastUpdatedBlockTs) / this.refreshWindow,
      );
      const nextBoundaryTs: number = (windowsSinceEpoch + 1) * this.refreshWindow;

      console.log(
        `🔄 Exhaustion iteration ${exhaustionCount + 1} for position ${position.positionId}:`,
      );
      console.log(`   - Windows since epoch: ${windowsSinceEpoch}`);
      console.log(`   - Next boundary timestamp: ${nextBoundaryTs}`);
      console.log(`   - Time window: ${position.lastUpdatedBlockTs} → ${nextBoundaryTs}`);

      if (position.isActive === 'true' && BigInt(position.liquidity) > 0n) {
        console.log(`✅ Creating balance window for active position ${position.positionId}`);

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
          valueUsd: Number(position.liquidity), // TODO: Calculate USD value
          balanceBefore: position.liquidity,
          balanceAfter: position.liquidity,
          tokenPrice: 0, // TODO: Calculate token price
          tokenDecimals: 0, // TODO: Get from position
        };

        protocolState.balanceWindows.push(balanceWindow);
        console.log(`📊 Balance window created: ${JSON.stringify(balanceWindow, null, 2)}`);
      } else {
        console.log(
          `⏭️ Skipping balance window for position ${position.positionId} (inactive or zero liquidity)`,
        );
      }

      const oldTimestamp = position.lastUpdatedBlockTs;
      const oldBlockHeight = position.lastUpdatedBlockHeight;

      position.lastUpdatedBlockTs = nextBoundaryTs;
      position.lastUpdatedBlockHeight = block.height;

      console.log(`🔄 Updated position ${position.positionId}:`);
      console.log(`   - Timestamp: ${oldTimestamp} → ${position.lastUpdatedBlockTs}`);
      console.log(`   - Block height: ${oldBlockHeight} → ${position.lastUpdatedBlockHeight}`);

      await positionStorageService.updatePosition(position);
      console.log(`💾 Position ${position.positionId} updated in storage`);

      exhaustionCount++;
    }

    if (exhaustionCount > 0) {
      console.log(
        `🎉 Position ${position.positionId} exhaustion completed: ${exhaustionCount} iterations`,
      );
    } else {
      console.log(`⏭️ Position ${position.positionId} no exhaustion iterations needed`);
    }
  }

  private async finalizeBatch(
    ctx: ContextWithEntityManager,
    protocolStates: Map<string, ProtocolStateUniswapV3>,
  ): Promise<void> {
    for (const pool of this.uniswapV3DexProtocol.pools) {
      const protocolState = protocolStates.get(pool.contractAddress);
      console.log(protocolState, 'protocolState');
      if (!protocolState) continue;
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
      await this.apiClient.send(balances);
      await this.apiClient.send(transactions);
    }
  }
}
