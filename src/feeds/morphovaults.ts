import { defineFeed } from './define.ts';
import Big from 'big.js';
import { logger } from '../utils/logger.ts';
import * as morphov1Vaults from '../abi/morphov1vaults.ts';

const MORPHO_NAV_HANDLER = 'morphovaults';

export default defineFeed(MORPHO_NAV_HANDLER, (resolve) => async ({ assetConfig, ctx }) => {
  const feedConfig = assetConfig.priceFeed;

  try {
    // ctx.asset is the vaultAddress (what we're pricing)
    const vaultAddress = ctx.asset.toLowerCase();

    // Get vault metadata from Redis (must exist from CreateMetaMorpho event)
    const marketDataKey = `morpho:vault:${vaultAddress}`;
    const marketDataStr = await ctx.redis.get(marketDataKey);

    if (!marketDataStr) {
      logger.warn(`Vault ${vaultAddress} not found in Redis - skipping pricing`);
      return 0;
    }

    const marketData = JSON.parse(marketDataStr);
    const underlyingAssetAddress = marketData.asset.toLowerCase();
    const underlyingDecimals = marketData.underlyingDecimals;

    logger.debug(
      `Retrieved vault metadata from Redis for ${vaultAddress}: underlying=${underlyingAssetAddress}, decimals=${underlyingDecimals}`,
    );

    // Get conversion rate: 1 share (1e18) → X assets
    const vaultContract = new morphov1Vaults.Contract(ctx.sqdRpcCtx, vaultAddress);
    const marketIndex = await vaultContract.convertToAssets(BigInt(1e18));

    logger.debug(`Market index for vault ${vaultAddress}: ${marketIndex.toString()}`);

    // Recursively price the underlying asset using the provided config
    const underlyingPriceResult = await resolve(
      feedConfig.underlyingAsset.pricing,
      underlyingAssetAddress,
      ctx,
    );

    logger.debug(
      `Underlying asset ${underlyingAssetAddress} price: ${underlyingPriceResult.price}`,
    );

    // Calculate vault share price
    // 1 share (1e18) = marketIndex assets (in underlying's decimals)
    // share_price = asset_price * (marketIndex / 10^underlyingDecimals)
    const sharePrice = new Big(underlyingPriceResult.price)
      .mul(marketIndex.toString())
      .div(10 ** underlyingDecimals);

    logger.debug(`Final vault share price for ${vaultAddress}: ${sharePrice.toString()}`);

    return Number(sharePrice.toString());
  } catch (error) {
    logger.warn(`Failed to price Morpho V1 Vault ${ctx.asset}:`, error);
    return 0;
  }
});
