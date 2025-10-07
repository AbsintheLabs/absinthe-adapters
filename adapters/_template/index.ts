// Registry imports
import { Manifest, evmAddress } from '../../src/types/manifest.ts';
import { metadata } from './metadata.ts';

// Protocol ABI imports
// import * as protocolAbi from './abi/protocol.ts';

// Handler imports
// import { handleEventA } from './event-a.ts';
// import { handleEventB } from './event-b.ts';
import { defineAdapter } from '../_shared/index.ts';

/**
 * MANIFEST
 *
 * Define your trackables here. Each trackable represents a distinct thing you want to track:
 * - kind: 'action' for one-time events (swaps, claims, bridges) or 'position' for ongoing holdings (LP tokens, staking)
 * - quantityType: 'token_based' (standard tokens) or 'synthetic' (custom metrics)
 * - params: Required fields that uniquely identify what to track
 * - assetSelectors: Optional fields used when a single trackable can represent multiple assets
 * - requiredPricer: (optional) If this trackable needs a custom pricer
 */
export const manifest = {
  name: 'protocol-name',
  version: '0.0.1',
  chainArch: 'evm',
  trackables: {
    // Example: Action trackable (e.g., swap, claim, bridge)
    actionExample: {
      kind: 'action',
      quantityType: 'token_based',
      params: {
        // Required params that identify the action context
        contractAddress: evmAddress('The contract address to track'),
      },
      assetSelectors: {
        // Optional selectors when you need to specify which asset within the context
        // tokenAddress: evmAddress('The specific token address'),
      },
    },

    // Example: Position trackable (e.g., LP token, staking position)
    positionExample: {
      kind: 'position',
      quantityType: 'token_based',
      params: {
        // Required params that uniquely identify the position
        contractAddress: evmAddress('The contract address to track'),
      },
      // assetSelectors: {} // Add if needed
      // requiredPricer: 'custom-pricer-name', // Add if this position needs special pricing
    },
  },
} as const satisfies Manifest;

export default defineAdapter({
  manifest,
  metadata,
  build: ({ config }) => {
    /**
     * BUILD PHASE
     *
     * This runs once at startup. Use it to:
     * 1. Collect addresses/params from config
     * 2. Build lookup maps for efficient runtime processing
     * 3. Define event topics you want to listen to
     */

    // Example: Collect all addresses from config trackables
    const contractAddresses = new Set([
      ...config.actionExample.map((item) => item.params.contractAddress),
      ...config.positionExample.map((item) => item.params.contractAddress),
    ]);

    // Define event topics you want to listen for
    // const eventATopic = protocolAbi.events.EventA.topic;
    // const eventBTopic = protocolAbi.events.EventB.topic;

    return {
      /**
       * buildProcessor: Define which logs/transactions to subscribe to
       * The base processor builder lets you add filters for logs, transactions, traces, etc.
       */
      buildSqdProcessor: (base) =>
        base.addLog({
          address: Array.from(contractAddresses),
          topic0: [
            // eventATopic,
            // eventBTopic,
          ],
        }),

      /**
       * onLog: Process each matching log event
       *
       * This is the hot path - runs for every matching event.
       * Use emitFns to output Balance/Measure/Action/Reprice events.
       * Use redis for caching data you need across events.
       * Use sqdRpcCtx for making contract calls (expensive - cache results!).
       */
      onLog: async ({ log, emitFns, sqdRpcCtx, redis }) => {
        const contractAddr = log.address;

        /**
         * PATTERN: Redis caching for contract state
         * Cache expensive RPC calls (token addresses, decimals, etc.)
         */
        // const cacheKey = `protocol:${contractAddr}:someData`;
        // let cachedValue = await redis.get(cacheKey);

        // if (!cachedValue) {
        //   try {
        //     const contract = new protocolAbi.Contract(sqdRpcCtx, contractAddr);
        //     cachedValue = await contract.someMethod();
        //     await redis.set(cacheKey, cachedValue);
        //   } catch (error) {
        //     throw new Error(
        //       `Failed to fetch data for contract ${contractAddr}: ${error instanceof Error ? error.message : String(error)}`,
        //     );
        //   }
        // }

        /**
         * PATTERN: Route by event type
         * Check which event this is and route to appropriate handler
         */
        // if (log.topic0 === eventATopic) {
        //   // Get matching config instances for this contract
        //   const instances = config.actionExample?.filter(
        //     (item) => item.params.contractAddress === contractAddr
        //   ) || [];
        //
        //   // Fan out: handle each config instance separately
        //   for (const instance of instances) {
        //     await handleEventA(log, emitFns, instance, cachedValue);
        //   }
        // }

        // if (log.topic0 === eventBTopic) {
        //   const instances = config.positionExample?.filter(
        //     (item) => item.params.contractAddress === contractAddr
        //   ) || [];
        //
        //   for (const instance of instances) {
        //     await handleEventB(log, emitFns, instance);
        //   }
        // }
      },
    };
  },
});
