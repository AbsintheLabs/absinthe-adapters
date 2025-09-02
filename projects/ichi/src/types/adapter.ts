// Adapter interface and related types

import {
  BalanceDelta,
  PositionToggle,
  OnChainEvent,
  OnChainTransaction,
  OwnershipTransfer,
  Reprice,
} from './core';
import { AssetFeedConfig } from './pricing';
import { HandlerFactory } from '../feeds/interface';
import { Block, Log, Transaction } from '../processor';
import { RedisClientType } from 'redis';
import { MeasureDelta } from './core';

// ------------------------------------------------------------
// EMIT FUNCTIONS
// ------------------------------------------------------------

// Emit functions for log handlers
export interface LogEmitFunctions {
  balanceDelta: (e: BalanceDelta) => Promise<void>;
  ownershipTransfer: (e: OwnershipTransfer) => Promise<void>;
  positionToggle: (e: PositionToggle) => Promise<void>;
  measureDelta: (e: MeasureDelta) => Promise<void>;
  event: (e: OnChainEvent) => Promise<void>;
  reprice: (e: Reprice) => Promise<void>;
  custom: (namespace: string, type: string, payload: any) => Promise<void>;
  // add more here as scope grows
}

// Emit functions for transaction handlers
export interface TransactionEmitFunctions {
  event: (e: OnChainTransaction) => Promise<void>;
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
  redis: RedisClientType;
  emit: LogEmitFunctions;
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

// Adapter interface (you implement this per protocol)
export interface Adapter {
  onLog?(
    block: Block,
    log: Log,
    emit: LogEmitFunctions,
    rpcCtx: RpcContext,
    redis: RedisClientType,
  ): Promise<void>;
  // note: transaction tracking only supports event-based tracking, not time-weighted
  onTransaction?(
    block: Block,
    transaction: Transaction,
    emit: TransactionEmitFunctions,
  ): Promise<void>;
  // Called at the end of each batch for cleanup/deferred operations
  onBatchEnd?(redis: RedisClientType): Promise<void>;
  // xxx: this should not be optional as its a core part of each integration, but i dont want everything to break right now
  topic0s?: string[];
  feedConfig: AssetFeedConfig;
  // Optional custom pricing feed handlers
  customFeeds?: CustomFeedHandlers;
  // Optional projectors for custom event processing
  projectors?: Projector[];
}
