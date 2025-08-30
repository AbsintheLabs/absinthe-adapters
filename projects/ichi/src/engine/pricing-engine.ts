// Pricing engine implementation

import { HandlerFactory, HandlerFn, ExecutorFn, ResolveResult } from '../feeds/interface';
import { coinGeckoFactory } from '../feeds/coingecko';
import { peggedFactory } from '../feeds/pegged';
import { ichinavFactory } from '../feeds/ichinav';
import { univ2NavFactory } from '../feeds/univ2nav';
import { AssetConfig, AssetKey, FeedSelector, ResolveContext } from '../types/pricing';
import { metadataResolver } from './asset-handlers';
import { CustomFeedHandlers } from '../types/adapter';
import { log } from '../utils/logger';

type Key = string; // stable cache key for a selector

function stableKey(sel: unknown): Key {
  // deterministic JSON, keys sorted once is good enough here
  // todo: need to ensure that this is actually stable
  return JSON.stringify(sel, Object.keys(sel as any).sort());
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

  constructor(customFeeds?: CustomFeedHandlers) {
    // Register all core handlers
    this.registry.register('coingecko', coinGeckoFactory);
    this.registry.register('pegged', peggedFactory);
    this.registry.register('ichinav', ichinavFactory);
    this.registry.register('univ2nav', univ2NavFactory);
    // add more handlers here...

    // Register custom feeds if provided
    if (customFeeds) {
      for (const [kind, factory] of Object.entries(customFeeds)) {
        this.registry.register(kind, factory, { replace: false });
      }
    }

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
      log.debug('cached price found for', localCtx.asset, localCtx.atMs, cached);
      return { price: cached, metadata };
    }

    log.debug('resolving price for', localCtx.asset, localCtx.atMs);
    // Call handler with recursion capability
    // todo: we might want to return the time as well, as the feeds might give back a different time than the one that we asked for
    const price = await handler({
      assetConfig,
      ctx: localCtx,
      recurse: (childCfg, childAssetKey, childCtx) =>
        this.resolveSelector(childCfg, childAssetKey, childCtx ?? localCtx),
    });

    console.log('price', price, metadata);

    await localCtx.priceCache.set(localCtx.asset, localCtx.atMs, price);
    // return price.price;
    return { price, metadata };
  }

  async priceAsset(assetConfig: AssetConfig, ctx: ResolveContext): Promise<number> {
    const price = await this.resolveSelector(assetConfig, ctx.asset, ctx);
    return price.price;
  }
}
