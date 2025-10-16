import { defineFeedHandler, FeedSchema } from '../../../src/types/asset.ts';
import Big from 'big.js';
import * as morphov1Vaults from '../abi/morphov1vaults.ts';
import { z } from 'zod';
import { logger } from '../../../src/utils/logger.ts';

/**
 * Vault configuration cached for each vault
 * These values are immutable once the vault is created
 */
interface VaultConfig {
  underlyingAssetAddress: string;
  underlyingDecimals: number;
}

/**
 * Morpho Vaults V1 Feed Handler
 *
 * Prices vault shares by calculating their Net Asset Value:
 * Share Price = underlying_price * (marketIndex / 10^underlyingDecimals)
 *
 * Accepts: Custom assets (vault shares)
 * Requires: Pricing config for underlying asset
 */
export const morphov1vaultsFeed = defineFeedHandler({
  name: 'morphov1vaults',
  acceptsAssetType: 'custom',
  configSchema: z.object({
    underlyingAsset: z.object({
      kind: z.string(),
      id: z.string(),
    }),
  }),
  handler: async ({ asset, config, ctx, resolve }) => {
    try {
      // Asset is guaranteed to be { type: 'custom', prefix: 'morpho', key: string }
      const vaultAddress = asset.key.toLowerCase();

      // Create contract instance for the vault
      const vaultContract = new morphov1Vaults.Contract(ctx.sqdRpcCtx, vaultAddress);
      // Cache key for vault configuration (immutable data)
      const vaultConfigKey = vaultAddress;

      // Try to get cached vault configuration first
      let vaultConfig = (await ctx.handlerMetadataCache.get(
        'morphov1vaults',
        vaultConfigKey,
      )) as VaultConfig | null;

      if (!vaultConfig) {
        // Get vault metadata from Redis (must exist from CreateMetaMorpho event)
        const marketDataKey = `morpho:vault:${vaultAddress}`;
        const marketDataStr = await ctx.redis.get(marketDataKey);
        if (!marketDataStr) {
          logger.warn(`Vault ${vaultAddress} not found in Redis - skipping pricing`);
          return 0;
        }

        const marketData = JSON.parse(marketDataStr);

        vaultConfig = {
          underlyingAssetAddress: marketData.asset.toLowerCase(),
          underlyingDecimals: marketData.decimals,
        };
        await ctx.handlerMetadataCache.set('morphov1vaults', vaultConfigKey, vaultConfig);
      }

      // Get conversion rate: 1 share (1e18) → X assets (dynamic data, not cached)
      const marketIndex = await vaultContract.convertToAssets(BigInt(1e18));

      console.log(
        'marketIndex',
        marketIndex,
        'vaultConfig.underlyingAssetAddress',
        vaultConfig.underlyingAssetAddress,
      );
      // Recursively price the underlying asset using the config
      const underlyingPriceResult = await resolve(
        { type: 'erc20', address: vaultConfig.underlyingAssetAddress },
        config.underlyingAsset,
        ctx,
      );

      console.log('underlyingPriceResult', underlyingPriceResult);

      // Calculate vault share price
      // 1 share (1e18) = marketIndex assets (in underlying's decimals)
      // share_price = asset_price * (marketIndex / 10^underlyingDecimals)
      const sharePrice = new Big(underlyingPriceResult.price)
        .mul(marketIndex.toString())
        .div(10 ** vaultConfig.underlyingDecimals)
        .div(10 ** 18);

      console.log('sharePrice', sharePrice.toString());

      return Number(sharePrice.toString());
    } catch (error) {
      logger.warn(`Failed to price Morpho V1 Vault ${asset.key}:`, error);
      return 0;
    }
  },
});
