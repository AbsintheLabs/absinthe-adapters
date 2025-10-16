// Adapter interface and related types
// import { AssetFeedConfig } from '../config/schema.ts';
import { FeedHandler } from './asset.ts';
import { Block, Log, BaseProcessor } from '../eprocessorBuilder.ts';
import { Redis } from 'ioredis';
import { Manifest } from './manifest.ts';
import { Engine } from '../engine/engine.ts';

// ------------------------------------------------------------
// EMIT FUNCTIONS
// ------------------------------------------------------------

/**
 * Reason for emitting a balance delta or position window.
 *
 * - 'BALANCE_CHANGED': User's token balance changed due to a transaction.
 *    This includes opening a new balance (first purchase), closing a balance
 *    (selling all tokens), or any partial buy/sell that modified the quantity held.
 * - 'POSITION_REVALUED': User's balance quantity unchanged, but position metrics
 *    were recalculated. This occurs when underlying factors affecting position
 *    valuation changed (e.g., price updates, pool state changes) without the
 *    user performing a transaction.
 * - 'POSITION_DEACTIVATED': Position marked as no longer active for tracking.
 *    This occurs when a position moves out of range, user is blacklisted, or
 *    other conditions cause the position to be excluded from ongoing tracking
 *    despite the user still holding the underlying balance.
 * - 'PERIOD_ELAPSED': Configured time duration for the position expired.
 *    Emitted periodically for positions held without changes to capture
 *    duration-based metrics. The flush period is user-configurable, and this
 *    ensures long-held positions generate regular snapshots.
 * - 'INDEXER_STOPPED': Indexer reached its configured end timestamp and stopped.
 *    A final snapshot is emitted for any positions still held when indexing
 *    terminates, regardless of whether they changed during the final period.
 */
export const WINDOW_REASONS = [
  'BALANCE_CHANGED', // see above
  'POSITION_REVALUED', // see above
  'POSITION_DEACTIVATED', // see above
  'PERIOD_ELAPSED', // see above
  'INDEXER_STOPPED', // see above
] as const;

// Derive the type from the array
export type WindowReason = (typeof WINDOW_REASONS)[number];

export type EmitFunctions = ReturnType<Engine['createEmitFunctions']>;

// ------------------------------------------------------------
// HANDLER TYPES
// ------------------------------------------------------------

// Handler context passed to all handlers
export interface HandlerContext {
  block: Block;
  log: Log;
  emit: EmitFunctions;
  rpcCtx: SqdRpcCtx;
  redis: Redis;
}

// Action handler type for 'action' trackables
export type ActionHandler = (
  ctx: HandlerContext,
  trackable: any, // TrackableInstance
  eventData: any, // Decoded event data
) => Promise<void>;

// Position handler type for 'position' trackables
export type PositionHandler = (
  ctx: HandlerContext,
  trackable: any, // TrackableInstance
  eventData: any, // Decoded event data
) => Promise<void>;

// Union type for all handler types
export type Handler = ActionHandler | PositionHandler;

// Registry of handlers keyed by trackable ID
export type Handlers = Record<string, Handler>;

// Trackable instance type (placeholder for now)
// export interface TrackableInstance {
//   id: string;
//   itemId: string;
//   kind: string;
//   quantityType: string;
//   params: Record<string, any>;
// }

// Utility function to validate handler compatibility with manifest
// export function validateHandlers(manifest: Manifest, handlers: Handlers): void {
//   for (const trackable of Object.values(manifest.trackables)) {
//     const handler = handlers[trackable];
//     if (!handler) {
//       throw new Error(`Missing handler for trackable '${trackable.id}'`);
//     }

//     // Validate that handler type matches trackable kind
//     // For now, we just ensure handlers exist. More sophisticated type checking
//     // can be added later when we have more specific handler signatures
//     // xxx: i think we need to do this here, and make sure that required filters are set, if pricing is provided
//     // xxx: as well as attach additional fields based on the results of the validation (like `shouldPrice` etc)
//   }
// }

// ------------------------------------------------------------
// ADAPTER INTERFACE
// ------------------------------------------------------------

// Custom feed handler registry for adapters
export type CustomFeedHandlers = Record<string, FeedHandler<any>>;

// Projector interface for custom event processing
export interface Projector {
  namespace: string;
  onCustom(type: string, payload: any, ctx: ProjectorContext): Promise<void>;
}

// Context passed to projectors
export interface ProjectorContext {
  redis: Redis;
  emit: EmitFunctions;
  block: Block;
  log: Log;
}

// RPC context type for adapter handlers
export interface SqdRpcCtx {
  _chain: any; // Chain from subsquid
  block: {
    height: number;
  };
}

// export type VountCtx = {
//   // App configuration (already validated by Zod)
//   appCfg: any;

//   // Subsquid processor instance to extend with .addLog/.addTransaction handlers
//   processor: any;

//   // Shared infra
//   redis: Redis;
//   rpc: unknown;

//   // Engine emit API (same functions you use today)
//   emit: EmitFunctions;

//   // Until feeds live in config, Engine can pass them through here
//   assetFeeds: AssetFeedConfig;
// };

// export type Adapter = AdapterV2 | AdapterLegacy | TypedAdapter;
export type Adapter = TypedAdapter;

// Typed adapter interface with manifest and strongly-typed handlers
export interface TypedAdapter {
  // Typed manifest with trackables
  manifest: Manifest;

  // Strongly-typed handlers that match trackable kinds
  handlers: Handlers;

  // Processor builder function
  build: (opts: { params: any; io: { redis: Redis; log: (...args: any[]) => void } }) => {
    buildProcessor: (base: BaseProcessor) => BaseProcessor;
    onBatchEnd?: (redis: Redis) => Promise<void>;
    customFeeds?: CustomFeedHandlers;
    // projectors?: Projector[];
  };
}
