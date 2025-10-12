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

    // Try to get vault metadata from Redis first (much faster!)
    const marketDataKey = `morpho:vault:${vaultAddress}`;
    const marketDataStr = await ctx.redis.get(marketDataKey);

    let underlyingAssetAddress: string;

    if (marketDataStr) {
      // Found in Redis - use cached data
      const marketData = JSON.parse(marketDataStr);
      underlyingAssetAddress = marketData.asset.toLowerCase();
      logger.debug(
        `Retrieved vault metadata from Redis for ${vaultAddress}: underlying=${underlyingAssetAddress}`,
      );
    } else {
      // Fallback: fetch from contract (in case vault wasn't created via factory)
      logger.debug(`Vault ${vaultAddress} not in Redis, fetching from contract`);
      const vaultContract = new morphov1Vaults.Contract(ctx.sqdRpcCtx, vaultAddress);
      underlyingAssetAddress = (await vaultContract.asset()).toLowerCase();
      logger.debug(`Fetched underlying asset from contract: ${underlyingAssetAddress}`);
    }

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
    // 1 share (1e18) = marketIndex assets
    // share_price = asset_price * (marketIndex / 1e18)
    const sharePrice = new Big(underlyingPriceResult.price).mul(marketIndex.toString()).div(1e18);

    logger.debug(`Final vault share price for ${vaultAddress}: ${sharePrice.toString()}`);

    return Number(sharePrice.toString());
  } catch (error) {
    logger.warn(`Failed to price Morpho V1 Vault ${ctx.asset}:`, error);
    return 0;
  }
});
