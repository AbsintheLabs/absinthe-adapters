// adapter-core.ts - Core types and utilities for the adapter registry pattern
// This file defines the fundamental types and interfaces for the adapter system

import { z } from 'zod';
import { Redis } from 'ioredis';
import { EmitFunctions, RpcContext, CustomFeedHandlers } from './types/adapter.ts';
import { BaseProcessor } from './eprocessorBuilder.ts';
import { UnifiedEvmLog, UnifiedEvmTransaction } from './types/unified-chain-events.ts';
import { Manifest, ConfigFromManifest } from './types/manifest.ts';

// =============================================================================
// CORE ENGINE TYPES
// =============================================================================

/** Engine IO interface for dependency injection */
export type EngineIO = {
  redis: Redis;
  log: (...args: any[]) => void;
};

// =============================================================================
// EVENT HANDLER ARGUMENT TYPES
// =============================================================================

/** Base arguments provided to all event handlers */
type OnArgs = {
  rpcCtx: RpcContext;
  redis: Redis;
  emitFns: EmitFunctions;
};

/** Arguments for log event handlers (uses unified chain types) */
export type OnLogArgs = OnArgs & {
  log: UnifiedEvmLog;
};

/** Arguments for transaction event handlers (uses unified chain types) */
export type OnTransactionArgs = OnArgs & {
  transaction: UnifiedEvmTransaction;
};

/** Arguments for initialization handlers */
export type OnInitArgs = {
  rpcCtx: RpcContext;
  redis: Redis;
};

// =============================================================================
// ADAPTER LIFECYCLE TYPES
// =============================================================================

/** Core adapter interface defining all available hooks */
export type AdapterHooks = {
  // Function to extend the base processor with adapter-specific subscriptions
  buildProcessor: (base: BaseProcessor) => BaseProcessor;

  // Optional hook called when the adapter is initialized
  onInit?: (args: OnInitArgs) => Promise<void>;

  // Optional hook called for each log event
  onLog?: (args: OnLogArgs) => Promise<void>;

  onTransaction?: (args: OnTransactionArgs) => Promise<void>;

  // Optional hook called at the end of each batch
  onBatchEnd?: (args: { io: EngineIO; ctx: any }) => Promise<void>;

  // Optional custom feed handlers
  customFeeds?: CustomFeedHandlers;
};

/** Built adapter with contextual state captured by the builder */
export type BuiltAdapter = AdapterHooks;

// =============================================================================
// HANDLER TYPES
// =============================================================================

/** Handler function for action-type trackables */
export type ActionHandler = (evt: unknown, ctx: unknown) => void | Promise<void>;

/** Handler function for position-type trackables */
export type PositionHandler = (evt: unknown, ctx: unknown) => void | Promise<void>;

// =============================================================================
// ADAPTER DEFINITION TYPES
// =============================================================================

// Configuration types are now imported from manifest.ts with proper type inference

/** Adapter definition combining manifest with build function */
export type AdapterDef<M extends Manifest> = {
  manifest: M;
  build: (opts: { config: ConfigFromManifest<M>; io: EngineIO }) => BuiltAdapter;
};

// =============================================================================
// ADAPTER FACTORY
// =============================================================================

/** Factory function to create typed adapter definitions with preserved generics */
export function defineAdapter<const M extends Manifest>(def: {
  manifest: M;
  build: (opts: { config: ConfigFromManifest<M>; io: EngineIO }) => BuiltAdapter;
}): AdapterDef<M> {
  return def as AdapterDef<M>;
}

// =============================================================================
// LEGACY UTILITIES (DEPRECATED)
// =============================================================================

/**
 * @deprecated Use FieldTypes.EvmAddress from types/manifest.ts instead.
 * Zod schema for EVM address validation and normalization.
 */
export const ZodEvmAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address')
  .transform((s) => s.toLowerCase());

/**
 * @deprecated Use FieldTypes.EvmAddress from types/manifest.ts instead.
 * Type for EVM address validation results.
 */
export type ZodEvmAddress = z.infer<typeof ZodEvmAddress>;
