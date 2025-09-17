// 💵💵💵💵💵💵💵💵 PRICE INTERFACES 💵💵💵💵💵💵💵💵💵
// This file now serves as a backward compatibility layer and re-exports
// All pricing logic has been refactored into separate modules for better organization

// Re-export types
export type {
  AssetKey,
  AssetType,
  AssetFeedConfig,
  AssetConfig,
  FeedSelector,
  TokenSelector,
  MetadataCache,
  PriceCacheTS,
  ResolveContext,
  AssetTypeHandler,
  PriceFeedable,
} from './types/pricing.ts';

export type { AssetMetadata } from './types/core.ts';

// Re-export cache implementations
export { RedisMetadataCache } from './cache/metadata.ts';
export { RedisTSCache } from './cache/price.ts';

// Re-export engine components
export { PricingEngine, HandlerRegistry } from './engine/pricing-engine.ts';
export { metadataResolver, erc20Handler } from './engine/asset-handlers.ts';
