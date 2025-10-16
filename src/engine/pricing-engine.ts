// Pricing engine implementation
import { FeedHandler, Asset, getAssetKeyFromAsset, Feed } from '../types/asset.ts';
import { ResolveContext } from '../types/pricing.ts';
import { AssetMetadata } from '../types/core.ts';
import { getAssetMetadata } from './asset-handlers.ts';
import { logger } from '../utils/logger.ts';

// Feed auto-discovery
import { globalFeedRegistry } from '../feeds/registry.ts';

export class HandlerRegistry {
  private handlers = new Map<string, FeedHandler<any>>();

  register(handler: FeedHandler<any>, { replace = false } = {}) {
    if (!replace && this.handlers.has(handler.name)) {
      logger.debug(`HandlerRegistry: Skipping registration of ${handler.name} - already exists`);
      return;
    }
    logger.debug(`HandlerRegistry: Registering handler for ${handler.name}`);
    logger.debug(`HandlerRegistry: Handler: ${JSON.stringify(handler)}`);
    this.handlers.set(handler.name, handler);
  }

  get(name: string): FeedHandler<any> | undefined {
    // defensive programming
    if (!name) {
      throw new Error('Handler name is undefined');
    }

    const handler = this.handlers.get(name);
    if (!handler) {
      logger.debug(
        `HandlerRegistry: No handler found for ${name}. Available: ${Array.from(this.handlers.keys()).join(', ')}`,
      );
    } else {
      logger.debug(`HandlerRegistry: Found handler for ${name}`);
    }
    return handler;
  }

  getAll(): Map<string, FeedHandler<any>> {
    return new Map(this.handlers);
  }
}

export class PricingEngine {
  private registry = new HandlerRegistry();

  getAvailableHandlers(): string[] {
    return Array.from(this.registry['handlers'].keys());
  }

  logHandlerStatus(): void {
    const handlers = this.getAvailableHandlers();
    logger.debug(`PricingEngine: Available handlers: ${handlers.join(', ')}`);
    logger.debug(`PricingEngine: Total handlers: ${handlers.length}`);
  }

  constructor(customFeeds?: Record<string, FeedHandler<any>>) {
    logger.debug('PricingEngine: Initializing...');

    // Register all auto-discovered core handlers
    logger.debug('PricingEngine: Registering auto-discovered core handlers');
    const coreFeeds = globalFeedRegistry.getAll();
    for (const [name, handler] of coreFeeds) {
      this.registry.register(handler);
    }
    logger.debug(`PricingEngine: Registered ${coreFeeds.size} core handlers`);

    // Register custom feeds if provided
    if (customFeeds) {
      logger.debug(`PricingEngine: Registering ${Object.keys(customFeeds).length} custom feeds`);
      for (const [name, handler] of Object.entries(customFeeds)) {
        this.registry.register(handler, { replace: false });
      }
    } else {
      logger.debug('PricingEngine: No custom feeds provided');
    }

    logger.debug('PricingEngine: Initialization complete');
    this.logHandlerStatus();
  }

