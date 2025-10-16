// New registry imports
import { Manifest, evmAddress, stringField } from '../../src/types/manifest.ts';
import { metadata } from './metadata.ts';
import * as moprhov1MarketsAbi from './abi/morphov1.ts';

// Handlers
import { handleMarket } from './market.ts';
import { handleCreateMetaMorphoFactory } from './createMarket.ts';
import { AdapterDef, defineAdapter } from '../_shared/index.ts';
import { morphomarketsFeed } from './feeds/morphomarkets.ts';

//todo: we can work on to modify the context as well.
export const manifest: Manifest = {
  name: 'morpho-markets',
  version: '0.0.1',
  chainArch: 'evm',
  trackables: {
    morphoblue: {
      kind: 'position',
      quantityType: 'token_based',
      params: {
        morphoBlueAddress: evmAddress('The morpho blue address to track'),
      },
      assetSelectors: {
        marketId: stringField('The market id to track'),
      },
      requiredPricer: morphomarketsFeed,
    },
  },
};

export default defineAdapter({
  manifest,
  metadata,
  build: ({ config }) => {
    const morphoBlueAddress = new Set([
      ...config.morphoblue.map((vault) => vault.params.morphoBlueAddress as string),
    ]);

    const marketIds = new Set([
      ...config.morphoblue.map((morphoblue) => morphoblue.params.marketId as string),
    ]);

    // define topics
    const createMarketTopic = moprhov1MarketsAbi.events.CreateMarket.topic;
    const supplyTopic = moprhov1MarketsAbi.events.Supply.topic;
    const withdrawTopic = moprhov1MarketsAbi.events.Withdraw.topic;
    const borrowTopic = moprhov1MarketsAbi.events.Borrow.topic;
    const repayTopic = moprhov1MarketsAbi.events.Repay.topic;

    return {
      buildSqdProcessor: (base) =>
        base.addLog({
          address: Array.from(morphoBlueAddress),
          topic0: [createMarketTopic, supplyTopic, withdrawTopic, borrowTopic, repayTopic],
        }),
      onLog: async ({ log, emitFns, sqdRpcCtx, redis }) => {
        const address = log.address;

        if (log.topic0 === createMarketTopic) {
          const createMarketInstances =
            config.morphoblue?.filter((b) => b.params.morphoBlueAddress === address) || [];

          for (const instance of createMarketInstances) {
            await handleCreateMetaMorphoFactory(
              log,
              emitFns,
              instance,
              marketIds,
              redis,
              sqdRpcCtx,
            );
          }
        }

        if (
          log.topic0 === supplyTopic ||
          log.topic0 === withdrawTopic ||
          log.topic0 === borrowTopic ||
          log.topic0 === repayTopic
        ) {
          const morphoblueInstances =
            config.morphoblue?.filter((s) => s.params.morphoBlueAddress === address) || [];

          for (const instance of morphoblueInstances) {
            await handleMarket(log, emitFns, instance, address, redis, sqdRpcCtx);
          }
        }
      },
    };
  },
});
