// Global registry for pricing handlers to self-register
import { HandlerFactory } from './interface.ts';
import { CoreFeedSelector } from '../config/schema.ts';
import { logger } from '../utils/logger.ts';

class GlobalFeedRegistry {
  private feeds = new Map<string, HandlerFactory<any>>();

  /**
   * Register a pricing handler for auto-discovery
   * This is called by each feed module on import
   */
  register<T extends CoreFeedSelector['kind']>(kind: T, factory: HandlerFactory<T>) {
    if (this.feeds.has(kind)) {
      logger.debug(`[feed-registry] Handler ${kind} already registered, skipping`);
      return;
    }
    logger.debug(`[feed-registry] Registering handler: ${kind}`);
    this.feeds.set(kind, factory);
  }

  /**
   * Get all registered feeds for the pricing engine
   */
  getAll(): Map<string, HandlerFactory<any>> {
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
