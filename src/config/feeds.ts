// // config/feeds.ts
// import * as z from 'zod';
// import type { AssetKey, AssetType, AssetConfig, AssetFeedConfig, FeedSelector, TokenSelector } from '../eprice';

// /** ---------- Core scalar schemas ---------- */

// // AssetKey is just a string (EVM address lowercased or "chain:addr")
// export const AssetKeySchema = z.string().min(1);

// // AssetType validation
// export const AssetTypeSchema = z.enum(['erc20', 'spl']);

// /** ---------- FeedSelector schemas ---------- */

// // Base schemas for each feed type
// const CoinGeckoFeedSchema = z.object({
//     kind: z.literal('coingecko'),
//     id: z.string().min(1)
// });

// const PeggedFeedSchema = z.object({
//     kind: z.literal('pegged'),
//     usdPegValue: z.number().positive()
// });

// // TokenSelector schema (used by NAV feeds)
// const TokenSelectorSchema: z.ZodType<TokenSelector> = z.object({
//     assetType: AssetTypeSchema,
//     priceFeed: z.lazy(() => FeedSelectorSchema)
// });

// const UniV2NavFeedSchema = z.object({
//     kind: z.literal('univ2nav'),
//     token0: TokenSelectorSchema,
//     token1: TokenSelectorSchema
// });

// const IchiNavFeedSchema = z.object({
//     kind: z.literal('ichinav'),
//     token0: TokenSelectorSchema,
//     token1: TokenSelectorSchema
// });

// // Union of all feed selector types
// export const FeedSelectorSchema: z.ZodType<FeedSelector> = z.discriminatedUnion('kind', [
//     CoinGeckoFeedSchema,
//     PeggedFeedSchema,
//     UniV2NavFeedSchema,
//     IchiNavFeedSchema
// ]);

// /** ---------- Asset configuration schemas ---------- */

// export const AssetConfigSchema: z.ZodType<AssetConfig> = z.object({
//     assetType: AssetTypeSchema,
//     priceFeed: FeedSelectorSchema
// });

// /** ---------- Complete feed configuration schema ---------- */

// export const AssetFeedConfigSchema: z.ZodType<AssetFeedConfig> = z.record(
//     AssetKeySchema,
//     AssetConfigSchema
// );

// /** ---------- Input schema for configuration ---------- */

// // This is what we'll use in the main config schema - it accepts the feed config as input
// export const AssetFeedConfigInput = AssetFeedConfigSchema;
