// Helper to define and auto-register pricing handlers
import { FeedHandler, Asset } from '../types/asset.ts';
import { globalFeedRegistry } from './registry.ts';

/**
 * Define a pricing handler and automatically register it.
 * This provides better DX - you don't need to remember to call register().
 *
 * @example
 * export const coingeckoFeed = defineFeed({
 *   name: 'coingecko',
 *   configSchema: z.object({ ... }),
 *   handler: async ({ asset, assetConfig, ctx, resolve }) => {
 *     // handler implementation
 *   }
 * });
 */
export function defineFeed<T extends Asset['type']>(handler: FeedHandler<T>): FeedHandler<T> {
  // Auto-register on module import
  globalFeedRegistry.register(handler);

  // Return the handler for any direct usage
  return handler;
}
