// Helper to define and auto-register pricing handlers
import { HandlerFactory } from './interface.ts';
import { globalFeedRegistry } from './registry.ts';
import { CoreFeedSelector } from '../config/schema.ts';

/**
 * Define a pricing handler and automatically register it.
 * This provides better DX - you don't need to remember to call register().
 *
 * @example
 * export default defineFeed('coingecko', (resolve) => async (args) => {
 *   // handler implementation
 * });
 */
export function defineFeed<K extends CoreFeedSelector['kind']>(
  kind: K,
  factory: HandlerFactory<K>,
): HandlerFactory<K> {
  // Auto-register on module import
  globalFeedRegistry.register(kind, factory);

  // Return the factory for any direct usage
  return factory;
}
