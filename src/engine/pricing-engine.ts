// Pricing engine implementation
//
// Debug logging levels:
// - HandlerRegistry: Shows handler registration and initialization
// - PricingEngine: Shows initialization and high-level pricing flow
// - ResolveSelector: Shows detailed pricing resolution steps
// - Cache operations: Shows cache hits/misses
// - Error handling: Shows failures with context
//
// To enable debug logging, set LOG_LEVEL=debug in environment

import { HandlerFactory, HandlerFn, ExecutorFn, ResolveResult } from '../feeds/interface.ts';
import { AssetConfig, AssetKey, FeedSelector, ResolveContext } from '../types/pricing.ts';
import { metadataResolver } from './asset-handlers.ts';
import { CustomFeedHandlers } from '../types/adapter.ts';
import { log } from '../utils/logger.ts';

// default feeds
import { univ3lpFactory } from '../feeds/univ3lp.ts';
import { coinGeckoFactory } from '../feeds/coingecko.ts';
import { peggedFactory } from '../feeds/pegged.ts';
import { ichinavFactory } from '../feeds/ichinav.ts';
import { univ2NavFactory } from '../feeds/univ2nav.ts';
import { aavev3varDebtFactory } from '../feeds/aavev3varDebtToken.ts';

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
    if (!replace && this.factories.has(kind)) {
      log.debug(`HandlerRegistry: Skipping registration of ${kind} - already exists`);
      return;
    }
    log.debug(`HandlerRegistry: Registering handler for ${kind}`);
    this.factories.set(kind, factory);
  }

  initialize(buildExec: (reg: HandlerRegistry) => ExecutorFn) {
    log.debug(`HandlerRegistry: Initializing with ${this.factories.size} factories`);
    const exec = buildExec(this); // build the universal resolver
    for (const [kind, factory] of this.factories) {
      // pass in a function that takes in itself and returns the handler function
      log.debug(`HandlerRegistry: Building handler for ${kind}`);
      try {
        this.handlers.set(kind, factory(exec)); // factory -> handler
        log.debug(`HandlerRegistry: Successfully built handler for ${kind}`);
      } catch (error) {
        log.error(`HandlerRegistry: Failed to build handler for ${kind}:`, error);
      }
    }
    log.debug(`HandlerRegistry: Initialization complete, ${this.handlers.size} handlers ready`);
  }

  // Get a ready handler. It expects the caller to pass ctx and resolve properly.
  get(kind: string): HandlerFn | undefined {
    const handler = this.handlers.get(kind);
    if (!handler) {
      log.debug(
        `HandlerRegistry: No handler found for ${kind}. Available: ${Array.from(this.handlers.keys()).join(', ')}`,
      );
    } else {
      log.debug(`HandlerRegistry: Found handler for ${kind}`);
    }
    return handler;
  }
}

// facade over the handler registry and the resolveSelector method
export class PricingEngine {
  private registry = new HandlerRegistry();

  // Debug method to show available handlers
  getAvailableHandlers(): string[] {
    return Array.from(this.registry['handlers'].keys());
  }

  logHandlerStatus(): void {
    const handlers = this.getAvailableHandlers();
    log.debug(`PricingEngine: Available handlers: ${handlers.join(', ')}`);
    log.debug(`PricingEngine: Total handlers: ${handlers.length}`);
  }

  constructor(customFeeds?: CustomFeedHandlers) {
    log.debug('PricingEngine: Initializing...');

    // Register all core handlers
    log.debug('PricingEngine: Registering core handlers');
    this.registry.register('coingecko', coinGeckoFactory);
    this.registry.register('pegged', peggedFactory);
    this.registry.register('ichinav', ichinavFactory);
    this.registry.register('univ2nav', univ2NavFactory);
    this.registry.register('univ3lp', univ3lpFactory);
    this.registry.register('aavev3vardebt', aavev3varDebtFactory);
    // add more handlers here...

    // Register custom feeds if provided
    if (customFeeds) {
      log.debug(`PricingEngine: Registering ${Object.keys(customFeeds).length} custom feeds`);
      for (const [kind, factory] of Object.entries(customFeeds)) {
        this.registry.register(kind, factory, { replace: false });
      }
    } else {
      log.debug('PricingEngine: No custom feeds provided');
    }

    // Initialize handlers with THIS method as the resolver
    log.debug('PricingEngine: Initializing handler registry');
    this.registry.initialize((_) => this.resolveSelector.bind(this));
    log.debug('PricingEngine: Initialization complete');

    // Log final status
    this.logHandlerStatus();
  }

