// Core type definitions for the ICHI indexer

import Big from 'big.js';

// Normalized Context
export interface NormalizedEventContext {
  ts: number;
  height: number;
  txHash: string;
  logIndex?: number;
  // chainType: 'evm' | 'solana';
  // eventType: 'log' | 'transaction' | 'instruction';
  eventType: 'log' | 'transaction';
  // XXX: Remove block later when we don't need the full object
  block: any;
}

// TWB RELATED TYPES

type MetadataValue = number | string;

export type BalanceDelta = {
  user: string;
  asset: string;
  amount: Big;
  activity: Activity;
  // only support primitive types for metadata with flat structure
  meta?: Record<string, MetadataValue>;
};

// Syntactic sugar over BalanceDelta for position updates (amount is always new Big(0))
export type PositionUpdate = {
  user: string;
  asset: string;
  // only support primitive types for metadata with flat structure
  meta?: Record<string, MetadataValue>;
};

export type PositionStatusChange = {
  user: string;
  asset: string;
  active: boolean;
  // optional metadata for additional context
  meta?: Record<string, MetadataValue>;
};

export type MeasureDelta = {
  asset: string; // e.g., "erc721:<PM>:<tokenId>"
  metric: string; // "liquidity" | "debt" | "shares" | ...
  delta: Big; // bigint or decimal string
  // optional for direct attribution; can be resolved later
  user?: string;
};

export type Activity =
  | 'swap'
  | 'lend'
  | 'borrow'
  | 'hold'
  | 'lp'
  | 'long'
  | 'short'
  | 'stake'
  | 'claim'
  | 'verify'
  | 'bridge'
  | 'bid'
  | 'liquidation'
  | 'delegate'
  | 'harvest'
  | 'collect'
  | 'vote'
  | (string & {});

// ACTION RELATED TYPES

export type Amount = {
  asset: string;
  amount: Big;
};

export type ActionEventBase = {
  key: string;
  user: string;
  // role?: ActionRole;
  activity: Activity;
  meta?: Record<string, MetadataValue>;
};

export type ActionEventPriced = ActionEventBase & {
  priceable: true;
  amount: Amount;
};

export type ActionEventUnpriced = ActionEventBase & {
  priceable: false;
};

export type ActionEvent = ActionEventPriced | ActionEventUnpriced;

export type Reprice = {
  asset: string;
};

// ------------------------------------------------------------
// INDEXER TYPES
// ------------------------------------------------------------

export type IndexerMode = 'evm' | 'solana';

// ------------------------------------------------------------
// ASSET METADATA
// ------------------------------------------------------------

export interface AssetMetadata {
  decimals: number;
  symbol?: string;
  name?: string;
}
