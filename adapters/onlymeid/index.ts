// common imports
import z from 'zod';

// OnlyMeId ABI imports
import * as onlyMeIdAbi from './abi/onlymeid.ts';

// New registry imports
import { registerAdapter } from '../_shared/index.ts';
// utils
import { ZodEvmAddress, md5Hash } from '../_shared/index.ts';

export default registerAdapter({
  name: 'onlymeid',
  semver: '0.0.1',
  schema: z.object({
    onlyMeIdAddress: ZodEvmAddress,
  }),
  build: ({ params }) => {
    // Extract function sighash for userVerify
    const userVerifySighash = onlyMeIdAbi.functions.userVerify.sighash;

    return {
      buildProcessor: (base) =>
        base.addTransaction({
          to: [params.onlyMeIdAddress],
          sighash: [userVerifySighash],
        }),
      onTransaction: async ({ transaction, emit }) => {
        const { from, to, hash, transactionIndex } = transaction;
        if (to !== params.onlyMeIdAddress) return;
        await emit.action({
          key: md5Hash(`${hash}${transactionIndex}`),
          user: from,
          priceable: false,
          activity: 'verify',
        });
      },
    };
  },
});
