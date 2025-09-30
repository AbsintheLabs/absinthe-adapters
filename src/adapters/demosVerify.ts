// common imports
import z from 'zod';

// demos abi
import * as demosAbi from '../abi/demos.ts';

// New registry imports
import { defineAdapter, ZodEvmAddress as ZodEvmAddress } from '../adapter-core.ts';
import { registerAdapter } from '../adapter-registry.ts';
import { md5Hash } from '../utils/helper.ts';

export const DemosVerifyZodObj = z.object({
  onlyMeIdAddress: ZodEvmAddress,
});

export type DemosVerifyParamsType = z.infer<typeof DemosVerifyZodObj>;

export const demosVerify = registerAdapter(
  defineAdapter({
    name: 'demos-verify',
    semver: '0.0.1',
    schema: DemosVerifyZodObj,
    build: ({ params, io }) => {
      // Extract event topics here if needed
      const userVerifySighash = demosAbi.functions.userVerify.sighash;

      return {
        buildProcessor: (base) =>
          base.addTransaction({
            to: [params.onlyMeIdAddress],
            sighash: [userVerifySighash],
          }),
        onTransaction: async ({ transaction, emitFns }) => {
          const { from, to, hash, transactionIndex } = transaction;
          if (to !== params.onlyMeIdAddress) return;
          await emitFns.action.action({
            key: md5Hash(`${hash}${transactionIndex}`),
            user: from,
            priceable: false,
            activity: 'verify',
          });
        },
      };
    },
  }),
);
