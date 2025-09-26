// common imports
import z from 'zod';

// Uniswap V2 ABI imports
import * as univ2Abi from './abi/uniswap-v2.ts';

// New registry imports
import { registerAdapter } from '../_shared/index.ts';
// utils
import { ZodEvmAddress, md5Hash } from '../_shared/index.ts';

// handlers
import { handleLpTransfer } from './lp.ts';

const manifest = {
  name: 'uniswap-v2',
  semver: '0.0.1',
  trackables: [
    {
      itemId: 'swap',
      kind: 'action',
      quantityType: 'token_based',
      params: [
        {
          role: 'poolAddress',
          description: 'The pool address to track swap events for',
        },
      ],
      filters: [
        {
          role: 'swapLegAddress',
          requiredForPricing: true,
          description:
            'If provided, only this token leg will be marked as priceable (both legs still emitted for audit)',
        },
      ],
    },
    {
      itemId: 'lp',
      kind: 'position',
      quantityType: 'token_based',
      params: [
        {
          role: 'poolAddress',
          description: 'The pool address to track LP token transfers for',
        },
      ],
      requiredPricer: 'univ2nav',
    },
  ],
} as const;

export default registerAdapter({
  // @deprecated fields!!!
  name: 'uniswap-v2',
  semver: '0.0.1',
  schema: z.object(),
  // ---------------------
  // start of true adapter definition
  manifest,
  build: ({ params }) => {
    // Event topics from the Uniswap V2 ABI
    const transferTopic = univ2Abi.events.Transfer.topic;
    const swapTopic = univ2Abi.events.Swap.topic;

    return {
      buildProcessor: (base) =>
        base.addLog({
          address: [params.poolAddress],
          topic0: [transferTopic, swapTopic],
        }),
      onLog: async ({ block, log, emit, rpcCtx: rpc, redis, instances }) => {
        const pool = log.address.toLowerCase();
        const topic = log.topics[0];

        // Find instances for this pool
        const poolInstances = instances.filter((i) => i.params.poolAddress.toLowerCase() === pool);
        if (poolInstances.length === 0) return;

        // Handle transfers (LP events)
        if (topic === transferTopic) {
          const lpInstances = poolInstances.filter((i) => i.itemId === 'lp');
          if (lpInstances.length === 0) return;

          const decoded = univ2Abi.events.Transfer.decode(log);
          await Promise.all(lpInstances.map((inst) => handleLpTransfer(inst, decoded)));
        }

        // Handle swaps
        if (topic === swapTopic) {
          const swapInstances = poolInstances.filter((i) => i.itemId === 'swap');
          if (swapInstances.length === 0) return;

          const decoded = univ2Abi.events.Swap.decode(ctx.log);
          await Promise.all(swapInstances.map((inst) => handleSwap(ctx, inst, decoded)));
        }
      },
    };
  },
});
