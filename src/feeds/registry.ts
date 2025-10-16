// Global registry for pricing handlers to self-register
import { FeedHandler } from '../types/asset.ts';
import { logger } from '../utils/logger.ts';

class GlobalFeedRegistry {
  private feeds = new Map<string, FeedHandler<any>>();

  /**
   * Register a pricing handler for auto-discovery
   * This is called by each feed module on import
   */
  register(handler: FeedHandler<any>) {
    if (this.feeds.has(handler.name)) {
      logger.debug(`[feed-registry] Handler ${handler.name} already registered, skipping`);
      return;
    }
    logger.debug(`[feed-registry] Registering handler: ${handler.name}`);
    this.feeds.set(handler.name, handler);
  }

  /**
   * Get all registered feeds for the pricing engine
   */
  getAll(): Map<string, FeedHandler<any>> {
    return new Map(this.feeds);
  }

  /**
   * Clear all registrations (useful for testing)
   */
  clear() {
    this.feeds.clear();
  }
}

// Export singleton instance
export const globalFeedRegistry = new GlobalFeedRegistry();
