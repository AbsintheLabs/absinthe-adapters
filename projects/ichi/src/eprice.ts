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
} from './types/pricing';

export type { AssetMetadata } from './types/core';

// Re-export cache implementations
export { RedisMetadataCache } from './cache/metadata';
export { RedisTSCache } from './cache/price';

// Re-export engine components
export { PricingEngine, HandlerRegistry } from './engine/pricing-engine';
export { metadataResolver, erc20Handler } from './engine/asset-handlers';
