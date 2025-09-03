// Legacy main entry point - redirects to new main.ts
// This file is kept for backward compatibility

// The main logic has been refactored and moved to:
// - Engine: ./engine/engine.ts
// - Types: ./types/
// - Adapters: ./adapters/
// - Cache: ./cache/
// - Config: ./config/

// New main entry point
export * from './main';

// Re-export the main components for backward compatibility
export { Engine } from './engine';
export { Adapter } from './types/adapter';
export type {
  BalanceDelta,
  PositionStatusChange,
  OnChainEvent,
  OnChainTransaction,
  IndexerMode,
} from './types/core';

export type {
  AssetFeedConfig,
  AssetConfig,
  ResolveContext,
  PriceCacheTS,
  MetadataCache,
} from './types/pricing';

export { RedisTSCache, RedisMetadataCache } from './cache';
export { PricingEngine } from './engine/pricing-engine';
