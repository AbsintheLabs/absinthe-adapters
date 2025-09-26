import { Enricher, EnrichmentContext } from '../core.ts';
import { AssetInfo } from '../../types/events.ts';
import { AssetType } from '../../config/schema.ts';

type AssetInfoFields = {
  assetInfo: AssetInfo;
};

export const enrichAssetMetadata = <T extends { asset: string }>(): Enricher<
  T,
  T & AssetInfoFields
> => {
  return async (item, context) => {
    const { asset } = item;

    // Parse asset string to extract components
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

    const assetInfo: AssetInfo = {
      asset: assetAddress,
      tokenId,
      decimals,
      assetType,
    };

    return {
      ...item,
      assetInfo,
    };
  };
};
