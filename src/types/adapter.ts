// Adapter interface and related types
import { z } from 'zod';
import {
  BalanceDelta,
  PositionStatusChange,
  PositionUpdate,
  Reprice,
  ActionEvent,
  Swap,
} from './core.ts';
import { AssetFeedConfig } from '../config/schema.ts';
import { HandlerFactory } from '../feeds/interface.ts';
import { Block, Log, BaseProcessor, Transaction } from '../eprocessorBuilder.ts';
import { Redis } from 'ioredis';
import { MeasureDelta } from './core.ts';
import { Manifest } from './manifest.ts';

// ------------------------------------------------------------
// EMIT FUNCTIONS
// ------------------------------------------------------------

export type BalanceDeltaReason =
  | 'BALANCE_DELTA'
  | 'POSITION_UPDATE'
  | 'EXHAUSTED'
  | 'FINAL'
  | 'INACTIVE_POSITION';

// Emit functions for log handlers
export interface EmitFunctions {
  balanceDelta: (e: BalanceDelta, reason?: BalanceDeltaReason) => Promise<void>;
  positionUpdate: (e: PositionUpdate) => Promise<void>;
  positionStatusChange: (e: PositionStatusChange) => Promise<void>;
  measureDelta: (e: MeasureDelta) => Promise<void>;
  // event: (e: OnChainEvent) => Promise<void>;
  reprice: (e: Reprice) => Promise<void>;
  custom: (namespace: string, type: string, payload: any) => Promise<void>;
  action: (e: ActionEvent) => Promise<void>;
  swap: (e: Swap) => Promise<void>;
  // add more here as scope grows
}

// ------------------------------------------------------------
// HANDLER TYPES
// ------------------------------------------------------------

// Handler context passed to all handlers
export interface HandlerContext {
  block: Block;
  log: Log;
  emit: EmitFunctions;
  rpcCtx: RpcContext;
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
export interface TrackableInstance {
  id: string;
  itemId: string;
  kind: string;
  quantityType: string;
  params: Record<string, any>;
}

// Utility function to validate handler compatibility with manifest
export function validateHandlers(manifest: Manifest, handlers: Handlers): void {
  for (const trackable of manifest.trackables) {
    const handler = handlers[trackable.id];
    if (!handler) {
      throw new Error(`Missing handler for trackable '${trackable.id}'`);
    }

    // Validate that handler type matches trackable kind
    // For now, we just ensure handlers exist. More sophisticated type checking
    // can be added later when we have more specific handler signatures
    // xxx: i think we need to do this here, and make sure that required filters are set, if pricing is provided
    // xxx: as well as attach additional fields based on the results of the validation (like `shouldPrice` etc)
  }
}

// ------------------------------------------------------------
// ADAPTER INTERFACE
// ------------------------------------------------------------

// Custom feed handler registry for adapters
export interface CustomFeedHandlers {
  [feedKind: string]: HandlerFactory<any>;
}

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
export interface RpcContext {
  _chain: any; // Chain from subsquid
  block: {
    height: number;
  };
}

export type MountCtx = {
  // App configuration (already validated by Zod)
  appCfg: any;

  // Subsquid processor instance to extend with .addLog/.addTransaction handlers
  processor: any;

  // Shared infra
  redis: Redis;
  rpc: unknown;

  // Engine emit API (same functions you use today)
  emit: EmitFunctions;

  // Until feeds live in config, Engine can pass them through here
  assetFeeds: AssetFeedConfig;
};

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
