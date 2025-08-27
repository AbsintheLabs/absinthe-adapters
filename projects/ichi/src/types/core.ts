// Core type definitions for the ICHI indexer

import Big from 'big.js';

// ------------------------------------------------------------
// METADATA TYPES
// ------------------------------------------------------------

type MetadataValue = number | string;

export type BalanceDelta = {
  user: string;
  asset: string;
  amount: Big;
  // only support primitive types for metadata with flat structure
  meta?: Record<string, MetadataValue>;
};

export type PositionToggle = {
  // implement me!
};

export type OnChainEvent = {
  user: string;
  asset?: string;
  amount: Big;
  meta?: Record<string, MetadataValue>;
};

export type OnChainTransaction = {
  user?: string;
  asset?: string;
  amount?: Big;
  meta?: Record<string, MetadataValue>;
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