// config/schema.ts
import * as z from 'zod';
import { isValidChainId } from './chains.ts';
import { durationHumanToMs } from './duration.ts';
import { AssetType, FeedSchema } from '../types/asset.ts';

/**
 * @deprecated ChainArchSchema is deprecated and will be removed in a future release.
 */
export const ChainArchSchema = z.enum(['evm', 'solana']);
/**
 * @deprecated ChainArch is deprecated and will be removed in a future release.
 */
export type ChainArch = z.infer<typeof ChainArchSchema>;

// // Asset configuration
// export const AssetConfig = z.object({
//   assetType: AssetType,
//   // we won't know priceFeed at compile time, since it's provided at runtime
//   priceFeed: z.unknown(),
// });

// Individual sink configuration schemas
export const CsvSinkSchema = z.object({
  sinkType: z.literal('csv'),
  path: z.string().min(1, 'CSV path cannot be empty'),
});

export const StdoutSinkSchema = z.object({
  sinkType: z.literal('stdout'),
  json: z.boolean().optional().default(false),
});

export const AbsintheSinkSchema = z.object({
  sinkType: z.literal('absinthe'),
  url: z
    .string()
    .url('Invalid URL for absinthe sink')
    .optional()
    .default('https://v2.adapters.absinthe.network'),
  apiKey: z.string().optional(),
  rateLimit: z.number().int().positive().optional().default(10),
  batchSize: z.number().int().positive().optional().default(100),
});

// Single sink configuration (backwards compatibility)
export const SingleSinkSchema = z.discriminatedUnion('sinkType', [
  CsvSinkSchema,
  StdoutSinkSchema,
  AbsintheSinkSchema,
]);

// Multiple sinks configuration
export const MultipleSinksSchema = z.object({
  sinks: z.array(SingleSinkSchema).min(1, 'At least one sink must be configured'),
});

// Combined sink configuration schema - supports both single and multiple sinks
const SinkConfigSchema = z.union([SingleSinkSchema, MultipleSinksSchema]);

// Pricing range configuration - defines when to apply pricing
const PricingRange = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('block'),
    fromBlock: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('timestamp'),
    fromTimestamp: z.number().int().nonnegative(),
  }),
]);

const Common = z.object({
  configVersion: z.int().gt(0).optional(),
  fullEventContext: z.boolean().optional().default(false),
  flushInterval: durationHumanToMs().describe(
    'Human duration: "1h", "90m", "1:30:00" NOT supported (only single-unit), "3600s", "1000ms". Min 1h.',
  ),
  feedConfigJson: z.string().optional(), // optional JSON blob for adapter feeds
  extrasJson: z.string().optional(), // adapter-specific extras (JSON)
  redisUrl: z.url().refine((s) => s.startsWith('redis://') || s.startsWith('rediss://'), {
    message: 'Redis URL must start with redis:// or rediss://',
  }),
  sinkConfig: SinkConfigSchema.default({
    sinkType: 'csv',
    path: 'positions.csv',
  }),
  // assetFeedConfig: FeedSchema.optional().default([]),
  adapterConfig: z.object({
    adapterId: z.string(), // "uniswap-v3", "compound-v2", etc.
    config: z.unknown(), // Will be validated against the adapter's manifest
  }),
  pricingRange: PricingRange.optional(), // Optional pricing range - defines when to apply pricing
  excludeContractAccounts: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Filter out protocol contracts, keeping only human-controlled accounts (EOAs, EIP-7702, ERC-4337)',
    ),
});

// EVM-only
const EvmCfg = z.object({
  // fixme: come back later and see if we shouldn't be providing literals
  chainArch: z.literal('evm'),
  network: z.object({
    chainId: z.number().int().positive().refine(isValidChainId, { message: 'Invalid chain ID' }),
    gatewayUrl: z.httpUrl().optional(),
    rpcUrl: z.httpUrl(),
    // 75 is a safe default for most chains, at the expense of latency
    finality: z.number().int().positive().optional().default(75),
  }),
  range: z.object({
    fromBlock: z.number().int().nonnegative(),
    toBlock: z.number().int().positive().optional(),
  }),
});

// Solana-only
// fixme: later come back and see if it's legit. Right now, we're NOT going to use this until we get EVM in place
const SolanaCfg = z.object({
  // fixme: come back later and see if we shouldn't be providing literals
  chainArch: z.literal('solana'),
  network: z.object({
    gatewayUrl: z.httpUrl(), // Subsquid Network or Firehose source
    rpcUrl: z.httpUrl(),
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

// FIXME: right now, we are not going to be supporting solana, let's just get evm working in the first place!
// export const AppConfig = z.discriminatedUnion('chainArch', [
//   EvmCfg.merge(Common).extend({
//     //FIXME: later make it not optional, but right now hacking around not having this in place
//     // feedConfig: AssetFeedConfigInput.optional(),
//   }),
//   SolanaCfg.merge(Common).extend({
//     // feedConfig: AssetFeedConfigInput.optional(),
//   }),
// ]);

export const AppConfig = EvmCfg.merge(Common);
// .extend(AssetFeedConfig);
export type AppConfig = z.infer<typeof AppConfig>;

// Export sink config types for type-safe usage in sink factory
export type CsvSinkConfig = z.infer<typeof CsvSinkSchema>;
export type StdoutSinkConfig = z.infer<typeof StdoutSinkSchema>;
export type AbsintheSinkConfig = z.infer<typeof AbsintheSinkSchema>;
export type SingleSinkConfig = z.infer<typeof SingleSinkSchema>;
export type MultipleSinksConfig = z.infer<typeof MultipleSinksSchema>;

// export type AssetConfig = z.infer<typeof AssetConfig>;
export type SinkConfig = z.infer<typeof SinkConfigSchema>;
export type PricingRange = z.infer<typeof PricingRange>;
