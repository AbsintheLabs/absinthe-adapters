// config/schema.ts
import * as z from 'zod';
import { isValidChainId } from './chains';
// import { AssetFeedConfigInput } from './feeds';

const Common = z.object({
  indexerId: z.string(), // for namespacing keys/files
  flushMs: z.number().int().positive(), // your engine’s windowing
  feedConfigJson: z.string().optional(), // optional JSON blob for adapter feeds
  extrasJson: z.string().optional(), // adapter-specific extras (JSON)
  absintheApiUrl: z.string().url(),
  absintheApiKey: z.string(),
  coingeckoApiKey: z.string(),
});

// EVM-only
const EvmCfg = z.object({
  kind: z.literal('evm'),
  network: z.object({
    chainId: z.number().int().positive().refine(isValidChainId, { message: 'Invalid chain ID' }),
    gatewayUrl: z.url({ hostname: z.regexes.domain, protocol: /^https?$/ }),
    rpcUrl: z.url({ protocol: /^https?$/ }),
    // 75 is a safe default for most chains, at the expense of latency
    finality: z.number().int().positive().optional().default(75),
  }),
  range: z.object({
    fromBlock: z.number().int().nonnegative(),
    toBlock: z.number().int().nonnegative().optional(),
  }),
  subscriptions: z
    .object({
      // xxx: need to clean this up
      logs: z
        .array(
          z.object({
            addresses: z.array(
              z
                .string()
                .toLowerCase()
                .regex(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid EVM address' }),
            ),
          }),
        )
        .default([]),
      functionCalls: z
        .array(
          z.object({
            to: z.array(
              z
                .string()
                .toLowerCase()
                .regex(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid EVM address' }),
            ),
            sighash: z.array(
              z
                .string()
                .toLowerCase()
                .regex(/^0x[a-fA-F0-9]{8}$/, { message: 'Invalid EVM function signature' }),
            ),
          }),
        )
        .default([]),
    })
    .refine(
      (subs) =>
        (subs.logs && subs.logs.length > 0) ||
        (subs.functionCalls && subs.functionCalls.length > 0),
      { message: "At least one of 'logs' or 'functionCalls' must be defined and non-empty" },
    ),
});

// Solana-only
// fixme: later come back and see if it's legit. Right now, we're NOT going to use this until we get EVM in place
const SolanaCfg = z.object({
  kind: z.literal('solana'),
  network: z.object({
    gatewayUrl: z.string().url(), // Subsquid Network or Firehose source
    rpcUrl: z.string().url(), // Solana RPC for program account lookups
    commitment: z.enum(['processed', 'confirmed', 'finalized']).default('finalized'),
  }),
  range: z.object({
    // Solana batches by slot; you can accept either slots or wallclock timestamps and derive
    fromSlot: z.number().int().nonnegative(),
    toSlot: z.number().int().nonnegative().optional(),
  }),
  subscriptions: z.object({
    // choose ONE or mix: programs/instructions/logs/balances
    programs: z
      .array(
        z.object({
          programId: z.string(), // base58
          // optional: account filters, memcmp, dataSize…
          // optional: instruction discriminators, etc.
        }),
      )
      .default([]),
    instructions: z
      .array(
        z.object({
          programId: z.string(),
          // optional: which ix variants
        }),
      )
      .default([]),
    logs: z
      .array(
        z.object({
          // “mentions” filters, etc.
          programId: z.string().optional(),
        }),
      )
      .default([]),
  }),
});

export const AppConfig = z.discriminatedUnion('kind', [
  EvmCfg.merge(Common).extend({
    //FIXME: later make it not optional, but right now hacking around not having this in place
    // feedConfig: AssetFeedConfigInput.optional(),
  }),
  SolanaCfg.merge(Common).extend({
    // feedConfig: AssetFeedConfigInput.optional(),
  }),
]);
export type AppConfig = z.infer<typeof AppConfig>;
