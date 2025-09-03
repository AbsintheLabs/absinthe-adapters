// Main project index - organized exports

// Core engine
export { Engine } from './engine';

// Types
export type {
  BalanceDelta,
  PositionStatusChange,
  OnChainEvent,
  OnChainTransaction,
  IndexerMode,
  AssetMetadata,
} from './types/core';

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

export type { Adapter } from './types/adapter';

// Cache implementations
export { RedisTSCache, RedisMetadataCache } from './cache';

// Engine components
export { PricingEngine, HandlerRegistry } from './engine/pricing-engine';
export { metadataResolver, erc20Handler } from './engine/asset-handlers';

// Adapters
export { createIchiAdapter, createHemiAdapter } from './adapters';

// Configurations
export { defaultFeedConfig, gammaVaultsFeedConfig, ichiVaultsFeedConfig } from './config/pricing';

// Sink
export { Sink, CsvSink } from './esink';
