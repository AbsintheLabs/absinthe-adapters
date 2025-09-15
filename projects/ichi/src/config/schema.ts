// config/schema.ts
import * as z from 'zod';
import { isValidChainId } from './chains';
// import { AssetFeedConfigInput } from './feeds';

// ------------------------------------------------------------
// PRICING TYPES SCHEMAS
// ------------------------------------------------------------

// Basic types
export const AssetKey = z.string().min(1); // EVM address or "chain:addr"
export const AssetType = z.enum(['erc20', 'spl', 'erc721']);

// Label expression for asset matching (Kubernetes-style selectors)
export const LabelExpr = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('In'),
    key: z.string(),
    values: z.array(z.string()),
  }),
  z.object({
    op: z.literal('NotIn'),
    key: z.string(),
    values: z.array(z.string()),
  }),
  z.object({
    op: z.literal('Exists'),
    key: z.string(),
  }),
  z.object({
    op: z.literal('DoesNotExist'),
    key: z.string(),
  }),
  z.object({
    op: z.literal('AnyIn'),
    keys: z.array(z.string()),
    values: z.array(z.string()),
  }),
]);

// Asset match criteria
export const AssetMatch = z.object({
  key: z.string().optional(), // glob pattern for assetKey matching
  matchLabels: z.record(z.string(), z.string()).optional(), // exact label matches (AND)
  matchExpressions: z.array(LabelExpr).optional(), // advanced selectors (AND)
});

// EVM address validation
export const EvmAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address')
  .transform((s) => s.toLowerCase());

// Forward declarations for circular references
const TokenSelectorRef = (): z.ZodType<any> => TokenSelector;
const FeedSelectorRef = (): z.ZodType<any> => FeedSelector;
const CoreFeedSelectorRef = (): z.ZodType<any> => CoreFeedSelector;

// Core feed selectors (provided by the library)
// FIXME: these should be selexxxcted at runtime based on the ones that are actually registered by the adapter
// XXX: too many magic strings, this should be auto done based on the default and adapter-specific price feeds
export const CoreFeedSelector = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('coingecko'),
    id: z.string(),
  }),
  z.object({
    kind: z.literal('pegged'),
    usdPegValue: z.number().positive(),
  }),
  z.object({
    kind: z.literal('univ2nav'),
    token0: z.lazy(TokenSelectorRef),
    token1: z.lazy(TokenSelectorRef),
  }),
  z.object({
    kind: z.literal('ichinav'),
    token0: z.lazy(TokenSelectorRef),
    token1: z.lazy(TokenSelectorRef),
  }),
  z.object({
    kind: z.literal('univ3lp'),
    nonfungiblepositionmanager: EvmAddress,
    tokenSelector: z.enum(['token0', 'token1']),
    token: z.lazy(TokenSelectorRef),
  }),
]);

// Extensible feed selector that allows custom implementations
export const FeedSelector = z.union([
  z.lazy(CoreFeedSelectorRef),
  z
    .object({
      // XXX: we should only allow feeds that are either default OR registered by the adapter
      kind: z
        .string()
        .refine(
          (s: string) =>
            s !== 'coingecko' &&
            s !== 'pegged' &&
            s !== 'univ2nav' &&
            s !== 'ichinav' &&
            s !== 'univ3lp',
          {
            message: 'Use core feed types for built-in kinds',
          },
        ),
    })
    .catchall(z.any()),
]);

// Token selector for feeds
export const TokenSelector = z.object({
  assetType: AssetType,
  priceFeed: z.lazy(FeedSelectorRef),
});

// Asset configuration
export const AssetConfig = z.object({
  assetType: AssetType,
  priceFeed: FeedSelector,
});

// Asset feed rule with priority-based matching
export const AssetFeedRule = z.object({
  match: AssetMatch,
  config: AssetConfig,
});

// Collection of rules for asset feed matching
export const AssetFeedConfig = z.array(AssetFeedRule);

// Sink configuration schema - matches the SinkConfig type from esink.ts
const SinkConfigSchema = z.discriminatedUnion('sinkType', [
  z.object({
    sinkType: z.literal('csv'),
    path: z.string().min(1, 'CSV path cannot be empty'),
  }),
  z.object({
    sinkType: z.literal('stdout'),
    json: z.boolean().optional().default(false),
  }),
  z.object({
    sinkType: z.literal('absinthe'),
    url: z.string().url('Invalid URL for absinthe sink'),
    apiKey: z.string().optional(),
    rateLimit: z.number().int().positive().optional(),
    batchSize: z.number().int().positive().optional(),
  }),
]);

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
  indexerId: z.string(), // for namespacing keys/files
  flushMs: z.number().int().positive().min(3600000), // engine windowing, must be at least 1 hour
  feedConfigJson: z.string().optional(), // optional JSON blob for adapter feeds
  extrasJson: z.string().optional(), // adapter-specific extras (JSON)
  redisUrl: z.url().optional().default('redis://localhost:6379'),
  sinkConfig: SinkConfigSchema.default({
    sinkType: 'csv',
    path: 'windows.csv',
  }),
  assetFeedConfig: AssetFeedConfig.optional(),
  adapterConfig: z.object({
    adapterId: z.string(), // "uniswap-v3", "compound-v2", etc.
    params: z.unknown(), // Will be validated by the specific adapter
  }),
  pricingRange: PricingRange.optional(), // Optional pricing range - defines when to apply pricing
});

// EVM-only
const EvmCfg = z.object({
  kind: z.literal('evm'),
  network: z.object({
    chainId: z.number().int().positive().refine(isValidChainId, { message: 'Invalid chain ID' }),
    gatewayUrl: z.httpUrl(),
    rpcUrl: z.httpUrl(),
    // 75 is a safe default for most chains, at the expense of latency
    finality: z.number().int().positive().optional().default(75),
  }),
  range: z.object({
    fromBlock: z.number().int().nonnegative(),
    toBlock: z.number().int().nonnegative().optional(),
  }),
});

// Solana-only
// fixme: later come back and see if it's legit. Right now, we're NOT going to use this until we get EVM in place
const SolanaCfg = z.object({
  kind: z.literal('solana'),
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
// export const AppConfig = z.discriminatedUnion('kind', [
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

// ------------------------------------------------------------
// TYPE EXPORTS FOR PRICING SCHEMAS
// ------------------------------------------------------------

export type AssetKey = z.infer<typeof AssetKey>;
export type AssetType = z.infer<typeof AssetType>;
export type LabelExpr = z.infer<typeof LabelExpr>;
export type AssetMatch = z.infer<typeof AssetMatch>;
export type EvmAddress = z.infer<typeof EvmAddress>;
export type CoreFeedSelector = z.infer<typeof CoreFeedSelector>;
export type FeedSelector = z.infer<typeof FeedSelector>;
export type TokenSelector = z.infer<typeof TokenSelector>;
export type AssetConfig = z.infer<typeof AssetConfig>;
export type AssetFeedRule = z.infer<typeof AssetFeedRule>;
export type AssetFeedConfig = z.infer<typeof AssetFeedConfig>;
export type SinkConfig = z.infer<typeof SinkConfigSchema>;
export type PricingRange = z.infer<typeof PricingRange>;
