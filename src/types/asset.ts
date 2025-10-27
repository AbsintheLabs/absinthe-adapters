// Asset type system and feed handler interface
// Provides type-safe asset identification and pricing handler definitions

import { ResolveContext } from './pricing.ts';
import { z } from 'zod';
import { AssetMetadata } from './index.ts';
import { globalFeedRegistry } from '../feeds/registry.ts';

// =============================================================================
// ASSET TYPE SYSTEM
// =============================================================================

/**
 * Discriminated union of asset types
 * Each variant encodes the minimum required fields for unique identification
 */
export type Asset =
  | { type: 'erc20'; address: string }
  | { type: 'erc721'; address: string; tokenId: string }
  | { type: 'spl'; address: string }
  // warn: do we need prefix defined here for custom handlers?
  | { type: 'custom'; prefix: string; key: string };
export type AssetType = Asset['type'];
export const AssetEnum = z.enum(['erc20', 'erc721', 'spl', 'custom']);

/**
 * Extract asset type for a specific discriminant
 * @example AssetOfType<'erc20'> → { type: 'erc20', address: string }
 */
export type AssetOfType<T extends Asset['type']> = Extract<Asset, { type: T }>;

/**
 * Generate canonical key from typed asset for storage and caching
 * This ensures consistent key format across the system
 */
export function getAssetKeyFromAsset(asset: Asset): string {
  switch (asset.type) {
    case 'erc20':
      return `erc20:${asset.address.toLowerCase()}`;
    case 'erc721':
      return `erc721:${asset.address.toLowerCase()}:${asset.tokenId}`;
    case 'spl':
      return `spl:${asset.address}`;
    case 'custom':
      return `custom:${asset.prefix}:${asset.key}`;
  }
}

export function getAssetFromKey(assetKey: string): Asset {
  const parts = assetKey.split(':');
  if (parts.length < 2) {
    throw new Error(`Invalid asset key format: ${assetKey}`);
  }

  const [type, ...rest] = parts;

  switch (type as AssetType) {
    case 'erc20':
      if (rest.length !== 1) throw new Error(`Invalid erc20 key: ${assetKey}`);
      return { type: 'erc20', address: rest[0] };

    case 'erc721':
      if (rest.length !== 2) throw new Error(`Invalid erc721 key: ${assetKey}`);
      return { type: 'erc721', address: rest[0], tokenId: rest[1] };

    case 'spl':
      if (rest.length !== 1) throw new Error(`Invalid spl key: ${assetKey}`);
      return { type: 'spl', address: rest[0] };

    case 'custom':
      if (rest.length !== 2) throw new Error(`Invalid custom key: ${assetKey}`);
      return { type: 'custom', prefix: rest[0], key: rest[1] };

    default:
      throw new Error(`Unknown asset type: ${type}`);
  }
}
// =============================================================================
// FEED HANDLER INTERFACE
// =============================================================================

export const FeedSchema = z.object({
  kind: z.string(),
  // config: z.unknown(),
});
// .loose();

export type Feed = z.infer<typeof FeedSchema> & Record<string, unknown>;

/**
 * Feed handler definition with type constraints
 *
 * @example
 * // Simple handler with typed config
 * export const coingeckoFeed = defineFeedHandler({
 *   name: 'coingecko',
 *   acceptsAssetType: 'any' as const,
 *   configSchema: z.object({
 *     id: z.string()
 *   }),
 *   handler: async ({ asset, config, ctx }) => {
 *     // config is inferred as { id: string }
 *     const price = await fetchPrice(config.id);
 *     return price;
 *   }
 * });
 *
 * @example
 * // Type-specific handler (LP tokens)
 * export const univ2navFeed = defineFeedHandler({
 *   name: 'univ2nav',
 *   acceptsAssetType: 'erc20' as const,
 *   configSchema: z.object({
 *     token0: FeedSelectorSchema,
 *     token1: FeedSelectorSchema
 *   }),
 *   handler: async ({ asset, config, ctx, resolve }) => {
 *     // asset is { type: 'erc20', address: string }
 *     // config is inferred as { token0: {...}, token1: {...} }
 *     const price0 = await resolve(..., config.token0, ctx);
 *     const price1 = await resolve(..., config.token1, ctx);
 *     return calculateNav(price0, price1);
 *   }
 * });
 */
export interface FeedHandler<T extends Asset['type'] | 'any' = 'any', TConfig = unknown> {
  /** Unique identifier for this handler */
  name: string;

  /** Asset type(s) this handler accepts */
  acceptsAssetType: T;

  /** Zod schema that defines and validates the config structure */
  configSchema: z.ZodType<TConfig>;

  /** Handler implementation */
  handler: FeedHandlerFn<T, TConfig>;

  /** Optional manifest with env var requirements */
  manifest?: {
    requiredEnvVars?: Record<string, z.ZodType<any>>;
  };
}

export type FeedHandlerFn<T extends Asset['type'] | 'any' = 'any', TConfig = unknown> = (
  args: FeedHandlerArgs<T, TConfig>,
) => Promise<Big>; // ✅ Always returns big

export interface FeedHandlerArgs<T extends Asset['type'] | 'any' = 'any', TConfig = unknown> {
  /** The typed asset to price */
  asset: T extends 'any' ? Asset : AssetOfType<Extract<T, Asset['type']>>;

  /** Handler-specific configuration (typed based on configSchema) */
  config: TConfig;

  /** Resolve context with caches, RPC, etc. */
  ctx: ResolveContext;

  /** Metadata for the current asset (decimals, etc.) - resolved by engine */
  metadata: AssetMetadata;

  /** Recursive resolver for pricing underlying assets */
  resolve: ResolveFn;
}

// ResolveFn returns both price and metadata for nested assets
export type ResolveFn = (
  asset: Asset,
  config: Feed,
  ctx?: ResolveContext,
) => Promise<{ price: Big; metadata: AssetMetadata }>;
/**
 * Helper to define a feed handler with automatic type inference
 *
 * No generics needed - everything is inferred from the config object.
 * TypeScript automatically infers both the asset type and config type.
 *
 * @example
 * export const coingeckoFeed = defineFeedHandler({
 *   name: 'coingecko',
 *   acceptsAssetType: 'any' as const,
 *   configSchema: z.object({ id: z.string() }),
 *   handler: async ({ config }) => {
 *     // config is automatically typed as { id: string }
 *     return fetchPrice(config.id);
 *   }
 * });
 */
export function defineFeedHandler<
  T extends Asset['type'] | 'any',
  TSchema extends z.ZodType<any>,
>(config: {
  name: string;
  acceptsAssetType: T;
  configSchema: TSchema;
  handler: FeedHandlerFn<T, z.infer<TSchema>>;

  // todo: we still have to implement manifest later
  manifest?: {
    requiredEnvVars?: Record<string, z.ZodType<any>>;
  };
}): FeedHandler<T, z.infer<TSchema>> {
  globalFeedRegistry.register(config);
  return config;
}
