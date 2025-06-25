import { AbsintheApiClient, validateEnv, HOURS_TO_MS } from '@absinthe/common';

const env = validateEnv();

const apiClient = new AbsintheApiClient({
  baseUrl: env.baseConfig.absintheApiUrl,
  apiKey: env.baseConfig.absintheApiKey,
  minTime: 90, // warn: remove this, it's temporary for testing
});

//todo: fix this - array
const uniswapV3DexProtocol = env.univ3Protocols[0];

if (!uniswapV3DexProtocol) {
  throw new Error('Uniswap V3 protocol not found');
}

const chainConfig = {
  chainArch: uniswapV3DexProtocol.chainArch,
  networkId: uniswapV3DexProtocol.chainId,
  chainShortName: uniswapV3DexProtocol.chainShortName,
  chainName: uniswapV3DexProtocol.chainName,
};

// todo: make the contract address lowercase throughout the codebase

const WINDOW_DURATION_MS = env.baseConfig.balanceFlushIntervalHours * HOURS_TO_MS;
// const uniswapProcessor = new UniswapV3Processor(
//   uniswapV3DexProtocol,
//   WINDOW_DURATION_MS,
//   apiClient,
//   env.baseConfig,
//   chainConfig,
// );
// uniswapProcessor.run();

import { TypeormDatabase } from '@subsquid/typeorm-store';
import { processor } from './processor';
import { EntityManager } from './utils/entityManager';
import { processFactory } from './mappings/factory';
import { processPairs } from './mappings/core';
import { processPositions } from './mappings/positionManager';

import { Bundle, Factory, Pool, Position, Tick, Token, Tx } from './model';

processor.run(
  new TypeormDatabase({ supportHotBlocks: false, stateSchema: 'univ3-1' }),
  async (ctx) => {
    const entities = new EntityManager(ctx.store);
    const entitiesCtx = { ...ctx, entities };

    await processFactory(entitiesCtx, ctx.blocks);
    await processPairs(entitiesCtx, ctx.blocks);

    // await processPositions(entitiesCtx, ctx.blocks);

    await ctx.store.save(entities.values(Bundle));
    await ctx.store.save(entities.values(Factory));
    await ctx.store.save(entities.values(Token));
    await ctx.store.save(entities.values(Pool));
    await ctx.store.save(entities.values(Tick));
    await ctx.store.insert(entities.values(Tx));
    await ctx.store.save(entities.values(Position));
  },
);
