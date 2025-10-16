// New registry imports
import { Manifest, evmAddress } from '../../src/types/manifest.ts';
import { metadata } from './metadata.ts';

import * as factoryAbi from './abi/morphofactoryv1.ts';
import * as moprhov1Vaults from './abi/morphov1vaults.ts';

// Handlers
import { handleVault } from './vault.ts';
import { handleCreateMetaMorphoFactory } from './createMetaMorpho.ts';
import { AdapterDef, defineAdapter } from '../_shared/index.ts';

// Feed handlers
import { morphov1vaultsFeed } from './feeds/morphov1vaults.ts';

export const manifest: Manifest = {
  name: 'morpho-vaultsv1',
  version: '0.0.1',
  chainArch: 'evm',
  trackables: {
    vaults: {
      kind: 'position',
      quantityType: 'token_based',
      params: {
        vaultAddress: evmAddress('The vault contract address to track'),
      },
      requiredPricer: morphov1vaultsFeed,
    },
    createMetaMorphoFactory: {
      kind: 'action',
      quantityType: 'none',
      params: {
        factoryAddress: evmAddress('The factory contract address to track'),
      },
    },
  },
};

export default defineAdapter({
  manifest,
  metadata,
  build: ({ config }) => {
    // Collect all pool addresses from both swap and lp configs into a single array
    const factoryAddress = new Set([
      ...config.createMetaMorphoFactory.map((factory) => factory.params.factoryAddress as string),
    ]);

    const vaultAddress = new Set([
      ...config.vaults.map((vault) => vault.params.vaultAddress as string),
    ]);

    // define topics
    const createMetaMorphoTopic = factoryAbi.events.CreateMetaMorpho.topic;
    const transferTopic = moprhov1Vaults.events.Transfer.topic;

    return {
      buildSqdProcessor: (base) =>
        base
          .addLog({
            address: Array.from(factoryAddress),
            topic0: [createMetaMorphoTopic],
          })
          .addLog({
            address: Array.from(vaultAddress),
            topic0: [transferTopic],
          }),
      onLog: async ({ log, emitFns, sqdRpcCtx, redis }) => {
        const address = log.address;

        if (log.topic0 === createMetaMorphoTopic) {
          const createMetaMorphoFactoryInstances =
            config.createMetaMorphoFactory?.filter((b) => b.params.factoryAddress === address) ||
            [];

          for (const instance of createMetaMorphoFactoryInstances) {
            await handleCreateMetaMorphoFactory(
              log,
              emitFns,
              instance,
              vaultAddress,
              redis,
              sqdRpcCtx,
            );
          }
        }

        if (log.topic0 === transferTopic) {
          const vaultInstances =
            config.vaults?.filter((s) => s.params.vaultAddress === address) || [];

          for (const instance of vaultInstances) {
            await handleVault(log, emitFns, instance, address, redis, sqdRpcCtx);
          }
        }
      },
    };
  },
});
