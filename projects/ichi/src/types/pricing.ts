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
export type AssetType = 'erc20' | 'spl' | 'erc721';

// ----------------------------------------------------------
// ASSET MATCHING RULES
// ----------------------------------------------------------

// Kubernetes-style label selector expressions
export type LabelExpr =
  | {
      op: 'In' | 'NotIn';
      key: string;
      values: string[];
    }
  | {
      op: 'Exists' | 'DoesNotExist';
      key: string;
    }
  | {
      op: 'AnyIn';
      keys: string[];
      values: string[];
    };

// Match criteria for asset feed rules
export type AssetMatch = {
  key?: string; // glob pattern for assetKey matching
  matchLabels?: Record<string, string>; // exact label matches (AND)
  matchExpressions?: LabelExpr[]; // advanced selectors (AND)
};

// Asset feed rule with priority-based matching
export type AssetFeedRule = {
  match: AssetMatch;
  config: AssetConfig;
};

// Collection of rules for asset feed matching
export type AssetFeedConfig = AssetFeedRule[];

// ----------------------------------------------------------
// MATCHING UTILITIES
// ----------------------------------------------------------

/**
 * Convert a glob pattern to a RegExp for asset key matching
 */
export function globToRegex(glob: string): RegExp {
  // Split by | for OR logic, then process each part as a glob
  const alternatives = glob.split('|').map((part) =>
    part
      .split('*')
      .map((s) => s.replace(/[.*+?^${}()[\]\\]/g, '\\$&'))
      .join('.*'),
  );

  return new RegExp('^(' + alternatives.join('|') + ')$');
}

/**
 * Check if labels match the given criteria (Kubernetes-style selectors)
 */
export function labelsMatch(
  have: Record<string, string>,
  eq?: Record<string, string>,
  exprs?: LabelExpr[],
): boolean {
  // Check exact label matches (AND)
  if (eq && !Object.entries(eq).every(([k, v]) => have[k] === v)) {
    return false;
  }

  // Check expressions (AND)
  if (!exprs) return true;

  for (const e of exprs) {
    switch (e.op) {
      case 'Exists':
      case 'DoesNotExist':
        const val = have[e.key];
        if (e.op === 'Exists' && val === undefined) return false;
        if (e.op === 'DoesNotExist' && val !== undefined) return false;
        break;
      case 'In':
      case 'NotIn':
        const inVal = have[e.key];
        if (e.op === 'In' && (!inVal || !e.values.includes(inVal))) return false;
        if (e.op === 'NotIn' && inVal && e.values.includes(inVal)) return false;
        break;
      case 'AnyIn':
        // Check if ANY of the keys has a value that's in the values array (OR logic)
        const anyMatch = e.keys.some((key) => {
          const keyVal = have[key];
          return keyVal && e.values.includes(keyVal);
        });
        if (!anyMatch) return false;
        break;
    }
  }
  return true;
}

/**
 * Find the first matching rule for an asset key and its labels
 */
export function findConfig(
  rules: AssetFeedConfig,
  assetKey: string,
  getLabels: (k: string) => Record<string, string> | undefined,
): AssetConfig | undefined {
  const labels = getLabels(assetKey) || {};

  for (const rule of rules) {
    const { match } = rule;

    // Check key glob match
    if (match.key) {
      const regex = globToRegex(match.key.toLowerCase());
      if (regex.test(assetKey.toLowerCase())) {
        return rule.config;
      }
    }

    // Check label selectors
    if (match.matchLabels || match.matchExpressions) {
      if (labelsMatch(labels, match.matchLabels, match.matchExpressions)) {
        return rule.config;
      }
    }
  }

  return undefined;
}

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
  | { kind: 'ichinav'; token0: TokenSelector; token1: TokenSelector }
  | {
      kind: 'univ3lp';
      nonfungiblepositionmanager: string;
      tokenSelector: 'token0' | 'token1';
      token: TokenSelector;
    }
  | {
      kind: 'aavev3vardebt';
      debtTokenAddress: string;
      underlyingTokenAddress: string;
      poolAddress: string;
      underlyingTokenFeed: TokenSelector;
    };

// | { kind: 'univ3lp'; nonfungiblepositionmanager: string; tokens: { address: string, tokenSelector: TokenSelector }[] };
// ...
// add coinpaprika, defillama, codex, etc here.

// Extensible feed selector that allows custom implementations
export type FeedSelector = CoreFeedSelector | { kind: string; [key: string]: any };

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

export interface HandlerMetadataCache {
  // Store arbitrary JSON data for feed handlers with namespaced keys
  set(handlerName: string, key: string, data: any): Promise<void>;
  get(handlerName: string, key: string): Promise<any | null>;
  // Check if data exists
  has(handlerName: string, key: string): Promise<boolean>;
  // Delete specific key
  delete(handlerName: string, key: string): Promise<void>;
  // Clear all data for a specific handler
  clearHandler(handlerName: string): Promise<void>;
  // Measure-specific methods
  getMeasureAtHeight(asset: string, metric: string, height: number): Promise<string | null>;
  getMeasureNearestSnapshot(
    asset: string,
    metric: string,
    height: number,
  ): Promise<{ value: string; height: number } | null>;
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
  // handler metadata cache for storing arbitrary state
  handlerMetadataCache: HandlerMetadataCache;
  // redis client for direct access to labels and other data
  redis: RedisClientType;
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
  bypassTopLevelCache: boolean;
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
