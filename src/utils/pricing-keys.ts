/**
 * Utility functions for working with pricing Redis keys
 *
 * Redis pricing key format: `pricing:{assetKey}:{feedHash}`
 * - assetKey can contain colons (e.g., "erc20:0xabc", "erc721:0xabc:123")
 * - feedHash is always 8 characters (from md5HashCanonical)
 */

const PRICING_PREFIX = 'pricing:';
const FEED_HASH_LENGTH = 8;

/**
 * Extracts the asset key from a pricing Redis key
 *
 * @param pricingKey - The full pricing key (e.g., "pricing:erc20:0xabc:12345678")
 * @returns The asset key (e.g., "erc20:0xabc")
 * @throws {Error} if the key format is invalid
 *
 * @example
 * extractAssetKeyFromPricingKey("pricing:erc20:0xabc:12345678")
 * // => "erc20:0xabc"
 *
 * @example
 * extractAssetKeyFromPricingKey("pricing:erc721:0xabc:42:a1b2c3d4")
 * // => "erc721:0xabc:42"
 */
export function extractAssetKeyFromPricingKey(pricingKey: string): string {
  if (!pricingKey.startsWith(PRICING_PREFIX)) {
    throw new Error(
      `Invalid pricing key format: expected to start with "${PRICING_PREFIX}", got: ${pricingKey}`,
    );
  }

  // Remove the "pricing:" prefix
  const withoutPrefix = pricingKey.slice(PRICING_PREFIX.length);

  // Find the last colon - this separates the asset key from the hash
  const lastColonIndex = withoutPrefix.lastIndexOf(':');

  if (lastColonIndex === -1) {
    throw new Error(`Invalid pricing key format: no colon found after prefix in: ${pricingKey}`);
  }

  // Extract what should be the hash (after the last colon)
  const hash = withoutPrefix.slice(lastColonIndex + 1);

  // Validate the hash is exactly FEED_HASH_LENGTH characters
  if (hash.length !== FEED_HASH_LENGTH) {
    throw new Error(
      `Invalid pricing key format: expected hash length ${FEED_HASH_LENGTH}, got ${hash.length} in: ${pricingKey}`,
    );
  }

  // The asset key is everything before the last colon
  const assetKey = withoutPrefix.slice(0, lastColonIndex);

  if (!assetKey) {
    throw new Error(`Invalid pricing key format: empty asset key in: ${pricingKey}`);
  }

  return assetKey;
}

/**
 * Constructs a pricing Redis key from an asset key and feed hash
 *
 * @param assetKey - The asset key (e.g., "erc20:0xabc")
 * @param feedHash - The feed config hash (exactly 8 characters)
 * @returns The full pricing key (e.g., "pricing:erc20:0xabc:12345678")
 * @throws {Error} if feedHash is not exactly 8 characters
 */
export function buildPricingKey(assetKey: string, feedHash: string): string {
  if (feedHash.length !== FEED_HASH_LENGTH) {
    throw new Error(
      `Invalid feed hash length: expected ${FEED_HASH_LENGTH}, got ${feedHash.length}`,
    );
  }

  return `${PRICING_PREFIX}${assetKey}:${feedHash}`;
}
