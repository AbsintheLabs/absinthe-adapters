// manifest.ts
import { z } from 'zod';
import { PROTOCOL_FAMILY_VALUES } from '../constants.ts';
import { ChainArch, AssetConfig } from '../config/schema.ts';

// Simple version type using template literal
export type Version = `${number}.${number}.${number}`;

export const QuantityTypeSchema = z.enum(['token_based', 'count', 'none']);
export const TrackableKindSchema = z.enum(['action', 'position']);

export type QuantityType = z.infer<typeof QuantityTypeSchema>;
export type TrackableKind = z.infer<typeof TrackableKindSchema>;

// 1) Generic FieldDef for TypeScript (separate from Zod)
export type FieldDef<T extends z.ZodTypeAny = z.ZodTypeAny> = {
  description: string;
  schema: T;
};

// AssetSelectorDef identifies which asset to track/price (required when pricing is configured)
export type AssetSelectorDef<T extends z.ZodTypeAny = z.ZodTypeAny> = FieldDef<T>;

// 2) Helper functions return FieldDef<T> with proper generics
export const evmAddress = (description: string): FieldDef<z.ZodType<string>> => ({
  description,
  schema: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/i, 'Invalid EVM address')
    .transform((val) => val.toLowerCase()),
});

export const solAddress = (description: string): FieldDef<z.ZodString> => ({
  description,
  schema: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/i, 'Invalid Solana address'),
});

export const stringField = (description: string): FieldDef<z.ZodString> => ({
  description,
  schema: z.string(),
});

export const numberField = (description: string): FieldDef<z.ZodNumber> => ({
  description,
  schema: z.number(),
});

export const booleanField = (description: string): FieldDef<z.ZodBoolean> => ({
  description,
  schema: z.boolean(),
});

// Keep Zod Field for runtime validation (but don't use for TS inference)
const Field = z.object({
  description: z.string().min(1),
  schema: z.any(), // ZodSchema - this is fine for runtime validation
});

// 3) Define TS manifest shape that uses FieldDef (separate from Zod)
// Runtime contract - required for execution
//
// TYPE SAFETY RULES:
// 1. Only token_based trackables can have `requiredPricer`
// 2. Only token_based trackables can have `assetSelectors` (identifies which asset to price)
// 3. All trackables can have optional `filters` for general filtering
// 4. count/none actions cannot have assetSelectors or requiredPricer
//
// ASSET IDENTIFICATION CONTRACT (token_based trackables):
// - params + assetSelectors together must uniquely identify the priceable asset
// - If params alone are sufficient (e.g., UniV2 pool address = LP token), omit assetSelectors
// - If additional identification needed (e.g., UniV3 token0/token1, swap leg), use assetSelectors
// - assetSelectors, when present, must be non-empty (enforced at runtime)
//
// EXAMPLES:
// - UniV2 LP: params.poolAddress identifies the LP token → no assetSelectors needed
// - UniV3 LP: params.nftManager + assetSelectors.{token0,token1} → identifies specific pool LP
// - Swaps: params.poolAddress + assetSelectors.swapLegAddress → identifies which token to price
//
// - filters: Optional general filtering (e.g., minAmount, user address, etc.)
//   - Not related to pricing, purely for narrowing event scope

/*
In our runtime config, we need to provide the object that follows the manifest shape for each trackable definition.
Remember that there can be more than one instance for each trackable definition. For example, a univ2 adapter can define a
swap trackable, and then we can have multiple instances of the swap trackable (for example, for each pool we want to track) in there.

By defualt, if it's a token_based trackable, it will just give us the value in scaled tokens.
However if we want to price it, we need to provide the assetSelectors (one asset definition per trackable instance) and then
a pricing definition (which is a recursive definition that defines the price feed for that selected asset).

Right now, the runtime config doesn't parse the pricing definition, so it's not used anywhere.

However, we want each trackable to use that pricing definition.

This is how we currently find the config for an asset (this is the old architecture)
export function findConfig(
  rules: AssetFeedConfig,
  assetKey: string,
  getLabels: (k: string) => Record<string, string> | undefined,
): AssetConfig | undefined {
  const labels = getLabels(assetKey) || {};

  for (const rule of rules) {
    const { match } = rule;

    // Check key glob match
    if (match.key) {
      const regex = globToRegex(match.key.toLowerCase());
      if (regex.test(assetKey.toLowerCase())) {
        return rule.config;
      }
    }

    // Check label selectors
    if (match.matchLabels || match.matchExpressions) {
      if (labelsMatch(labels, match.matchLabels, match.matchExpressions)) {
        return rule.config;
      }
    }
  }

  return undefined;
}

However, things are significantly simpler now, since each trackable instance defines exactly HOW it should price itself.
So we don't need to do this matching or resolution, we just need to pass the pricing definition to the pricing engine for each trackable instance.
*/

