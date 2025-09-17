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
  PriceFeedable,
} from './types/pricing.ts';

export type { Adapter } from './types/adapter.ts';

// Cache implementations
export { RedisTSCache, RedisMetadataCache } from './cache/index.ts';

// Engine components
export { PricingEngine, HandlerRegistry } from './engine/pricing-engine.ts';
export { metadataResolver, erc20Handler } from './engine/asset-handlers.ts';

// Adapters
// export { createIchiAdapter, createHemiAdapter } from './adapters';

// Configurations
export {
  defaultFeedConfig,
  gammaVaultsFeedConfig,
  ichiVaultsFeedConfig,
} from './config/pricing.ts';

// // Sink
// export { Sink, CsvSink, StdoutSink } from './sinks';