  private async resolveSelector(
    asset: Asset,
    feedConfig: Feed,
    ctx: ResolveContext,
  ): Promise<{ price: number; metadata: AssetMetadata }> {
    const assetKey = getAssetKeyFromAsset(asset);

    // Step 1: Metadata resolution
    logger.debug(`PricingEngine: Starting metadata resolution for ${assetKey}`);
    let metadata = await ctx.metadataCache.get(assetKey);
    if (!metadata) {
      logger.debug(`PricingEngine: Metadata not cached for ${assetKey}, resolving...`);

      try {
        metadata = await getAssetMetadata(asset, ctx);
        logger.debug(`PricingEngine: Metadata resolved for ${assetKey}:`, metadata);
      } catch (error) {
        logger.error(`PricingEngine: Failed to resolve metadata for ${assetKey}:`, error);
        throw error;
      }

      if (!metadata) {
        logger.error(`PricingEngine: No metadata found for ${assetKey}`);
        throw new Error(`No metadata found for ${assetKey}`);
      }

      await ctx.metadataCache.set(assetKey, metadata);
      logger.debug(`PricingEngine: Cached metadata for ${assetKey}`);
    } else {
      logger.debug(`PricingEngine: Using cached metadata for ${assetKey}:`, metadata);
    }

    // Step 2: Price resolution (check cache first)
    if (!ctx.bypassTopLevelCache) {
      logger.debug(`PricingEngine: Checking cache for price of ${assetKey} at ${ctx.atMs}`);
      const cached = await ctx.priceCache.get(assetKey, ctx.atMs, ctx.bucketMs);
      if (cached != null) {
        logger.debug(`PricingEngine: Cache hit for ${assetKey} at ${ctx.atMs}: ${cached}`);
        return { price: cached, metadata };
      }
      logger.debug(
        `PricingEngine: Cache miss for ${assetKey} at ${ctx.atMs}, resolving fresh price`,
      );
    } else {
      logger.debug('PricingEngine: Bypassing cache for price resolution (reprice)');
    }

    // Step 3: Call handler to compute price
    let result: number;
    try {
      logger.debug(`PricingEngine: Looking up handler for ${feedConfig.kind}`);
      const handler = this.registry.get(feedConfig.kind);
      if (!handler) {
        logger.error(`PricingEngine: No handler found for ${feedConfig.kind}`);
        throw new Error(`No handler found for feed kind: ${feedConfig.kind}`);
      }

      // Validate asset type if handler specifies
      if (handler.acceptsAssetType !== 'any' && handler.acceptsAssetType !== asset.type) {
        throw new Error(
          `Handler ${handler.name} doesn't accept asset type ${asset.type} (accepts: ${handler.acceptsAssetType})`,
        );
      }

      logger.debug(`PricingEngine: Calling handler ${feedConfig.kind} for ${assetKey}`);

      // Call handler with resolve function for recursion
      // Call handler with resolve function for recursion
      result = await handler.handler({
        asset,
        config: feedConfig,
        ctx,
        metadata, // ✅ Pass the metadata we already resolved
        resolve: async (nestedAsset, nestedFeedConfig, nestedCtx) => {
          logger.debug(
            `PricingEngine: Recursive call for ${getAssetKeyFromAsset(nestedAsset)} with feed ${nestedFeedConfig.kind}`,
          );
          // Recursive call returns { price, metadata } for nested assets
          return await this.resolveSelector(nestedAsset, nestedFeedConfig, nestedCtx ?? ctx);
        },
      });

      logger.debug(`PricingEngine: Handler returned price ${result} for ${assetKey}`);
    } catch (error) {
      logger.error(`PricingEngine: Handler failed for ${assetKey}:`, error);
      throw error;
    }

    // Step 4: Cache the price
    try {
      await ctx.priceCache.set(assetKey, ctx.atMs, result);
      logger.debug(`PricingEngine: Cached price ${result} for ${assetKey} at ${ctx.atMs}`);
    } catch (error) {
      logger.error(`PricingEngine: Failed to cache price for ${assetKey}:`, error);
      // Don't throw - we still want to return the price
    }

    return { price: result, metadata };
  }

  /**
   * Price an asset using the provided feed configuration
   * This is the main entry point for pricing
   */
  async priceAsset(asset: Asset, feedConfig: Feed, ctx: ResolveContext): Promise<number> {
    logger.debug(
      `PricingEngine: priceAsset called for asset=${JSON.stringify(asset)}, feedConfig=${JSON.stringify(feedConfig)}`,
    );

    try {
      const { price } = await this.resolveSelector(asset, feedConfig, ctx);
      logger.debug(
        `PricingEngine: priceAsset returning ${price} for ${getAssetKeyFromAsset(asset)}`,
      );
      return price;
    } catch (error) {
      logger.error(`PricingEngine: priceAsset failed for ${getAssetKeyFromAsset(asset)}:`, error);
      throw error;
    }
  }
}
