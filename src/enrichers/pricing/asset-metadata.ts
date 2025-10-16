import { Enricher } from '../core.ts';
import { Asset, getAssetKeyFromAsset } from '../../types/asset.ts';
import { logger } from '../../utils/logger.ts';

interface EnrichedAssetMetadata {
  decimals: number;
  assetType: string;
  assetKey: string;
}

export const enrichAssetMetadata = <T extends { asset: Asset }>(): Enricher<
  T,
  T & EnrichedAssetMetadata
> => {
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
      assetKey: assetKey,
      decimals: metadata.decimals,
      assetType: item.asset.type,
    };
  };
};
