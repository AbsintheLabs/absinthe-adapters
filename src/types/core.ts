// Core type definitions for the ICHI indexer

import Big from 'big.js';
import { InstanceFrom, TrackableDef } from './manifest.ts';

// Normalized Context
// export interface NormalizedEventContext {
//   ts: number;
//   height: number;
//   txHash: string;
//   logIndex?: number;
//   // chainType: 'evm' | 'solana';
//   // eventType: 'log' | 'transaction'; // | 'instruction' <-- for when solana comes in
//   // block: any;
// }

// TWB RELATED TYPES

export type MetadataValue = number | string;

export type BalanceDelta = {
  user: string;
  asset: string;
  amount: Big;
  activity: Activity;
  trackableInstance: InstanceFrom<TrackableDef>;
  // only support primitive types for metadata with flat structure
  meta?: Record<string, MetadataValue>;
};

// Syntactic sugar over BalanceDelta for position updates (amount is always new Big(0))
export type PositionUpdate = Omit<BalanceDelta, 'amount'>;

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

// potentially, make key optional and generate a uuid for it by defualt? otherwise, too easy to make a mistake
export type ActionEventBase = {
  key: string;
  user: string;
  activity: Activity;
  trackableInstance: InstanceFrom<TrackableDef>;
  meta?: Record<string, MetadataValue>;
};

export type ActionEventPriced = ActionEventBase & {
  // priceable: true;
  amount: Amount;
};

export type ActionEventUnpriced = ActionEventBase & {
  // priceable: false;
};

export type ActionEvent = ActionEventPriced | ActionEventUnpriced;

export type Swap = ActionEventPriced & {
  activity: 'swap';
  meta: {
    fromTkAddress: string;
    toTkAddress: string;
    fromTkAmount: string;
    toTkAmount: string;
  };
};

/**
 * Helper to determine if a trackable instance should be priced.
 * An instance is priceable if:
 * 1. It has quantityType === 'token_based' (enforced by TrackableDef type)
 * 2. AND a pricing config is provided at runtime
 */
export function isPriceableInstance(instance: InstanceFrom<TrackableDef>): boolean {
  return instance.pricing !== undefined;
}

export type Reprice = {
  asset: string;
};

// ------------------------------------------------------------
// INDEXER TYPES
// ------------------------------------------------------------

/**
 * @deprecated This type is deprecated and will be removed in a future release.
 * Please migrate to the new indexer type definitions in src/types/indexer.ts.
 */
export type IndexerMode = 'evm' | 'solana';

// ------------------------------------------------------------
// ASSET METADATA
// ------------------------------------------------------------

export interface AssetMetadata {
  decimals: number;
  symbol?: string;
  name?: string;
}