// Position trackables are always token_based
type PositionTrackableDef = {
  kind: 'position';
  quantityType: 'token_based';
  params: Record<string, FieldDef>;
  assetSelectors?: Record<string, AssetSelectorDef>; // Optional: Additional asset identification if needed
  filters?: Record<string, FieldDef>; // Optional general filters
  requiredPricer?: string; // pricing scheme required for this trackable
};

// Action trackables with token_based can have asset selectors and pricing
type ActionTokenBasedDef = {
  kind: 'action';
  quantityType: 'token_based';
  params: Record<string, FieldDef>;
  assetSelectors?: Record<string, AssetSelectorDef>; // Optional: Additional asset identification if needed
  filters?: Record<string, FieldDef>; // Optional general filters
  requiredPricer?: string; // pricing scheme required for this trackable
};

// Action trackables with count or none cannot have asset selectors or pricing
type ActionNonTokenDef = {
  kind: 'action';
  quantityType: 'count' | 'none';
  params: Record<string, FieldDef>;
  filters?: Record<string, FieldDef>; // Can still have general filters
  // No assetSelectors or requiredPricer allowed
};

export type TrackableDef = PositionTrackableDef | ActionTokenBasedDef | ActionNonTokenDef;

// Runtime manifest - used during adapter execution
// This is necessary to have this duplication to avoid some more type magic down the line
export type Manifest = {
  name: string; // identifier, used in config
  version: Version;
  chainArch: ChainArch;
  trackables: Record<string, TrackableDef>;
};

// Keep Zod schema for runtime validation (but don't use z.infer for TS types)
const Trackable = z
  .object({
    kind: TrackableKindSchema,
    quantityType: QuantityTypeSchema,
    params: z.record(z.string(), Field), // required parameters that define tracking context
    assetSelectors: z.record(z.string(), Field).optional(), // identifies which asset to track/price
    filters: z.record(z.string(), Field).optional(), // optional general filters
    requiredPricer: z.string().optional(), // pricing scheme required for this trackable
  })
  .refine(
    (data) => {
      // If assetSelectors is provided, it must be non-empty
      if (data.assetSelectors !== undefined) {
        return Object.keys(data.assetSelectors).length > 0;
      }
      return true;
    },
    {
      message:
        'assetSelectors, when provided, must contain at least one selector (cannot be empty object)',
    },
  );

// 4) Infer config type from TS manifest (not from Zod)
type InferField<F extends FieldDef<any>> = z.infer<F['schema']>;

type ParamsFrom<T extends TrackableDef> = {
  [K in keyof T['params']]: InferField<T['params'][K]>;
};

type AssetSelectorsFrom<T extends TrackableDef> = T extends {
  assetSelectors: Record<string, AssetSelectorDef<any>>;
}
  ? { [K in keyof T['assetSelectors']]: InferField<T['assetSelectors'][K]> }
  : never;

type FiltersFrom<T extends TrackableDef> = T extends {
  filters: Record<string, FieldDef<any>>;
}
  ? { [K in keyof T['filters']]: InferField<T['filters'][K]> }
  : never;

type PricingFrom<T extends TrackableDef> = {
  pricing?: AssetConfig;
};

export type InstanceFrom<T extends TrackableDef> = {
  params: ParamsFrom<T>;
  quantityType: T['quantityType'];
} & (T extends { assetSelectors: Record<string, AssetSelectorDef<any>> }
  ? { assetSelectors?: AssetSelectorsFrom<T> }
  : {}) &
  (T extends { filters: Record<string, FieldDef<any>> } ? { filters?: FiltersFrom<T> } : {}) &
  PricingFrom<T>;

export type ConfigFromManifest<M extends Manifest> = {
  [K in keyof M['trackables']]: InstanceFrom<M['trackables'][K]>[];
};

// Runtime validation schema for manifest
export const ManifestZ = z
  .object({
    name: z.string().min(1),
    version: z.string() as z.ZodType<Version>,
    chainArch: ChainArch,
    trackables: z.record(z.string(), Trackable),
  })
  .strict();

// Optional validation schema for metadata
export const AdapterMetadataZ = z
  .object({
    displayName: z.string().min(1).max(40),
    description: z.string().min(1).max(280),
    compatibleWith: z.enum(PROTOCOL_FAMILY_VALUES).optional(),
    author: z.string().min(1).max(40),
    authorUrl: z.httpUrl().optional(),
    authorIcon: z.httpUrl().optional(),
    tags: z
      .array(z.string().transform((tag) => tag.toLowerCase()))
      .max(16)
      .optional(),
    category: z
      .enum(['trading', 'lending', 'staking', 'tokens', 'identity', 'marketplace'])
      .optional(),
    adapterIcon: z.httpUrl().optional(),
    status: z.enum(['stable', 'beta', 'alpha', 'deprecated']).optional(),
    createdAt: z.string().date(),
  })
  .strict();

export type AdapterMetadata = z.infer<typeof AdapterMetadataZ>;
