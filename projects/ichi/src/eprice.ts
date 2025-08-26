// 💵💵💵💵💵💵💵💵 PRICE INTERFACES 💵💵💵💵💵💵💵💵💵

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------
// COMMON
import Big from 'big.js';
import { RedisClientType } from 'redis';

// PROCESSOR
import { Block, ProcessorContext } from './processor';

// FEEDS
// import { FeedHandler, FeedHandlerFactory } from "./feeds/interface";
import { HandlerFactory, HandlerFn, ExecutorFn, ResolveResult } from './feeds/interface';
import { coinGeckoFactory } from './feeds/coingecko';
import { peggedFactory } from './feeds/pegged';

// DEFAULT CONTRACT ABIs
// importing ABIs for each of the token assets (//todo: later separate these into separate files)
import * as erc20Abi from './abi/erc20';
import { ichinavFactory } from './feeds/ichinav';
import { Chain } from '@subsquid/evm-processor/lib/interfaces/chain';
// ------------------------------------------------------------
// END IMPORTS
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
// todo: need to allow an implementer to create their own custom feed selector as part of the adapter
export type FeedSelector =
  | { kind: 'coingecko'; id: string }
  | { kind: 'pegged'; usdPegValue: number }
  | { kind: 'univ2nav'; token0: TokenSelector; token1: TokenSelector }
  | { kind: 'ichinav'; token0: TokenSelector; token1: TokenSelector };
// | { kind: string;[k: string]: any }; // let implementers extend // warn: have to see if this is proper
// | { kind: 'coingeckoToken'; platformId: string; address: string } // /simple/token_price/{platform}
// | { kind: 'defillama'; chain: string; address: string } // "ethereum:0x..."
// | { kind: 'coinpaprika'; id: string }               // e.g., "btc-bitcoin"
// | { kind: 'coincodex'; symbol: string };            // if you add CoinCodex

export type TokenSelector = {
  assetType: AssetType; // tokens only
  priceFeed: FeedSelector;
};

// 📁📁📁📁📁📁  BEGIN  CACHE LOGIC 📁📁📁📁📁📁📁

export interface AssetMetadata {
  decimals: number;
  symbol?: string;
  name?: string;
}

// cache 1: metadata cache
export interface MetadataCache {
  get(assetKey: string): Promise<AssetMetadata | null>;
  set(assetKey: string, metadata: AssetMetadata): Promise<void>;
}

export class RedisMetadataCache implements MetadataCache {
  constructor(private redis: RedisClientType) {}

  private key(assetKey: string) {
    return `metadata:${assetKey}`;
  }

  async get(assetKey: string): Promise<AssetMetadata | null> {
    const key = this.key(assetKey);
    const result = await this.redis.json.get(key);
    return result as AssetMetadata | null;
  }

  async set(assetKey: string, metadata: AssetMetadata): Promise<void> {
    const key = this.key(assetKey);
    await this.redis.json.set(key, '$', metadata as any);
  }
}

// cache 2: price cache

export interface PriceCacheTS {
  // bucketed insert and lookup
  set(assetKey: string, atMs: number, price: number): Promise<void>;
  get(assetKey: string, atMs: number, bucketMs: number): Promise<number | null>;
}

export class RedisTSCache implements PriceCacheTS {
  constructor(
    private redis: RedisClientType,
    private labelProvider = 'pricing',
  ) {}

  private key(series: string) {
    return `price:${series}`;
  }

  private async ensureSeries(key: string, assetLabel: string) {
    // TS.CREATE <key> DUPLICATE_POLICY LAST LABELS provider <label> asset <assetLabel>
    try {
      await this.redis.ts.create(key, {
        DUPLICATE_POLICY: 'LAST',
        LABELS: {
          provider: this.labelProvider,
          asset: assetLabel,
        },
      });
    } catch (e: any) {
      // ignore "key exists"
      const msg = String(e?.message ?? e);
      if (!msg.includes('exists')) throw e;
    }
  }

