// Adapter interface and related types

import { BalanceDelta, PositionToggle, OnChainEvent, OnChainTransaction } from './core';
import { AssetFeedConfig } from './pricing';
import { HandlerFactory } from '../feeds/interface';
import { Block, Log, Transaction } from '../processor';

// ------------------------------------------------------------
// EMIT FUNCTIONS
// ------------------------------------------------------------

// Emit functions for log handlers
export interface LogEmitFunctions {
  balanceDelta: (e: BalanceDelta) => Promise<void>;
  positionToggle: (e: PositionToggle) => Promise<void>;
  event: (e: OnChainEvent) => Promise<void>;
  // fixme: figure out how we can also do event based re-pricing, rather than just pricing on a schedule
  // reprice: (e: RepriceEvent) => Promise<void>;
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

// Adapter interface (you implement this per protocol)
export interface Adapter {
  onLog?(block: Block, log: Log, emit: LogEmitFunctions): Promise<void>;
  // note: transaction tracking only supports event-based tracking, not time-weighted
  onTransaction?(
    block: Block,
    transaction: Transaction,
    emit: TransactionEmitFunctions,
  ): Promise<void>;
  // xxx: this should not be optional as its a core part of each integration, but i dont want everything to break right now
  topic0s?: string[];
  feedConfig: AssetFeedConfig;
  // Optional custom pricing feed handlers
  customFeeds?: CustomFeedHandlers;
}
