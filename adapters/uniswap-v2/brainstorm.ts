// New registry imports
import { defineAdapter } from '../../src/adapter-core.ts';
import { Manifest, evmAddress } from '../../src/types/manifest.ts';

// handlers
import { handleLpTransfer } from './lp.ts';
import { handleSwap } from './swap.ts';

// Uniswap V2 ABI imports
import * as univ2Abi from './abi/uniswap-v2.ts';

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
      filters: {
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

// fixme: this needs to be cleaned up and adjusted for later!
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
// function createHandlerContext(
//   { block, log, emit, rpcCtx: rpc, redis, instances },
//   decodedData,
//   instanceType,
// ) {
//   return {
//     event: {
//       address: log.address.toLowerCase(),
//       blockNumber: block.header.height,
//       timestamp: block.header.timestamp,
//       txHash: log.transactionHash,
//       data: decodedData,
//     },
//     instances: instances[instanceType].filter(
//       (inst) => inst.params.poolAddress.toLowerCase() === log.address.toLowerCase(),
//     ),
//     redis,
//     rpc,
//     emit,
//   };
// }

export default defineAdapter({
  manifest,
  handlers: {
    swap: handleSwap,
    lp: handleLpTransfer,
  },
  build: ({ manifest, config }) => {
    // Collect all pool addresses from both swap and lp configs into a single array
    const poolAddrs = new Set([
      ...config.swap.map((swap) => swap.params.poolAddress),
      ...config.lp.map((lp) => lp.params.poolAddress),
    ]);

    const transferTopic = univ2Abi.events.Transfer.topic;
    const swapTopic = univ2Abi.events.Swap.topic;

    return {
      manifest,
      handlers: { swap: handleSwap, lp: handleLpTransfer },
      buildProcessor: (base) =>
        base.addLog({
          address: Array.from(poolAddrs),
          topic0: [transferTopic, swapTopic],
        }),
      onLog: async ({ block, log, emit, rpcCtx: rpc, redis, instances }) => {
        const pool = log.address.toLowerCase();
        const topic = log.topics[0];

        if (topic == transferTopic) {
          const context = createHandlerContext(
            { block, log, emit, rpcCtx: rpc, redis, instances },
            null,
            'lp',
          );
          await handleLpTyped();
        }

        if (topic == swapTopic) {
          const context = createHandlerContext(
            { block, log, emit, rpcCtx: rpc, redis, instances },
            null,
            'swap',
          );
          await handleSwapTyped();
        }
      },
    };
  },
});
