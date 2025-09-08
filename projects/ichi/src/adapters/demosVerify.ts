// common imports
import z from 'zod';

// demos abi
import * as demosAbi from '../abi/demos';

// New registry imports
import { defineAdapter, Address as EvmAddress } from '../adapter-core';
import { registerAdapter } from '../adapter-registry';
import { md5Hash } from '../utils/helper';

export const DemosVerifyParams = z.object({
  kind: z.literal('demos-verification'),
  onlyMeIdAddress: EvmAddress,
});

export type DemosVerifyParams = z.infer<typeof DemosVerifyParams>;

export const demosVerify = registerAdapter(
  defineAdapter({
    name: 'demos-verify',
    schema: DemosVerifyParams,
    build: ({ params, io }) => {
      // Extract event topics here if needed
      const userVerifySighash = demosAbi.functions.userVerify.sighash;

      return {
        __adapterName: 'demos-verify',
        adapterCustomConfig: DemosVerifyParams,
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
            role: 'verify',
          });
        },
        projectors: [], // Add projectors if needed
      };
    },
  }),
);
