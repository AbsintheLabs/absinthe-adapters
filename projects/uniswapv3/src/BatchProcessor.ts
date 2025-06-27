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
  HistoryWindow,
  toTimeWeightedBalance,
  toTransaction,
  Transaction,
  ValidatedEnvBase,
} from '@absinthe/common';
import { PositionStorageService } from './services/PositionStorageService';
import { PositionTracker } from './services/PositionTracker';

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

    const positionsAddress = this.uniswapV3DexProtocol.positionsAddress;

    //todo: this is in my process memory
    protocolStates.set(positionsAddress, {
      balanceWindows: [],
      transactions: [],
    });

    return protocolStates;
  }

  async run(): Promise<void> {
    //todo: confirm with andrew will this ever be realtime ??
    processor.run(
      new TypeormDatabase({ supportHotBlocks: false, stateSchema: this.schemaName }),
      async (ctx) => {
        const entities = new EntityManager(ctx.store);
        const entitiesCtx = { ...ctx, entities };
        const positionStorageService = new PositionStorageService();
        const positionTracker = new PositionTracker(positionStorageService, this.refreshWindow);
        const protocolStates = await this.initializeProtocolStates();
        await processFactory(entitiesCtx, ctx.blocks, positionStorageService);
        await processPositions(
          entitiesCtx,
          ctx.blocks,
          positionTracker,
          positionStorageService,
          this.env.coingeckoApiKey,
          protocolStates,
        );
        await processPairs(
          entitiesCtx,
          ctx.blocks,
          positionTracker,
          positionStorageService,
          protocolStates,
        );

        await this.finalizeBatch(entitiesCtx, protocolStates);

        // await ctx.store.save(entities.values(Bundle));
        // await ctx.store.save(entities.values(Factory));
        // await ctx.store.save(entities.values(Token));
        // await ctx.store.save(entities.values(Pool));
        // await ctx.store.save(entities.values(Tick));
        // await ctx.store.insert(entities.values(Tx));
        // await ctx.store.save(entities.values(Position));
      },
    );
  }

  private async finalizeBatch(
    ctx: any,
    protocolStates: Map<string, ProtocolStateUniswapV3>,
  ): Promise<void> {
    for (const pool of this.uniswapV3DexProtocol.pools) {
      const protocolState = protocolStates.get(pool.contractAddress);
      console.log(protocolState, 'protocolState');
      if (!protocolState) continue;

      //todo: tell rollan to update the schema with the latest enums, as its possible this doesn't go through
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
