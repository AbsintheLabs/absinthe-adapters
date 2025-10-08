// Utility to generate deterministic pricing handler IDs from AssetConfig
import { AssetConfig } from '../config/schema.ts';
import { md5HashCanonical } from './stable-hash.js';

/**
 * Generate a deterministic pricing handler ID from an AssetConfig.
 * This ensures that identical pricing configs share the same handler ID,
 * allowing efficient reuse across trackables.
 *
 * @param config AssetConfig to hash
 * @returns A unique identifier for this pricing configuration
 */
export function generatePricingHandlerId(config: AssetConfig): string {
  // Use md5HashCanonical for robust canonicalization and MD5 hashing
  const hash = md5HashCanonical(config, 16);

  // Return with price prefix for uniqueness
  return `price:${hash}`;
}
