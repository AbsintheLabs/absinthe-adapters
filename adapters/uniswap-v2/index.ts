// common imports
import z from 'zod';
import Big from 'big.js';

// Uniswap V2 ABI imports
import * as univ2Abi from './abi/uniswap-v2.ts';

// New registry imports
import { registerAdapter } from '../_shared/index.ts';
// utils
import { ZodEvmAddress, EVM_NULL_ADDRESS, md5Hash } from '../_shared/index.ts';

export default registerAdapter({
  name: 'uniswap-v2',
  semver: '0.0.1',
  schema: z
    .object({
      // Pool address for the Uniswap V2 pair
      poolAddress: ZodEvmAddress,
      // Toggle for swap event tracking
      trackSwaps: z.boolean().optional(),
      // Toggle for LP (liquidity provision) event tracking
      trackLP: z.boolean().optional(),
    })
    .refine((params) => !!params.trackSwaps || !!params.trackLP, {
      message: 'At least one of trackSwaps or trackLP must be enabled',
      path: ['trackSwaps', 'trackLP'],
    }),
  build: ({ params }) => {
    // Event topics from the Uniswap V2 ABI
    const transferTopic = univ2Abi.events.Transfer.topic;
    const swapTopic = univ2Abi.events.Swap.topic;
    // const mintTopic = univ2Abi.events.Mint.topic;
    // const burnTopic = univ2Abi.events.Burn.topic;
    // const syncTopic = univ2Abi.events.Sync.topic;

    return {
      buildProcessor: (base) =>
        base.addLog({
          address: [params.poolAddress],
          topic0: [transferTopic, swapTopic],
        }),
      onLog: async ({ block, log, emit, rpcCtx: rpc, redis }) => {
        // Handle LP token transfers (when LP tracking is enabled)
        // Try to get token0 and token1 addresses from redis cache
        const token0Key = `univ2:${params.poolAddress}:token0`;
        const token1Key = `univ2:${params.poolAddress}:token1`;
        let tk0Addr = await redis.get(token0Key);
        let tk1Addr = await redis.get(token1Key);

        if (!tk0Addr || !tk1Addr) {
          const poolContract = new univ2Abi.Contract(rpc, params.poolAddress);
          tk0Addr = (await poolContract.token0()).toLowerCase();
          tk1Addr = (await poolContract.token1()).toLowerCase();
          await redis.set(token0Key, tk0Addr);
          await redis.set(token1Key, tk1Addr);
        }

        // LP
        if (params.trackLP && log.topics[0] === transferTopic) {
          const { from, to, value } = univ2Abi.events.Transfer.decode(log);

          if (from !== EVM_NULL_ADDRESS) {
            await emit.balanceDelta({
              user: from,
              asset: params.poolAddress,
              amount: new Big(value.toString()).neg(),
              activity: 'hold',
            });
          }
          if (to !== EVM_NULL_ADDRESS) {
            await emit.balanceDelta({
              user: to,
              asset: params.poolAddress,
              amount: new Big(value.toString()),
              activity: 'hold',
            });
          }
        }

        // SWAP
        if (params.trackSwaps && log.topics[0] === swapTopic) {
          const { sender, amount0In, amount1In, amount0Out, amount1Out, to } =
            univ2Abi.events.Swap.decode(log);
          const isToken0ToToken1 = amount0In > 0n ? true : false;

          // Get the amounts
          const fromAmount = isToken0ToToken1 ? amount0In : amount1In;
          const toAmount = isToken0ToToken1 ? amount1Out : amount0Out;

          // Get token addresses (you'll need these from your pool/pair contract)
          const fromTokenAddress = isToken0ToToken1 ? tk0Addr : tk1Addr;
          const toTokenAddress = isToken0ToToken1 ? tk1Addr : tk0Addr;

          // step 1: get the user as the tx.from
          const user = log.transaction?.from;
          if (!user) {
            console.error('Debug: transaction.from is not found in the log.', {
              log,
              transaction: log.transaction,
            });
            throw new Error('transaction.from is not found in the log.');
          }

          // step 2: format the swap metadata
          const swapMeta = {
            fromTkAddress: fromTokenAddress,
            toTkAddress: toTokenAddress,
            fromTkAmount: fromAmount.toString(),
            toTkAmount: toAmount.toString(),
          };

          // step 3: emit swap action for each token
          // from side
          await emit.swap({
            // make sure to dedupe the duplicate swaps, we only need to save one!
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

          await emit.swap({
            // make sure to dedupe the duplicate swaps, we only need to save one!
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

        // Handle Sync events (reserve updates)
        // if (log.topics[0] === syncTopic) {
        //   const { reserve0, reserve1 } = univ2Abi.events.Sync.decode(log);
        //   // This could trigger repricing logic
        //   // await emit.reprice();
        // }
      },
    };
  },
});
