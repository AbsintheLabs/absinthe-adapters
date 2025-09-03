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

// Syntactic sugar over BalanceDelta for position updates (amount is always new Big(0))
export type PositionUpdate = {
  user: string;
  asset: string;
  // only support primitive types for metadata with flat structure
  meta?: Record<string, MetadataValue>;
};

export type OwnershipTransfer = {
  // oldOwner: string;
  newOwner: string;
  asset: string;
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

export type Reprice = {
  asset: string;
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
