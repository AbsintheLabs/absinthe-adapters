// New registry imports
import { Manifest, evmAddress } from '../../src/types/manifest.ts';
import { metadata } from './metadata.ts';

// Uniswap V3 ABI imports
import * as univ3factoryAbi from './abi-types/univ3factory.ts';
import * as univ3poolAbi from './abi-types/univ3pool.ts';
import * as univ3positionsAbi from './abi-types/univ3nonfungiblepositionmanager.ts';

// Handlers
import { handleSwap } from './swap.ts';
import { handleLpTransfer } from './lp-transfer.ts';
import { handleIncreaseLiquidity } from './lp-increase.ts';
import { handleDecreaseLiquidity } from './lp-decrease.ts';
import { defineAdapter } from '../_shared/index.ts';

export const manifest = {
  name: 'uniswap-v3',
  version: '0.0.1',
  chainArch: 'evm',
  trackables: {
    swap: {
      kind: 'action',
      quantityType: 'token_based',
      params: {
        factoryAddress: evmAddress('The Uniswap V3 factory address'),
        nonFungiblePositionManagerAddress: evmAddress(
          'The Uniswap V3 NonFungiblePositionManager address',
        ),
      },
      assetSelectors: {
        // Swaps need assetSelectors: each pool has 2 tokens, we need to specify which one to price
        swapLegAddress: evmAddress('The token0 or token1 address to price'),
      },
    },
    lp: {
      kind: 'position',
      quantityType: 'token_based',
      params: {
        factoryAddress: evmAddress('The Uniswap V3 factory address'),
        nonFungiblePositionManagerAddress: evmAddress(
          'The Uniswap V3 NonFungiblePositionManager address',
        ),
      },
      // Note: No assetSelectors needed - the NFT tokenId uniquely identifies the position
      // The pricing strategy (requiredPricer: 'univ3lp') will handle the pool's token0/token1 internally
      requiredPricer: 'univ3lp',
    },
  },
} as const satisfies Manifest;

export default defineAdapter({
  manifest,
  metadata,
  build: ({ config }) => {
    // Collect factory addresses from both swap and lp configs
    const factoryAddrs = new Set([
      ...config.swap.map((swap) => swap.params.factoryAddress),
      ...config.lp.map((lp) => lp.params.factoryAddress),
    ]);

    // Collect NFPM addresses from both swap and lp configs
    const nfpmAddrs = new Set([
      ...config.swap.map((swap) => swap.params.nonFungiblePositionManagerAddress),
      ...config.lp.map((lp) => lp.params.nonFungiblePositionManagerAddress),
    ]);

    // Define topics
    const poolCreatedTopic = univ3factoryAbi.events.PoolCreated.topic;
    const transferTopic = univ3positionsAbi.events.Transfer.topic;
    const increaseLiquidityTopic = univ3positionsAbi.events.IncreaseLiquidity.topic;
    const decreaseLiquidityTopic = univ3positionsAbi.events.DecreaseLiquidity.topic;
    const swapTopic = univ3poolAbi.events.Swap.topic;

    // Redis keys for indexing
    const POOL_INDEX_KEY = 'factory:pools';

    return {
      buildSqdProcessor: (base) => {
        let processor = base;

        // Always add pool created events
        processor = processor.addLog({
          address: Array.from(factoryAddrs),
          topic0: [poolCreatedTopic],
        });

        // Add LP position events if any lp instances are configured
        if (config.lp.length > 0) {
          processor = processor.addLog({
            address: Array.from(nfpmAddrs),
            topic0: [transferTopic, increaseLiquidityTopic, decreaseLiquidityTopic],
          });
        }

        // Add swap events if any swap instances are configured
        if (config.swap.length > 0) {
          processor = processor.addLog({
            // Fetch ALL swap events and filter for the ones specific to our factory contracts later
            topic0: [swapTopic],
          });
        }

        return processor;
      },

      onLog: async ({ log, emitFns, sqdRpcCtx, redis }) => {
        // POOL CREATED EVENT
        if (log.topic0 === poolCreatedTopic) {
          const { pool, token0, token1 } = univ3factoryAbi.events.PoolCreated.decode(log);
          const poolAddress = pool.toLowerCase();
          await redis.sadd(POOL_INDEX_KEY, poolAddress);

          // Store token addresses for the pool
          const poolTokenKey = `pool:${poolAddress}:tokens`;
          await redis.hset(poolTokenKey, {
            token0: token0.toLowerCase(),
            token1: token1.toLowerCase(),
          } as any);
        }

        // SWAP EVENT
        if (log.topic0 === swapTopic) {
          // First check if the pool is one created by our factory contract
          const isPoolCreatedByFactory = await redis.sismember(
            POOL_INDEX_KEY,
            log.address.toLowerCase(),
          );
          if (!isPoolCreatedByFactory) {
            // Not a pool created by our factory contract, so we shouldn't track it
            return;
          }

          const decoded = univ3poolAbi.events.Swap.decode(log);
          const pool = log.address.toLowerCase();

          // Get swap instances for this factory
          const swapInstances = config.swap.filter((s) => {
            // Check if any of our tracked factories created this pool
            return factoryAddrs.has(s.params.factoryAddress);
          });

          // Fan out to handle each instance separately
          for (const instance of swapInstances) {
            // Get token addresses from Redis
            const poolTokenKey = `pool:${pool}:tokens`;
            const poolTokens = await redis.hgetall(poolTokenKey);

            if (poolTokens && poolTokens.token0 && poolTokens.token1) {
              await handleSwap(
                log,
                emitFns,
                instance,
                poolTokens.token0,
                poolTokens.token1,
                decoded,
              );
            }
          }
        }

        // LP POSITION EVENTS
        // Handle IncreaseLiquidity events
        if (log.topic0 === increaseLiquidityTopic) {
          const lpInstances = config.lp.filter(
            (lp) => lp.params.nonFungiblePositionManagerAddress === log.address.toLowerCase(),
          );

          for (const instance of lpInstances) {
            await handleIncreaseLiquidity(log, emitFns, instance, redis, sqdRpcCtx);
          }
        }

        // Handle DecreaseLiquidity events
        if (log.topic0 === decreaseLiquidityTopic) {
          const lpInstances = config.lp.filter(
            (lp) => lp.params.nonFungiblePositionManagerAddress === log.address.toLowerCase(),
          );

          for (const instance of lpInstances) {
            await handleDecreaseLiquidity(log, emitFns, instance, redis, sqdRpcCtx);
          }
        }

        // Handle Transfer events (NFT LP token transfers)
        if (log.topic0 === transferTopic) {
          const lpInstances = config.lp.filter(
            (lp) => lp.params.nonFungiblePositionManagerAddress === log.address.toLowerCase(),
          );

          for (const instance of lpInstances) {
            await handleLpTransfer(log, emitFns, instance, redis, sqdRpcCtx);
          }
        }
      },
    };
  },
});
