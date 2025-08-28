// Pricing-related type definitions

import Big from 'big.js';
import { RedisClientType } from 'redis';
import { Chain } from '@subsquid/evm-processor/lib/interfaces/chain';
import { Block, ProcessorContext } from '../processor';
import { AssetMetadata } from './core';

// ------------------------------------------------------------
// ASSET AND FEED TYPES
// ------------------------------------------------------------

// e.g., EVM address lowercased or "chain:addr" // todo: need to clarify this
export type AssetKey = string;

// --- Asset "what is this thing?" ---
export type AssetType = 'erc20' | 'spl';

// Each asset => how to price it (a feed tree)
export type AssetFeedConfig = Record<AssetKey, AssetConfig>;

export type AssetConfig = {
  assetType: AssetType;
  priceFeed: FeedSelector; // recursive structure below
};

// --- Feed "how to get a price?" ---
// Core feed selectors provided by the library
export type CoreFeedSelector =
  | { kind: 'coingecko'; id: string }
  | { kind: 'pegged'; usdPegValue: number }
  | { kind: 'univ2nav'; token0: TokenSelector; token1: TokenSelector }
  | { kind: 'ichinav'; token0: TokenSelector; token1: TokenSelector };

// Extensible feed selector that allows custom implementations
export type FeedSelector = CoreFeedSelector | { kind: string; [key: string]: any };
// | { kind: 'coingeckoToken'; platformId: string; address: string } // /simple/token_price/{platform}
// | { kind: 'defillama'; chain: string; address: string } // "ethereum:0x..."
// | { kind: 'coinpaprika'; id: string }               // e.g., "btc-bitcoin"
// | { kind: 'coincodex'; symbol: string };            // if you add CoinCodex

export type TokenSelector = {
  assetType: AssetType; // tokens only
  priceFeed: FeedSelector;
};

// ------------------------------------------------------------
// CACHE INTERFACES
// ------------------------------------------------------------

export interface MetadataCache {
  get(assetKey: string): Promise<AssetMetadata | null>;
  set(assetKey: string, metadata: AssetMetadata): Promise<void>;
}

export interface PriceCacheTS {
  // bucketed insert and lookup
  set(assetKey: string, atMs: number, price: number): Promise<void>;
  get(assetKey: string, atMs: number, bucketMs: number): Promise<number | null>;
}

// ------------------------------------------------------------
// RESOLVE CONTEXT
// ------------------------------------------------------------

// what needs to exist when pulling a price
export interface ResolveContext {
  // price cache
  priceCache: PriceCacheTS;
  // asset metadata cache
  metadataCache: MetadataCache;
  // the asset we are pricing
  asset: AssetKey;
  // the timestamp of the asset
  atMs: number;
  // the closest block to the timestamp
  block: Block;
  // bucketMs: number;
  bucketMs: number;
  // sqd context to make rpc calls
  sqdCtx: ProcessorContext<any>;
  // used directly by subsquid, helper method to make rpc calls
  sqdRpcCtx: {
    _chain: Chain;
    block: {
      height: number;
    };
  };
  // shared deps implementers may use
  // todo: add in later if needed, keep implementation simple for now
  // deps: Record<string, unknown>;
}

// ------------------------------------------------------------
// HANDLER INTERFACES
// ------------------------------------------------------------

export interface AssetTypeHandler {
  getMetadata(ctx: ResolveContext): Promise<AssetMetadata | null>;
  normalizeAmount?(amount: Big, metadata: AssetMetadata): Big;
}

export interface PriceFeedable {
  priceUSD(asset: AssetKey, atMs: number): Promise<number>;
}
