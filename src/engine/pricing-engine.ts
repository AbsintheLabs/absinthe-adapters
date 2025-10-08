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
import { ResolveContext } from '../types/pricing.ts';
import { CoreFeedSelector, FeedSelector } from '../config/schema.ts';
import { AssetConfig, AssetKey } from '../config/schema.ts';
import { metadataResolver } from './asset-handlers.ts';
import { CustomFeedHandlers } from '../types/adapter.ts';
import { logger } from '../utils/logger.ts';

// Feed auto-discovery
import { globalFeedRegistry } from '../feeds/registry.ts';
export class HandlerRegistry {
  private factories = new Map<string, HandlerFactory<any>>();
  private handlers = new Map<string, HandlerFn>();

  register<T extends CoreFeedSelector['kind']>(
    kind: T,
    factory: HandlerFactory<T>,
    { replace = false } = {},
  ) {
    if (!replace && this.factories.has(kind)) {
      logger.debug(`HandlerRegistry: Skipping registration of ${kind} - already exists`);
      return;
    }
    logger.debug(`HandlerRegistry: Registering handler for ${kind}`);
    this.factories.set(kind, factory);
  }

  initialize(buildExec: (reg: HandlerRegistry) => ExecutorFn) {
    logger.debug(`HandlerRegistry: Initializing with ${this.factories.size} factories`);
    const exec = buildExec(this); // build the universal resolver
    for (const [kind, factory] of this.factories) {
      // pass in a function that takes in itself and returns the handler function
      logger.debug(`HandlerRegistry: Building handler for ${kind}`);
      try {
        this.handlers.set(kind, factory(exec)); // factory -> handler
        logger.debug(`HandlerRegistry: Successfully built handler for ${kind}`);
      } catch (error) {
        logger.error(`HandlerRegistry: Failed to build handler for ${kind}:`, error);
      }
    }
    logger.debug(`HandlerRegistry: Initialization complete, ${this.handlers.size} handlers ready`);
  }

