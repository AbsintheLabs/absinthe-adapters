// Registry imports
import { Manifest, evmAddress } from '../../src/types/manifest.ts';
import { metadata } from './metadata.ts';
import Big from 'big.js';

// Protocol ABI imports
import * as erc20Abi from './abi-types/erc20.ts';

// Handler imports
import { defineAdapter } from '../_shared/index.ts';

export const manifest = {
  name: 'erc20-holdings',
  version: '0.0.1',
  chainArch: 'evm',
  trackables: {
    token: {
      kind: 'position',
      quantityType: 'token_based',
      params: {
        contractAddress: evmAddress('The contract address to track'),
      },
    },
  },
} as const satisfies Manifest;

export default defineAdapter({
  manifest,
  metadata,
  build: ({ config }) => {
    const contractAddresses = new Set([...config.token.map((item) => item.params.contractAddress)]);
    const transferTopic = erc20Abi.events.Transfer.topic;

    return {
      buildSqdProcessor: (base) =>
        base.addLog({
          address: Array.from(contractAddresses),
          topic0: [transferTopic],
        }),

      /**
       * onLog: Process each matching log event
       *
       * This is the hot path - runs for every matching event.
       * Use emitFns to output Balance/Measure/Action/Reprice events.
       * Use redis for caching data you need across events.
       * Use sqdRpcCtx for making contract calls (expensive - cache results!).
       */
      onLog: async ({ log, emitFns }) => {
        const { from, to, value } = erc20Abi.events.Transfer.decode(log);
        const assetAddress = log.address;
        const instance = config.token?.find((t) => t.params.contractAddress === assetAddress);
        if (!instance) return;

        await emitFns.position.balanceDelta({
          user: from,
          asset: assetAddress,
          amount: -value,
          activity: 'hold',
          trackableInstance: instance,
        });
        await emitFns.position.balanceDelta({
          user: to,
          asset: assetAddress,
          amount: value,
          activity: 'hold',
          trackableInstance: instance,
        });
      },
    };
  },
});
