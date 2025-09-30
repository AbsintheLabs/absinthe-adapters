// New registry imports
import { defineAdapter } from '../../src/adapter-core.ts';
import { Manifest, evmAddress } from '../../src/types/manifest.ts';

// Uniswap V2 ABI imports
import * as univ2Abi from './abi/uniswap-v2.ts';

/* what to pass in into the handler? would be ideal to minimize dependency to sqd and other data structures
- log.address
- log.eventName
- blockheight
- timestamp
- transactionHash
- decoded log data
- instances (so we can filter on them properly)
- redis (for storage)
- emit (the proper emit functions for the handler. ex: don't get access to balanceDelta if we're not a lp handler)
- rpc? allows us to make calls if necessary against the contract

handler should have:
- unified event type (includes all the fields about it, like address, blockheight, etc. should it also have decoded log data?)
- Trackable Instance (singular instance that is matched)
- emit (the proper emit functions for the handler. ex: don't get access to balanceDelta if we're not a lp handler)
- redis (stateful computation)
- rpc (for now, will be the sqd object. will change this to a more general interface later)
*/

export const manifest = {
  name: 'uniswap-v2',
  version: '0.0.1',
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
      onLog: async ({ block, log, emitFns, rpcCtx, redis }) => {
        const poolAddr = log.address.toLowerCase();
        const topic = log.topics[0];

        // Handle Transfer events (LP position changes)
        if (topic === transferTopic) {
          const lpInstances = config.lp.filter((l) => l.params.poolAddress === poolAddr);

          if (lpInstances.length > 0) {
            const decoded = univ2Abi.events.Transfer.decode(log);
            // TODO: Handle LP transfer with emitFns.position.balanceDelta()
          }
        }

        // Handle Swap events (swap actions)
        if (topic === swapTopic) {
          const swapInstances = config.swap.filter((s) => s.params.poolAddress === poolAddr);

          if (swapInstances.length > 0) {
            const decoded = univ2Abi.events.Swap.decode(log);
            // TODO: Handle swap with emitFns.action.swap()
          }
        }
      },
    };
  },
});
