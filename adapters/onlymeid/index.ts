// Registry imports
import { metadata } from './metadata.ts';
import { manifest } from './manifest.ts';

// OnlyMeID ABI imports
import * as onlyMeIdAbi from './abi-types/demos.ts';

// Shared imports
import { md5Hash } from '../_shared/index.ts';
import { defineAdapter } from '../_shared/index.ts';

export default defineAdapter({
  manifest,
  metadata,
  build: ({ config }) => {
    // Get the single OnlyMeID contract address (only one instance expected)
    const onlyMeIdAddress = config.verify[0].params.onlyMeIdAddress;

    // Get the userVerify function signature
    const userVerifySighash = onlyMeIdAbi.functions.userVerify.sighash;

    return {
      buildSqdProcessor: (base) =>
        base.addTransaction({
          to: [onlyMeIdAddress],
          sighash: [userVerifySighash],
        }),

      onTransaction: async ({ transaction, emitFns }) => {
        const { transactionTo: to, transactionFrom: user, txRef, index } = transaction;
        // Safety check - ensure transaction is to our tracked contract
        if (!to || to !== onlyMeIdAddress) return;
        await emitFns.action.action({
          key: md5Hash(`${txRef}${index}`),
          user,
          activity: 'verify',
          trackableInstance: config.verify[0],
        });
      },
    };
  },
});
