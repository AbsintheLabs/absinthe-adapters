import { metadata } from './metadata.ts';
import { manifest } from './manifest.ts';

// Protocol ABI imports
import * as erc20Abi from './abi-types/erc20.ts';

// Handler imports
import { defineAdapter } from '../_shared/index.ts';

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

      onLog: async ({ log, emitFns }) => {
        const { from, to, value } = erc20Abi.events.Transfer.decode(log);
        const assetAddress = log.address;
        const instance = config.token?.find((t) => t.params.contractAddress === assetAddress);
        if (!instance) return;

        //note - this is a temporary (not adding logger.info intentionally)
        console.log('Indexer Updated in Railway');

        await emitFns.position.balanceDelta({
          user: from,
          asset: { type: 'erc20', address: assetAddress },
          amount: -value,
          activity: 'hold',
          trackableInstance: instance,
        });
        await emitFns.position.balanceDelta({
          user: to,
          asset: { type: 'erc20', address: assetAddress },
          amount: value,
          activity: 'hold',
          trackableInstance: instance,
        });
      },
    };
  },
});
