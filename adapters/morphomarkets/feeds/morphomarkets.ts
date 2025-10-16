import { defineFeedHandler } from '../../../src/types/asset.ts';
import Big from 'big.js';
import { z } from 'zod';
import { logger } from '../../../src/utils/logger.ts';
import { SCALE } from '../consts.ts'; // e.g. 1e18 as a bigint

// 1 whole share = 1e18 share units
const SHARE_SCALE = new Big('1000000000000000000'); // 1e18

export const morphomarketsFeed = defineFeedHandler({
  name: 'morphomarkets',
  acceptsAssetType: 'custom',
  configSchema: z.object({
    underlyingAsset: z.object({
      kind: z.string(),
      id: z.string(),
    }),
  }),
  handler: async ({ asset, config, ctx, resolve }) => {
    try {
      // asset.key is "0x...-supply" or "0x...-borrow"
      const assetIdentifier = asset.key.toLowerCase();
      const lastDashIndex = assetIdentifier.lastIndexOf('-');
      if (lastDashIndex <= 0) {
        logger.warn(`Malformed morpho asset key: ${assetIdentifier}`);
        return 0;
      }

      const marketId = assetIdentifier.slice(0, lastDashIndex);
      const side = assetIdentifier.slice(lastDashIndex + 1);
      if (side !== 'supply' && side !== 'borrow') {
        logger.warn(`Unknown morpho side '${side}' for ${assetIdentifier}`);
        return 0;
      }

      // Load market data (indexes & loan token)
      const marketDataKey = `morpho:market:${marketId}`;
      const marketDataStr = await ctx.redis.get(marketDataKey);
      if (!marketDataStr) {
        logger.warn(`Asset data not found for ${assetIdentifier} - skipping pricing`);
        return 0;
      }

      const { loanToken, supplyIndex, borrowIndex } = JSON.parse(marketDataStr);
      const indexStr = (side === 'supply' ? supplyIndex : borrowIndex) ?? SCALE.toString();

      // Index is scaled by SCALE (e.g., 1e18)
      const index = new Big(indexStr);
      const indexScale = new Big(SCALE.toString());

      // Recursively price the underlying loan token (USD per 1 token)
      const underlyingPriceResult = await resolve(
        { type: 'erc20', address: loanToken.toLowerCase() },
        config.underlyingAsset,
        ctx,
      );

      const underlyingPrice = new Big(underlyingPriceResult?.price ?? 0);
      if (underlyingPrice.lte(0)) {
        logger.warn(`Underlying price 0 for ${loanToken} (market ${marketId})`);
        return 0;
      }

      // tokensPerShare = index / SCALE
      // pricePerShare (USD per 1 share) = underlyingPrice * tokensPerShare
      const pricePerShare = underlyingPrice
        .mul(index)
        .div(indexScale)
        .div(10 ** 18);

      // IMPORTANT:
      // Your composite asset reports decimals = 0 (no normalization),
      // but amounts are in *share units* (1 share = 1e18 units).
      // Therefore return USD per *unit*, not per whole share:
      // pricePerUnit = pricePerShare / 1e18

      console.log(
        'pricePerShare',
        pricePerShare.toString(),
        pricePerShare.toNumber(),
        pricePerShare,
      );
      console.log('underlyingPrice', underlyingPrice.toString());
      console.log('index', index.toString());
      console.log('indexScale', indexScale.toString());
      console.log('underlyingPrice', underlyingPrice.toString());

      return Number(pricePerShare.toString());
    } catch (error) {
      logger.warn(`Failed to price Morpho Markets asset ${asset.key}: ${String(error)}`);
      return 0;
    }
  },
});