  private async resolveSelector(
    assetConfig: AssetConfig,
    asset: AssetKey,
    ctx: ResolveContext,
  ): Promise<ResolveResult> {
    log.debug(
      `PricingEngine: Resolving price for asset=${asset}, kind=${assetConfig.priceFeed.kind}, assetType=${assetConfig.assetType}`,
    );

    // Get handler from registry
    const handler = this.registry.get(assetConfig.priceFeed.kind);
    if (!handler) {
      log.error(`PricingEngine: No handler found for ${assetConfig.priceFeed.kind}`);
      throw new Error(`No handler for ${assetConfig.priceFeed.kind}`);
    }
    log.debug(`PricingEngine: Found handler for ${assetConfig.priceFeed.kind}`);

    // set the asset key in the ctx as we're pricing a new asset now
    const localCtx: ResolveContext = {
      ...ctx,
      asset: asset,
    };
    log.debug(`PricingEngine: Created local context for asset ${asset}`);

    // step 1: metadata resolution
    log.debug(`PricingEngine: Starting metadata resolution for ${asset}`);
    let metadata = await localCtx.metadataCache.get(localCtx.asset);
    if (!metadata) {
      log.debug(`PricingEngine: Metadata not cached for ${asset}, resolving...`);
      const metaResolver = metadataResolver.get(assetConfig.assetType);
      if (!metaResolver) {
        log.error(`PricingEngine: No metadata resolver for ${assetConfig.assetType}`);
        throw new Error(`No metadata resolver for ${assetConfig.assetType}`);
      }
      log.debug(`PricingEngine: Found metadata resolver for ${assetConfig.assetType}`);

      try {
        metadata = await metaResolver.getMetadata(localCtx);
        log.debug(`PricingEngine: Metadata resolved for ${asset}:`, metadata);
      } catch (error) {
        log.error(`PricingEngine: Failed to resolve metadata for ${asset}:`, error);
        throw error;
      }

      if (!metadata) {
        log.error(`PricingEngine: No metadata found for ${localCtx.asset}`);
        throw new Error(`No metadata found for ${localCtx.asset}`);
      }
      await localCtx.metadataCache.set(localCtx.asset, metadata);
      log.debug(`PricingEngine: Cached metadata for ${asset}`);
    } else {
      log.debug(`PricingEngine: Using cached metadata for ${asset}:`, metadata);
    }

    // step 2: price resolution
    console.log('localCtx.bypassTopLevelCache: ', localCtx.bypassTopLevelCache);
    if (!localCtx.bypassTopLevelCache) {
      log.debug(`PricingEngine: Checking cache for price of ${asset} at ${localCtx.atMs}`);
      const cached = await localCtx.priceCache.get(
        localCtx.asset,
        localCtx.atMs,
        localCtx.bucketMs,
      );
      if (cached != null) {
        log.debug(`PricingEngine: Cache hit for ${asset} at ${localCtx.atMs}: ${cached}`);
        return { price: cached, metadata };
      }
      log.debug(
        `PricingEngine: Cache miss for ${asset} at ${localCtx.atMs}, resolving fresh price`,
      );
    } else {
      log.debug('PricingEngine: Bypassing cache for price resolution for reprice');
    }

    // Call handler with recursion capability
    let price: number;
    try {
      log.debug(`PricingEngine: Calling handler for ${assetConfig.priceFeed.kind}`);
      price = await handler({
        assetConfig,
        ctx: localCtx,
        recurse: (childCfg, childAssetKey, childCtx) => {
          log.debug(
            `PricingEngine: Recursive call for ${childAssetKey} with kind ${childCfg.priceFeed.kind}`,
          );
          return this.resolveSelector(childCfg, childAssetKey, childCtx ?? localCtx);
        },
      });
      log.debug(`PricingEngine: Handler returned price ${price} for ${asset}`);
    } catch (error) {
      log.error(`PricingEngine: Handler failed for ${asset}:`, error);
      throw error;
    }

    try {
      await localCtx.priceCache.set(localCtx.asset, localCtx.atMs, price);
      log.debug(`PricingEngine: Cached price ${price} for ${asset} at ${localCtx.atMs}`);
    } catch (error) {
      log.error(`PricingEngine: Failed to cache price for ${asset}:`, error);
      // Don't throw here, just log - we still want to return the price
    }

    return { price, metadata };
  }

  async priceAsset(assetConfig: AssetConfig, ctx: ResolveContext): Promise<number> {
    log.debug(
      `PricingEngine: priceAsset called for asset=${ctx.asset}, kind=${assetConfig.priceFeed.kind}`,
    );

    try {
      const result = await this.resolveSelector(assetConfig, ctx.asset, ctx);
      log.debug(`PricingEngine: priceAsset returning ${result.price} for ${ctx.asset}`);
      return result.price;
    } catch (error) {
      log.error(`PricingEngine: priceAsset failed for ${ctx.asset}:`, error);
      throw error;
    }
  }
}
