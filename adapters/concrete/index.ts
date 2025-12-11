// New registry imports
import { Manifest, evmAddress } from '../../src/types/manifest.ts';
import { metadata } from './metadata.ts';

import * as concreteAbi from './abi/concrete.ts';

// Handlers
import { handleVault } from './vault.ts';
import { handleVaultDeposit } from './deposit.ts';
import { AdapterDef, defineAdapter } from '../_shared/index.ts';

// Feed handlers
import { concreteFeed } from './feeds/concrete.ts';

// Initialization handler
import { initializeVaults } from './initVaults.ts';

export const manifest: Manifest = {
  name: 'concrete',
  version: '0.0.1',
  chainArch: 'evm',
  trackables: {
    vaults: {
      kind: 'position',
      quantityType: 'token_based',
      params: {
        vaultAddress: evmAddress('The vault contract address to track'),
      },
      requiredPricer: concreteFeed,
    },
  },
};

export default defineAdapter({
  manifest,
  metadata,
  build: ({ config }) => {
    // Collect all vault addresses from both vaultDeposits and vaults configs
    const vaultAddress = new Set(
      [
        ...(config.vaultDeposits?.map((vault) => vault.params.vaultDepositAddress as string) || []),
        ...(config.vaults?.map((vault) => vault.params.vaultAddress as string) || []),
      ].filter((addr): addr is string => addr != null),
    );

    // define topics
    const transferTopic = concreteAbi.events.Transfer.topic;

    return {
      buildSqdProcessor: (base) =>
        base.addLog({
          address: Array.from(vaultAddress),
          topic0: [transferTopic],
        }),
      onInit: async ({ rpcCtx, redis }) => {
        // Initialize vault metadata from config before processing events
        await initializeVaults(vaultAddress, rpcCtx, redis);
      },
      onLog: async ({ log, emitFns, sqdRpcCtx, redis }) => {
        const address = log.address;

        if (log.topic0 === transferTopic) {
          // const depositInstances =
          //   config.vaultDeposits?.filter((s) => s.params.vaultDepositAddress === address) || [];

          // for (const instance of depositInstances) {
          //   await handleVaultDeposit(log, emitFns, instance, address, redis, sqdRpcCtx);
          // }

          // Handle vault positions (ongoing balance tracking)
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
