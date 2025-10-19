// Main project index - organized exports

// Core engine
export { Engine } from './engine/index.ts';

// Types
export type {
  BalanceDelta,
  PositionStatusChange,
  IndexerMode,
  AssetMetadata,
} from './types/core.ts';

export type {
  MetadataCache,
  PriceCacheTS,
  ResolveContext,
  AssetTypeHandler,
} from './types/pricing.ts';

export type { Adapter } from './types/adapter.ts';

// Cache implementations
export { RedisTSCache, RedisMetadataCache } from './cache/index.ts';

// Engine components
export { PricingEngine, HandlerRegistry } from './engine/pricing-engine.ts';
export { erc20Handler } from './engine/asset-handlers.ts';
