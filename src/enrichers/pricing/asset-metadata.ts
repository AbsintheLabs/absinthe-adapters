import { Enricher } from '../core.ts';
import { Asset, AssetType, getAssetKeyFromAsset } from '../../types/asset.ts';
import { logger } from '../../utils/logger.ts';
import { MeasurementType } from '../../types/manifest.ts';

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

    // Get metadata from cache
    const metadata = await context.metadataCache.get(assetKey);
    if (!metadata) {
      logger.error(`Asset metadata not found for asset ${assetKey}`);
      throw new Error(`Asset metadata not found for asset ${assetKey}`);
    }

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
 * - count/none: Sets fields to undefined (no asset metadata needed)
 *
 * Use for actions pipeline (may be token_based, count, or none).
 */
export const enrichAssetMetadataConditional = <
  T extends { asset?: Asset; measurement_type: MeasurementType },
>(): Enricher<T, T & EnrichedAssetMetadataOptional> => {
  return async (item, context) => {
    // Non-token based: explicitly set fields to undefined
    if (item.measurement_type !== 'token_based' || !item.asset) {
      return {
        ...item,
        asset_key: null,
        decimals: null,
        asset_type: null,
      };
    }

    // Token based: enrich with metadata
    const assetKey = getAssetKeyFromAsset(item.asset);
    const metadata = await context.metadataCache.get(assetKey);

    if (!metadata) {
      logger.error(`Asset metadata not found for asset ${assetKey}`);
      throw new Error(`Asset metadata not found for asset ${assetKey}`);
    }

    return {
      ...item,
      asset_key: assetKey,
      decimals: metadata.decimals,
      asset_type: item.asset.type,
    };
  };
};