  // Get a ready handler. It expects the caller to pass ctx and resolve properly.
  get(kind: string): HandlerFn | undefined {
    const handler = this.handlers.get(kind);
    if (!handler) {
      logger.debug(
        `HandlerRegistry: No handler found for ${kind}. Available: ${Array.from(this.handlers.keys()).join(', ')}`,
      );
    } else {
      logger.debug(`HandlerRegistry: Found handler for ${kind}`);
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
    logger.debug(`PricingEngine: Available handlers: ${handlers.join(', ')}`);
    logger.debug(`PricingEngine: Total handlers: ${handlers.length}`);
  }

  constructor(customFeeds?: CustomFeedHandlers) {
    logger.debug('PricingEngine: Initializing...');

    // Register all auto-discovered core handlers
    logger.debug('PricingEngine: Registering auto-discovered core handlers');
    const coreFeeds = globalFeedRegistry.getAll();
    for (const [kind, factory] of coreFeeds) {
      this.registry.register(kind, factory);
    }
    logger.debug(`PricingEngine: Registered ${coreFeeds.size} core handlers`);

    // Register custom feeds if provided (allow overrides)
    if (customFeeds) {
      logger.debug(`PricingEngine: Registering ${Object.keys(customFeeds).length} custom feeds`);
      for (const [kind, factory] of Object.entries(customFeeds)) {
        this.registry.register(kind, factory, { replace: false });
      }
    } else {
      logger.debug('PricingEngine: No custom feeds provided');
    }

    // Initialize handlers with THIS method as the resolver
    logger.debug('PricingEngine: Initializing handler registry');
    this.registry.initialize((_) => this.resolveSelector.bind(this));
    logger.debug('PricingEngine: Initialization complete');

    // Log final status
    this.logHandlerStatus();
  }

  private async resolveSelector(
    assetConfig: AssetConfig,
    asset: AssetKey,
    ctx: ResolveContext,
  ): Promise<ResolveResult> {
    logger.debug(
      `PricingEngine: Resolving price for asset=${asset}, kind=${assetConfig.priceFeed.kind}, assetType=${assetConfig.assetType}`,
    );

    // Get handler from registry
    const handler = this.registry.get(assetConfig.priceFeed.kind);
    if (!handler) {
      logger.error(`PricingEngine: No handler found for ${assetConfig.priceFeed.kind}`);
      throw new Error(`No handler for ${assetConfig.priceFeed.kind}`);
    }
    logger.debug(`PricingEngine: Found handler for ${assetConfig.priceFeed.kind}`);

    // set the asset key in the ctx as we're pricing a new asset now
    const localCtx: ResolveContext = {
      ...ctx,
      asset: asset,
    };
    logger.debug(`PricingEngine: Created local context for asset ${asset}`);

    // step 1: metadata resolution
    logger.debug(`PricingEngine: Starting metadata resolution for ${asset}`);
    let metadata = await localCtx.metadataCache.get(localCtx.asset);
    if (!metadata) {
      logger.debug(`PricingEngine: Metadata not cached for ${asset}, resolving...`);
      const metaResolver = metadataResolver.get(assetConfig.assetType);
      if (!metaResolver) {
        logger.error(`PricingEngine: No metadata resolver for ${assetConfig.assetType}`);
        throw new Error(`No metadata resolver for ${assetConfig.assetType}`);
      }
      logger.debug(`PricingEngine: Found metadata resolver for ${assetConfig.assetType}`);

      try {
        metadata = await metaResolver.getMetadata(localCtx);
        logger.debug(`PricingEngine: Metadata resolved for ${asset}:`, metadata);
      } catch (error) {
        logger.error(`PricingEngine: Failed to resolve metadata for ${asset}:`, error);
        throw error;
      }

      if (!metadata) {
        logger.error(`PricingEngine: No metadata found for ${localCtx.asset}`);
        throw new Error(`No metadata found for ${localCtx.asset}`);
      }
      await localCtx.metadataCache.set(localCtx.asset, metadata);
      logger.debug(`PricingEngine: Cached metadata for ${asset}`);
    } else {
      logger.debug(`PricingEngine: Using cached metadata for ${asset}:`, metadata);
    }

    // step 2: price resolution
    console.log('localCtx.bypassTopLevelCache: ', localCtx.bypassTopLevelCache);
    if (!localCtx.bypassTopLevelCache) {
      logger.debug(`PricingEngine: Checking cache for price of ${asset} at ${localCtx.atMs}`);
      const cached = await localCtx.priceCache.get(
        localCtx.asset,
        localCtx.atMs,
        localCtx.bucketMs,
      );
      if (cached != null) {
        logger.debug(`PricingEngine: Cache hit for ${asset} at ${localCtx.atMs}: ${cached}`);
        return { price: cached, metadata };
      }
      logger.debug(
        `PricingEngine: Cache miss for ${asset} at ${localCtx.atMs}, resolving fresh price`,
      );
    } else {
      logger.debug('PricingEngine: Bypassing cache for price resolution for reprice');
    }

    // Call handler with recursion capability
    let price: number;
    try {
      logger.debug(`PricingEngine: Calling handler for ${assetConfig.priceFeed.kind}`);
      price = await handler({
        // xxx: hacking around this since no time for this right now
        assetConfig: assetConfig as any,
        ctx: localCtx,
        recurse: (childCfg, childAssetKey, childCtx) => {
          logger.debug(
            `PricingEngine: Recursive call for ${childAssetKey} with kind ${childCfg.priceFeed.kind}`,
          );
          return this.resolveSelector(childCfg, childAssetKey, childCtx ?? localCtx);
        },
      });
      logger.debug(`PricingEngine: Handler returned price ${price} for ${asset}`);
    } catch (error) {
      logger.error(`PricingEngine: Handler failed for ${asset}:`, error);
      throw error;
    }

    try {
      await localCtx.priceCache.set(localCtx.asset, localCtx.atMs, price);
      logger.debug(`PricingEngine: Cached price ${price} for ${asset} at ${localCtx.atMs}`);
    } catch (error) {
      logger.error(`PricingEngine: Failed to cache price for ${asset}:`, error);
      // Don't throw here, just log - we still want to return the price
    }

    return { price, metadata };
  }

  async priceAsset(assetConfig: AssetConfig, ctx: ResolveContext): Promise<number> {
    logger.debug(
      `PricingEngine: priceAsset called for asset=${ctx.asset}, kind=${assetConfig.priceFeed.kind}`,
    );

    try {
      const result = await this.resolveSelector(assetConfig, ctx.asset, ctx);
      logger.debug(`PricingEngine: priceAsset returning ${result.price} for ${ctx.asset}`);
      return result.price;
    } catch (error) {
      logger.error(`PricingEngine: priceAsset failed for ${ctx.asset}:`, error);
      throw error;
    }
  }
}
