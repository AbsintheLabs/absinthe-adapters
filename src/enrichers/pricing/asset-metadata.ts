import { Enricher, EnrichmentContext } from '../core.ts';
import { Asset, AssetType, getAssetKeyFromAsset } from '../../types/asset.ts';
import { logger } from '../../utils/logger.ts';
import { MeasurementType } from '../../types/manifest.ts';
import { getAssetMetadata } from '../../engine/asset-handlers.ts';
import { AssetMetadata } from '../../types/index.ts';

/**
 * Asset metadata fields that are always present (for token_based items).
 */
interface EnrichedAssetMetadata {
  decimals: number;
  asset_type: AssetType;
  asset_key: string;
}

/**
 * Asset metadata fields that may or may not be present (for conditional enrichment).
 */
interface EnrichedAssetMetadataOptional {
  decimals: number | null;
  asset_type: AssetType | null;
  asset_key: string | null;
}

/**
 * Minimal context needed for metadata resolution.
 * Both EnrichmentContext and ResolveContext satisfy this interface.
 */
interface MetadataResolveContext {
  metadataCache: {
    get: (key: string) => Promise<AssetMetadata | null>;
    set: (key: string, value: AssetMetadata) => Promise<void>;
  };
  sqdRpcCtx: { _chain: any; block: { height: number } };
}

/**
 * Helper function to resolve asset metadata (cache-first, then fetch).
 * Follows the same pattern as PricingEngine.resolveSelector().
 *
 * Exported for reuse across enrichers and pricing engine.
 */
export async function resolveAssetMetadata(
  asset: Asset,
  assetKey: string,
  context: MetadataResolveContext,
): Promise<AssetMetadata> {
  // Step 1: Check cache first
  logger.debug(`Checking cache for metadata: ${assetKey}`);
  let metadata = await context.metadataCache.get(assetKey);

  if (metadata) {
    logger.debug(`Cache hit for metadata: ${assetKey}`, metadata);
    return metadata;
  }

  // Step 2: Cache miss - fetch from chain
  logger.debug(`Cache miss for metadata: ${assetKey}, fetching from chain`);

  try {
    metadata = await getAssetMetadata(asset, context.sqdRpcCtx);
    logger.debug(`Fetched metadata for ${assetKey}:`, metadata);
  } catch (error) {
    logger.error(`Failed to fetch metadata for ${assetKey}:`, error);
    throw new Error(`Failed to fetch metadata for ${assetKey}: ${error}`);
  }

  // Step 3: Validate result
  if (!metadata) {
    logger.error(`No metadata returned for ${assetKey}`);
    throw new Error(`No metadata returned for ${assetKey}`);
  }

  // Step 4: Cache the metadata
  try {
    await context.metadataCache.set(assetKey, metadata);
    logger.debug(`Cached metadata for ${assetKey}`);
  } catch (error) {
    logger.error(`Failed to cache metadata for ${assetKey}:`, error);
    // Don't throw - we still want to return the metadata
  }

  return metadata;
}

/**
 * Enriches asset metadata for token-based items only.
 * Guaranteed to always populate decimals, assetType, and assetKey.
 *
 * Use for windows pipeline (always token_based).
 */
export const enrichAssetMetadataForTokenBased = <
  T extends { asset: Asset; measurement_type: 'token_based' },
>(): Enricher<T, T & EnrichedAssetMetadata> => {
  return async (item, context) => {
    const assetKey = getAssetKeyFromAsset(item.asset);

    // Resolve metadata (cache-first, then fetch from chain)
    const metadata = await resolveAssetMetadata(item.asset, assetKey, context);

    return {
      ...item,
      asset_key: assetKey,
      decimals: metadata.decimals,
      asset_type: item.asset.type,
    };
  };
};

/**
 * Conditionally enriches asset metadata based on quantityType.
 *
 * - token_based: Populates decimals, assetType, assetKey from asset
 * - count/none: Sets fields to null (no asset metadata needed)
 *
 * Use for actions pipeline (may be token_based, count, or none).
 */
export const enrichAssetMetadataConditional = <
  T extends { asset?: Asset; measurement_type: MeasurementType },
>(): Enricher<T, T & EnrichedAssetMetadataOptional> => {
  return async (item, context) => {
    // Non-token based: explicitly set fields to null
    if (item.measurement_type !== 'token_based' || !item.asset) {
      return {
        ...item,
        asset_key: null,
        decimals: null,
        asset_type: null,
      };
    }

    // Token based: resolve metadata (cache-first, then fetch from chain)
    const assetKey = getAssetKeyFromAsset(item.asset);
    const metadata = await resolveAssetMetadata(item.asset, assetKey, context);

    return {
      ...item,
      asset_key: assetKey,
      decimals: metadata.decimals,
      asset_type: item.asset.type,
    };
  };
};