  async set(seriesKey: string, timestampMs: number, price: number) {
    console.log('setting price for', seriesKey, timestampMs, price);
    const key = this.key(seriesKey);
    await this.ensureSeries(key, seriesKey);
    // TS.ADD <key> <ts> <value> ON_DUPLICATE LAST
    await this.redis.ts.add(key, timestampMs, price, {
      ON_DUPLICATE: 'LAST',
    });
  }

  // // fixme: need to ensure that the bucketing logic is actually sound
  // async get(seriesKey: string, timestampMs: number, bucketMs: number): Promise<number | null> {
  //     const key = this.key(seriesKey);
  //     // exact bucket
  //     if (!(await this.redis.exists(key))) return null;

  //     const exact = await this.redis.ts.range(key, timestampMs, timestampMs);
  //     if (Array.isArray(exact) && exact.length)
  //         return parseFloat(exact[0].value as unknown as string);
  //     // previous sample <= bucket
  //     const prev = await this.redis.ts.revRange(key, 0, bucketMs, { COUNT: 1 });
  //     return Array.isArray(prev) && prev.length
  //         ? parseFloat(prev[0].value as unknown as string)
  //         : null;
  // }
  // Returns the price that applies to the bucket which contains `atMs`.
  // – If there is a sample whose timestamp falls **inside** that bucket, we use it.
  // – Otherwise we fall back to the last sample **before** that bucket.
  // – If the series does not exist or we can’t find any sample, we return null.
  async get(
    seriesKey: string,
    atMs: number, // any ts inside the bucket you care about
    bucketMs: number, // bucket width in ms
  ): Promise<number | null> {
    const key = this.key(seriesKey);

    // 0. Series doesn’t exist → no price
    if (!(await this.redis.exists(key))) return null;

    // 1. Calculate bucket boundaries
    const bucketStart = Math.floor(atMs / bucketMs) * bucketMs;
    const bucketEnd = bucketStart + bucketMs - 1;

    // 2. Do we have a sample exactly at the bucketStart? (fast path)
    const exact = await this.redis.ts.range(key, bucketStart, bucketStart);
    if (exact.length) return Number(exact[0].value);

    // 3. Otherwise get the latest sample **up to atMs**
    const latest = await this.redis.ts.revRange(key, 0, atMs, { COUNT: 1 });
    if (!latest.length) return null; // nothing before/at atMs

    // 4. Ensure that sample is inside the *current* bucket, not an older one
    const { timestamp, value } = latest[0];
    if (timestamp < bucketStart) return null; // stale → treat as missing

    return Number(value);
  }
}

// 📁📁📁📁📁📁  END  CACHE LOGIC 📁📁📁📁📁📁📁
// 📁📁📁📁📁📁  END  CACHE LOGIC 📁📁📁📁📁📁📁
// 📁📁📁📁📁📁  END  CACHE LOGIC 📁📁📁📁📁📁📁

// METADATA RESOLUTION STRATEGY

export interface AssetTypeHandler {
  getMetadata(ctx: ResolveContext): Promise<AssetMetadata | null>;
  normalizeAmount?(amount: Big, metadata: AssetMetadata): Big;
}

// Handlers
export const erc20Handler: AssetTypeHandler = {
  getMetadata: async (ctx: ResolveContext) => {
    const erc20Contract = new erc20Abi.Contract(
      { _chain: ctx.sqdCtx._chain, block: { height: ctx.block.header.height } }, // BlockContext
      ctx.asset,
    );
    const decimals = await erc20Contract.decimals();
    // note: we are omitting symbol and name for now since we don't use them and it's extra RPC calls for this
    return { decimals: Number(decimals) };
  },
  normalizeAmount: (amount: Big, metadata: AssetMetadata) =>
    amount.div(Big(10).pow(metadata.decimals)),
};

// export const splHandler: AssetTypeHandler = {
//     getMetadata: async (assetKey: string, ctx: ResolveContext) => {
//         // todo: implement
//         return { decimals: 9 };
//     }
// };

// todo: clean up the metadata resolver to be co-located with the code that actually uses it
export const metadataResolver = new Map<AssetType, AssetTypeHandler>([
  ['erc20', erc20Handler],
  // ['spl', splHandler],
]);

// END METADATA RESOLUTION STRATEGY

