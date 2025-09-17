import { HandlerFactory } from './interface.ts';
import Big from 'big.js';
import * as univ2Abi from '../abi/univ2.ts';
import { log } from '../utils/logger.ts';
import { CoreFeedSelector } from '../types/pricing.ts';

// Handler name constant for Uniswap V2 LP NAV pricing
export const UNIV2_NAV_HANDLER = 'univ2nav';

// Official feed handler factory for Uniswap V2 LP tokens
export const univ2NavFactory: HandlerFactory<typeof UNIV2_NAV_HANDLER> =
  (resolve) =>
  async ({ assetConfig, ctx }) => {
    // Extract the univ2nav feed config from the asset config
    const feedConfig = assetConfig.priceFeed as Extract<CoreFeedSelector, { kind: 'univ2nav' }>;

    try {
      // Create contract instance for the LP token (pool address is the asset key)
      const poolAddress = ctx.asset.toLowerCase();
      const lpContract = new univ2Abi.Contract(ctx.sqdRpcCtx, poolAddress);

      // Cache key for pool configuration (use the asset key)
      const poolConfigKey = poolAddress;

      // Try to get cached pool configuration first
      let poolConfig = await ctx.handlerMetadataCache.get(UNIV2_NAV_HANDLER, poolConfigKey);

      if (!poolConfig) {
        // Get token addresses and decimals from the pool and cache them
        const [token0Address, token1Address, lpDecimals] = await Promise.all([
          lpContract.token0(),
          lpContract.token1(),
          lpContract.decimals(),
        ]);

        poolConfig = {
          token0Address: token0Address.toLowerCase(),
          token1Address: token1Address.toLowerCase(),
          lpDecimals: Number(lpDecimals.toString()),
        };

        // Cache the pool configuration
        await ctx.handlerMetadataCache.set(UNIV2_NAV_HANDLER, poolConfigKey, poolConfig);
      }

      // Get pool reserves and total supply using the contract methods
      const [reservesData, totalSupply] = await Promise.all([
        lpContract.getReserves(),
        lpContract.totalSupply(),
      ]);

      const { _reserve0: reserve0, _reserve1: reserve1 } = reservesData;

      // Get prices for both underlying tokens using recursion
      const [price0Result, price1Result] = await Promise.all([
        resolve(
          { assetType: feedConfig.token0.assetType, priceFeed: feedConfig.token0.priceFeed },
          poolConfig.token0Address, // Use cached token address as asset key
          ctx,
        ),
        resolve(
          { assetType: feedConfig.token1.assetType, priceFeed: feedConfig.token1.priceFeed },
          poolConfig.token1Address, // Use cached token address as asset key
          ctx,
        ),
      ]);

      // Calculate LP token price
      // LP Price = (reserve0 * price0 + reserve1 * price1) / totalSupply
      const token0Value = new Big(reserve0.toString())
        .div(Math.pow(10, price0Result.metadata.decimals))
        .mul(price0Result.price);
      const token1Value = new Big(reserve1.toString())
        .div(Math.pow(10, price1Result.metadata.decimals))
        .mul(price1Result.price);
      const totalPoolValue = token0Value.plus(token1Value);

      // Use cached LP token decimals
      const lpTokenPrice = totalPoolValue.div(
        new Big(totalSupply.toString()).div(Math.pow(10, poolConfig.lpDecimals)),
      );

      return Number(lpTokenPrice.toString());
    } catch (error) {
      log.warn(`Failed to price Uniswap V2 LP token ${ctx.asset}:`, error);
      return 0;
    }
  };
