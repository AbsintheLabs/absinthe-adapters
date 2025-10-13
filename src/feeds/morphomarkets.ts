import { defineFeed } from './define.ts';
import Big from 'big.js';
import { logger } from '../utils/logger.ts';

const MORPHO_MARKETS_HANDLER = 'morphomarkets';
const SCALE = BigInt(10 ** 18);

export default defineFeed(MORPHO_MARKETS_HANDLER, (resolve) => async ({ assetConfig, ctx }) => {
  const feedConfig = assetConfig.priceFeed;

  try {
    // ctx.asset is the composite identifier: "{marketId}-supply" or "{marketId}-borrow"
    const assetIdentifier = ctx.asset.toLowerCase();
    const lastDashIndex = assetIdentifier.lastIndexOf('-');
    const marketId = assetIdentifier.substring(0, lastDashIndex);
    const side = assetIdentifier.substring(lastDashIndex + 1);

    logger.debug(`Pricing-new ${assetIdentifier}: marketId = ${marketId}, side = ${side}`);

    // Get asset metadata from Redis
    const marketDataKey = `morpho:market:${marketId}`;
    const marketDataStr = await ctx.redis.get(marketDataKey);

    if (!marketDataStr) {
      logger.warn(`Asset data not found for ${assetIdentifier} - skipping pricing`);
      return 0;
    }

    const { loanToken, supplyIndex, borrowIndex } = JSON.parse(marketDataStr);

    // Get the appropriate index based on side
    const indexStr = side === 'supply' ? supplyIndex : borrowIndex;
    const index = BigInt(indexStr || SCALE.toString());

    logger.debug(`Pricing ${assetIdentifier}: ${side} index = ${index}, loanToken = ${loanToken}`);

    // Recursively price the underlying loan token
    const underlyingPriceResult = await resolve(
      feedConfig.underlyingAsset.pricing,
      loanToken.toLowerCase(),
      ctx,
    );

    logger.debug(`Underlying loan token ${loanToken} price: ${underlyingPriceResult.price}`);

    // Calculate share price
    // 1 share (1e18) = (index / 1e18) * underlying tokens
    // share_price_usd = underlying_price * (index / 1e18)
    const sharePrice = new Big(underlyingPriceResult.price)
      .mul(index.toString())
      .div(SCALE.toString());

    logger.debug(`Final share price for ${assetIdentifier}: ${sharePrice.toString()}`);

    return Number(sharePrice.toString());
  } catch (error) {
    logger.warn(`Failed to price Morpho Market asset ${ctx.asset}:`, error);
    return 0;
  }
});
