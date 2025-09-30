// New registry imports
import { defineAdapter } from '../../src/adapter-core.ts';
import { Manifest, evmAddress } from '../../src/types/manifest.ts';
import Big from 'big.js';
import { metadata } from './metadata.ts';

// Uniswap V2 ABI imports
import * as univ2Abi from './abi/uniswap-v2.ts';

// Utils
import { md5Hash } from '../_shared/index.ts';

export const manifest = {
  name: 'uniswap-v2',
  version: '0.0.1',
  chainArch: 'evm',
  trackables: {
    swap: {
      kind: 'action',
      quantityType: 'token_based',
      params: {
        poolAddress: evmAddress('The pool address used to see all occurences of the swap.'),
      },
      selectors: {
        swapLegAddress: {
          ...evmAddress('The token0 or token1 address used to price the swap.'),
          requiredForPricing: true,
        },
      },
    },
    lp: {
      kind: 'position',
      quantityType: 'token_based',
      params: {
        poolAddress: evmAddress('The pool address used to see all occurences of the lp.'),
      },
      requiredPricer: 'univ2nav',
    },
  },
} as const satisfies Manifest;

export default defineAdapter({
  manifest,
  metadata,
  build: ({ config, io }) => {
    // Collect all pool addresses from both swap and lp configs into a single array
    const poolAddrs = new Set([
      ...config.swap.map((swap) => swap.params.poolAddress),
      ...config.lp.map((lp) => lp.params.poolAddress),
    ]);

    const transferTopic = univ2Abi.events.Transfer.topic;
    const swapTopic = univ2Abi.events.Swap.topic;

    return {
      buildProcessor: (base) =>
        base.addLog({
          address: Array.from(poolAddrs),
          topic0: [transferTopic, swapTopic],
        }),
      onLog: async ({ log, emitFns, rpcCtx, redis }) => {
        const poolAddr = log.address;
        const topic = log.topics[0];

        // Cache token addresses for this pool
        const token0Key = `univ2:${poolAddr}:token0`;
        const token1Key = `univ2:${poolAddr}:token1`;
        let tk0Addr = await redis.get(token0Key);
        let tk1Addr = await redis.get(token1Key);

        if (!tk0Addr || !tk1Addr) {
          const poolContract = new univ2Abi.Contract(rpcCtx, poolAddr);
          tk0Addr = (await poolContract.token0()).toLowerCase();
          tk1Addr = (await poolContract.token1()).toLowerCase();
          await redis.set(token0Key, tk0Addr);
          await redis.set(token1Key, tk1Addr);
        }

        // Handle Transfer events (LP position changes)
        if (topic === transferTopic) {
          const lpInstances = config.lp?.filter((l) => l.params.poolAddress === poolAddr) || [];

          if (lpInstances.length > 0) {
            const decoded = univ2Abi.events.Transfer.decode({
              topics: log.topics,
              data: log.data,
            });

            // Emit balance deltas for LP token transfers
            await emitFns.position.balanceDelta({
              user: decoded.from.toLowerCase(),
              asset: poolAddr,
              amount: new Big(decoded.value.toString()).neg(),
              activity: 'hold',
            });

            await emitFns.position.balanceDelta({
              user: decoded.to.toLowerCase(),
              asset: poolAddr,
              amount: new Big(decoded.value.toString()),
              activity: 'hold',
            });
          }
        }

        // Handle Swap events (swap actions)
        if (topic === swapTopic) {
          const swapInstances = config.swap?.filter((s) => s.params.poolAddress === poolAddr) || [];

          if (swapInstances.length > 0) {
            const decoded = univ2Abi.events.Swap.decode({
              topics: log.topics,
              data: log.data,
            });

            const isToken0ToToken1 = decoded.amount0In > 0n;

            // Get the amounts
            const fromAmount = isToken0ToToken1 ? decoded.amount0In : decoded.amount1In;
            const toAmount = isToken0ToToken1 ? decoded.amount1Out : decoded.amount0Out;

            // Get token addresses
            const fromTokenAddress = isToken0ToToken1 ? tk0Addr : tk1Addr;
            const toTokenAddress = isToken0ToToken1 ? tk1Addr : tk0Addr;

            // Get the user from the unified log
            const user = log.transactionFrom;
            if (!user) {
              io.log('Warning: transaction.from is not found in the log.', { log });
              return;
            }

            // Format the swap metadata
            const swapMeta = {
              fromTkAddress: fromTokenAddress,
              toTkAddress: toTokenAddress,
              fromTkAmount: fromAmount.toString(),
              toTkAmount: toAmount.toString(),
            };

            // Emit swap action for both sides (from and to tokens)
            await emitFns.action.swap({
              key: md5Hash(`${log.transactionHash}${log.logIndex}`),
              priceable: true,
              activity: 'swap',
              user: user,
              amount: {
                asset: fromTokenAddress,
                amount: new Big(fromAmount.toString()),
              },
              meta: swapMeta,
            });

            await emitFns.action.swap({
              key: md5Hash(`${log.transactionHash}${log.logIndex}`),
              priceable: true,
              activity: 'swap',
              user: user,
              amount: {
                asset: toTokenAddress,
                amount: new Big(toAmount.toString()),
              },
              meta: swapMeta,
            });
          }
        }
      },
    };
  },
});