type Key = string; // stable cache key for a selector

function stableKey(sel: unknown): Key {
  // deterministic JSON, keys sorted once is good enough here
  // todo: need to ensure that this is actually stable
  return JSON.stringify(sel, Object.keys(sel as any).sort());
}

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

export interface PriceFeedable {
  priceUSD(asset: AssetKey, atMs: number): Promise<number>;
}

export class HandlerRegistry {
  private factories = new Map<string, HandlerFactory<any>>();
  private handlers = new Map<string, HandlerFn>();

  register<T extends FeedSelector['kind']>(
    kind: T,
    factory: HandlerFactory<T>,
    { replace = false } = {},
  ) {
    if (!replace && this.factories.has(kind)) throw new Error(`handler exists for ${kind}`);
    this.factories.set(kind, factory);
  }

  initialize(buildExec: (reg: HandlerRegistry) => ExecutorFn) {
    const exec = buildExec(this); // build the universal resolver
    for (const [kind, factory] of this.factories) {
      // pass in a function that takes in itself and returns the handler function
      this.handlers.set(kind, factory(exec)); // factory -> handler
    }
  }

  // Get a ready handler. It expects the caller to pass ctx and resolve properly.
  get(kind: string): HandlerFn | undefined {
    return this.handlers.get(kind);
  }
}

// facade over the handler registry and the resolveSelector method
export class PricingEngine {
  private registry = new HandlerRegistry();

  constructor() {
    // Register all handlers
    this.registry.register('coingecko', coinGeckoFactory);
    this.registry.register('pegged', peggedFactory);
    this.registry.register('ichinav', ichinavFactory);
    // this.registry.register('univ2nav', univ2navHandler);
    // add more handlers here...

    // Initialize handlers with THIS method as the resolver
    this.registry.initialize((_) => this.resolveSelector.bind(this));
  }

  private async resolveSelector(
    assetConfig: AssetConfig,
    asset: AssetKey,
    ctx: ResolveContext,
  ): Promise<ResolveResult> {
    // Get handler from registry
    const handler = this.registry.get(assetConfig.priceFeed.kind);
    if (!handler) throw new Error(`No handler for ${assetConfig.priceFeed.kind}`);

    // set the asset key in the ctx as we're pricing a new asset now
    // ctx.asset = asset;
    const localCtx: ResolveContext = {
      ...ctx,
      asset: asset,
    };

    // step 1: metadata resolution
    // tbd...
    let metadata = await localCtx.metadataCache.get(localCtx.asset);
    if (!metadata) {
      const metaResolver = metadataResolver.get(assetConfig.assetType);
      if (!metaResolver) throw new Error(`No metadata resolver for ${assetConfig.assetType}`);
      metadata = await metaResolver.getMetadata(localCtx);
      // note: we always expect metadata to be found here since we call metadata resolver BEFORE the price
      if (!metadata) {
        throw new Error(`No metadata found for ${localCtx.asset}`);
      }
      await localCtx.metadataCache.set(localCtx.asset, metadata);
    }

    // step 2: price resolution
    const cached = await localCtx.priceCache.get(localCtx.asset, localCtx.atMs, localCtx.bucketMs);
    if (cached != null) {
      console.log('cached price found for', localCtx.asset, localCtx.atMs, cached);
      return { price: cached, metadata };
    }

    console.log('resolving price for', localCtx.asset, localCtx.atMs);
    // Call handler with recursion capability
    // todo: we might want to return the time as well, as the feeds might give back a different time than the one that we asked for
    const price = await handler({
      assetConfig,
      ctx: localCtx,
      recurse: (childCfg, childAssetKey, childCtx) =>
        this.resolveSelector(childCfg, childAssetKey, childCtx ?? localCtx),
    });

    await localCtx.priceCache.set(localCtx.asset, localCtx.atMs, price);
    // return price.price;
    return { price, metadata };
  }

  async priceAsset(assetConfig: AssetConfig, ctx: ResolveContext): Promise<number> {
    const price = await this.resolveSelector(assetConfig, ctx.asset, ctx);
    return price.price;
  }
}
