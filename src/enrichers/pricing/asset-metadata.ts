import { Enricher, EnrichmentContext } from '../core.ts';
import { AssetInfo } from '../../types/events.ts';
import { AssetType } from '../../config/schema.ts';

export const enrichAssetMetadata = <T extends { asset: string }>(): Enricher<T, T & AssetInfo> => {
  return async (item, context) => {
    const { asset } = item;

    // Parse asset string to extract components
    // BUG! WITHOUT A STABLE KEY, ASSET COULD BE UNDEFINED. WE NEED TO CREATE A STABLE KEY FOR THE ASSETS
    const assetParts = asset.split(':');
    const assetType = assetParts[0] as AssetType;
    const assetAddress = assetParts[1];

    let tokenId: string | undefined;
    let decimals = 0;

    // Extract tokenId for NFTs
    if (assetType === 'erc721' && assetParts.length >= 3) {
      tokenId = assetParts[2];
    }

    // Get metadata from cache
    const metadata = await context.metadataCache.get(asset);
    if (metadata?.decimals != null) {
      decimals = Number(metadata.decimals);
    }

    return {
      ...item,
      // asset: assetAddress,
      // FIXME: THIS NEEDS TO BE FIXED!!!!!!!!!!!
      asset: assetType,
      decimals,
      assetType: 'erc20',
      tokenId,
    };
  };
};
