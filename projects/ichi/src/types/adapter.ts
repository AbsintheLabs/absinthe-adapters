// Adapter interface and related types

import { BalanceDelta, PositionStatusChange, PositionUpdate, Reprice, ActionEvent } from './core';
import { AssetFeedConfig } from './pricing';
import { HandlerFactory } from '../feeds/interface';
import { Block, Log, processor, Transaction } from '../processor';
import { RedisClientType } from 'redis';
import { MeasureDelta } from './core';

// ------------------------------------------------------------
// EMIT FUNCTIONS
// ------------------------------------------------------------

// Emit functions for log handlers
export interface EmitFunctions {
  balanceDelta: (e: BalanceDelta, reason?: string) => Promise<void>;
  positionUpdate: (e: PositionUpdate) => Promise<void>;
  positionStatusChange: (e: PositionStatusChange) => Promise<void>;
  measureDelta: (e: MeasureDelta) => Promise<void>;
  // event: (e: OnChainEvent) => Promise<void>;
  reprice: (e: Reprice) => Promise<void>;
  custom: (namespace: string, type: string, payload: any) => Promise<void>;
  action: (e: ActionEvent) => Promise<void>;
  // add more here as scope grows
}

// Emit functions for transaction handlers
// export interface TransactionEmitFunctions {
//   event: (e: OnChainTransaction) => Promise<void>;
// }

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
  redis: RedisClientType;
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
  redis: RedisClientType;
  rpc: unknown;

  // Engine emit API (same functions you use today)
  emit: EmitFunctions;

  // Until feeds live in config, Engine can pass them through here
  assetFeeds: AssetFeedConfig;
};

// XXX: we support both for now, but we will migrate all to the new adapter interface (v2)
export type Adapter = AdapterV2 | AdapterLegacy;

export interface AdapterV2 {
  // Called once at boot. Adapter registers all subscriptions and handlers on the processor.
  buildProcessor: (base: typeof processor) => typeof processor;

  // Optional end-of-batch hook for deferred work (e.g., draining queues)
  onBatchEnd?: (redis: RedisClientType) => Promise<void>;

  // Optional custom pricing feed handlers
  customFeeds?: CustomFeedHandlers;

  // Optional projectors for custom event processing
  projectors?: Projector[];
}

// Adapter interface (you implement this per protocol)
export interface AdapterLegacy {
  onLog?(
    block: Block,
    log: Log,
    emit: EmitFunctions,
    rpcCtx: RpcContext,
    redis: RedisClientType,
  ): Promise<void>;
  // note: transaction tracking only supports event-based tracking, not time-weighted
  onTransaction?(block: Block, transaction: Transaction, emit: EmitFunctions): Promise<void>;
  // Called at the end of each batch for cleanup/deferred operations
  onBatchEnd?(redis: RedisClientType): Promise<void>;
  feedConfig: AssetFeedConfig;
  // Optional custom pricing feed handlers
  customFeeds?: CustomFeedHandlers;
  // Optional projectors for custom event processing
  projectors?: Projector[];
}
