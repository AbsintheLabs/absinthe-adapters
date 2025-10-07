// New registry imports
import { Manifest, evmAddress } from '../../src/types/manifest.ts';
import { metadata } from './metadata.ts';

// Uniswap V2 ABI imports
import * as univ2Abi from './abi/uniswap-v2.ts';

// Handlers
import { handleSwap } from './swap.ts';
import { handleLpTransfer } from './lp.ts';
import { defineAdapter } from '../_shared/index.ts';

export const manifest = {
  name: 'uniswap-v2',
  version: '0.0.1',
  chainArch: 'evm',
  trackables: {
    swap: {
      kind: 'action',
      quantityType: 'token_based',
      params: {
        poolAddress: evmAddress('The pool address to track'),
      },
      assetSelectors: {
        // Swaps need assetSelectors: the pool has 2 tokens, we need to specify which one to price
        swapLegAddress: evmAddress('The token0 or token1 address to price'),
      },
    },
    lp: {
      kind: 'position',
      quantityType: 'token_based',
      params: {
        // For UniV2 LP, the pool address uniquely identifies the LP token
        // No assetSelectors needed - params alone are sufficient
        poolAddress: evmAddress('The pool address to track'),
      },
      requiredPricer: 'univ2nav',
    },
  },
} as const satisfies Manifest;

export default defineAdapter({
  manifest,
  metadata,
  build: ({ config }) => {
    // Collect all pool addresses from both swap and lp configs into a single array
    const poolAddrs = new Set([
      ...config.swap.map((swap) => swap.params.poolAddress),
      ...config.lp.map((lp) => lp.params.poolAddress),
    ]);

    // define topics
    const transferTopic = univ2Abi.events.Transfer.topic;
    const swapTopic = univ2Abi.events.Swap.topic;

    return {
      buildSqdProcessor: (base) =>
        base.addLog({
          address: Array.from(poolAddrs),
          topic0: [transferTopic, swapTopic],
        }),
      onLog: async ({ log, emitFns, sqdRpcCtx, redis }) => {
        const poolAddr = log.address;

        // Cache token addresses for this pool
        const token0Key = `univ2:${poolAddr}:token0`;
        const token1Key = `univ2:${poolAddr}:token1`;
        let tk0Addr = await redis.get(token0Key);
        let tk1Addr = await redis.get(token1Key);

        if (!tk0Addr || !tk1Addr) {
          try {
            const poolContract = new univ2Abi.Contract(sqdRpcCtx, poolAddr);
            tk0Addr = (await poolContract.token0()).toLowerCase();
            tk1Addr = (await poolContract.token1()).toLowerCase();
            await redis.set(token0Key, tk0Addr);
            await redis.set(token1Key, tk1Addr);
          } catch (error) {
            throw new Error(
              `Failed to fetch token addresses for pool ${poolAddr}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }

        // Handle Transfer events (LP position changes)
        if (log.topic0 === transferTopic) {
          const lpInstances = config.lp?.filter((l) => l.params.poolAddress === poolAddr) || [];

          // Fan out to handle each instance separately
          for (const instance of lpInstances) {
            await handleLpTransfer(log, emitFns, instance, poolAddr);
          }
        }

        // Handle Swap events (swap actions)
        if (log.topic0 === swapTopic) {
          const swapInstances = config.swap?.filter((s) => s.params.poolAddress === poolAddr) || [];

          // Fan out to handle each instance separately
          for (const instance of swapInstances) {
            await handleSwap(log, emitFns, instance, tk0Addr, tk1Addr);
          }
        }
      },
    };
  },
});
