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
import { HandlerFactory, HandlerFn, ExecutorFn } from './feeds/interface';
import { coinGeckoFactory } from './feeds/coingecko';
import { peggedFactory } from './feeds/pegged';

// DEFAULT CONTRACT ABIs
// importing ABIs for each of the token assets (//todo: later separate these into separate files)
import * as erc20Abi from './abi/erc20';
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
  | { kind: 'univ2nav'; token0: TokenSelector; token1: TokenSelector };
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
    return result ? JSON.parse(result as string) : null;
  }

  async set(assetKey: string, metadata: AssetMetadata): Promise<void> {
    const key = this.key(assetKey);
    await this.redis.json.set(key, '$', metadata as any);
  }
}

// cache 2: price cache

export interface PriceCacheTS {
  // bucketed insert and lookup
  set(assetKey: string, bucketMs: number, price: number): Promise<void>;
  get(assetKey: string, bucketMs: number): Promise<number | null>;
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

  async set(seriesKey: string, bucketMs: number, price: number) {
    const key = this.key(seriesKey);
    await this.ensureSeries(key, seriesKey);
    // TS.ADD <key> <ts> <value> ON_DUPLICATE LAST
    await this.redis.ts.add(key, bucketMs, price, {
      ON_DUPLICATE: 'LAST',
    });
  }

  // fixme: need to ensure that the bucketing logic is actually sound
  async get(seriesKey: string, bucketMs: number): Promise<number | null> {
    const key = this.key(seriesKey);
    // exact bucket
    const exact = await this.redis.ts.range(key, bucketMs, bucketMs);
    if (Array.isArray(exact) && exact.length)
      return parseFloat(exact[0].value as unknown as string);
    // previous sample <= bucket
    const prev = await this.redis.ts.revRange(key, 0, bucketMs, { COUNT: 1 });
    return Array.isArray(prev) && prev.length
      ? parseFloat(prev[0].value as unknown as string)
      : null;
  }
}

// 📁📁📁📁📁📁  END  CACHE LOGIC 📁📁📁📁📁📁📁
// 📁📁📁📁📁📁  END  CACHE LOGIC 📁📁📁📁📁📁📁
// 📁📁📁📁📁📁  END  CACHE LOGIC 📁📁📁📁📁📁📁

// METADATA RESOLUTION STRATEGY

export interface AssetTypeHandler {
  getMetadata(assetKey: string, ctx: ResolveContext): Promise<AssetMetadata>;
  normalizeAmount?(amount: Big, metadata: AssetMetadata): Big;
}

// Handlers
export const erc20Handler: AssetTypeHandler = {
  getMetadata: async (assetKey: string, ctx: ResolveContext) => {
    const erc20Contract = new erc20Abi.Contract(ctx.sqdCtx, ctx.block as any, assetKey);
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
  // sqd context to make rpc calls
  sqdCtx: ProcessorContext<any>;
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
    const exec = buildExec(this);
    for (const [kind, factory] of this.factories) {
      // pass in a function that takes in itself and returns the handler function
      this.handlers.set(kind, factory(exec));
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
    this.registry.register('pegged', peggedHandler);
    // this.registry.register('univ2nav', univ2navHandler);
    // add more handlers here...

    // Initialize handlers with THIS method as the resolver
    this.registry.initialize((_) => this.resolveSelector.bind(this));
  }

  private async resolveSelector(selector: FeedSelector, ctx: ResolveContext): Promise<number> {
    // Get handler from registry
    const handler = this.registry.get(selector.kind);
    if (!handler) throw new Error(`No handler for ${selector.kind}`);

    // step 1: metadata resolution
    // tbd...
    const metadata = await ctx.metadataCache.get(ctx.asset);
    if (!metadata) {
      const metadata = await metadataResolver.get(ctx.asset as AssetType);
      await ctx.metadataCache.set(ctx.asset, metadata);
    }

    // step 2: price resolution
    // Add caching logic here
    // xxx: figure out the bucketing logic later
    const bucket = Math.floor(ctx.atMs / ctx.priceBucketMs) * ctx.priceBucketMs;
    const seriesKey = `sel:${JSON.stringify(selector)}`;

    const cached = await ctx.priceCache.get(seriesKey, bucket);
    if (cached != null) return cached;

    // xxx: figure out metadata resolution later as well
    // Call handler with recursion capability
    const price = await handler({
      selector,
      ctx,
      recurse: (childSelector: FeedSelector) => this.resolveSelector(childSelector, ctx),
    });

    await ctx.priceCache.set(seriesKey, bucket, price);
    return price;
  }

  async priceAsset(feed: FeedSelector, ctx: ResolveContext): Promise<number> {
    return await this.resolveSelector(feed, ctx);
  }
}

// scratch

/* Overview:
1. config defines what type of pricing module is used for each asset. asset is just a string.
2. user can overwrite or inject their own pricing config. empty if nothing to do.
3. during initialization, pricing gets created with the proper strategies inside the engine
4. during indexing, we resolve the asset and call the appropriate pricing strategy based on the config.
how does this work? (this is the hard part)
- call priceAsset()
- we get the config for the asset (// todo: later, we'll have to make this work dynamically as well)
- call this.feedRegistry.resolve(feedSelector, atMs)
- we have to traverse the TokenFeedSelectors
    - for each one, we call pull any metadata necessary by the normalization? // fixme: where does this go?
    - we call the appropriate pricing strategy based on the config.
    - we store the result in the cache so that we can re-use cached values
    - we keep calling the resolver for each level so we get all the information for all the assets that we need

- each level has an asset type, which contains the metadata for the asset. this is used in the erc pricing strategy which will combine the price per token with the actual amount.
- this probably can only come in during the enrichment step.
- this part only needs to:
    - pull and store metadata into redis
    - pull and store price into redis

- during the enrichment step, we pull the metadata and the price back to calculate the size of each users position
- this is where an erc20 class will be helpful to abstract out token details (what metadata do we actually need, etc)
- this is also where the resolver is going to pull all the necessary information to create a graph of prices

// 5. data gets indexed. cache defaults are set per strategy. for example, erc20 will cache the metadata since decimals never change.

- for the start of each window in backfillpricedataforbatch
- call priceAsset() on each asset for each time period
- priceAsset pulls the config for the asset and calls the resolver on that pricefeed
resolve() should do a few things:
1. invoke the assetType strategy (for example, erc20 pulls decimals and caches it).
    This should also be its own adapter strategy since we might have different implementations for diff assets.
2. keep invoking the methods for each level of the pricefeed so we get all the information for all the assets that we need
*/

/* pricing complexities:
--- let's solve the basic asset problem first, then extend to univ3.
1. for assets: they are of a certain type. Each type will need its own wrapper. for example, erc20 needs to be scaled by decimals before the next pricing strategy gets used.
2. univ3: here, we don't know all the positions ahead of time. the asset is the univ3 nft. each nft needs to be priced separately by lookign at its liquidity position.
  - we don't know all the positions ahead of time, BUT we do know the pools ahead of time. How would we make it work with this?
*/
