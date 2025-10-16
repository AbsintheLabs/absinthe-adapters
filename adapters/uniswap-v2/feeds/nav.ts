// Uniswap V2 LP NAV pricing handler
// Calculates Net Asset Value of LP tokens by pricing underlying reserves

import { defineFeedHandler, FeedSchema } from '../../../src/types/asset.ts';
import Big from 'big.js';
import * as univ2Abi from '../abi/uniswap-v2.ts';
import { logger } from '../../../src/utils/logger.ts';
import { z } from 'zod';

/**
 * Pool configuration cached for each LP token
 * These values are immutable once the pool is created
 */
interface PoolConfig {
  token0Address: string;
  token1Address: string;
  lpDecimals: number;
}

/**
 * Uniswap V2 NAV Feed Handler
 *
 * Prices LP tokens by calculating their Net Asset Value:
 * LP Price = (reserve0 * price0 + reserve1 * price1) / totalSupply
 *
 * Accepts: ERC20 assets (LP tokens are ERC20)
 * Requires: Pricing config for both underlying tokens (token0, token1)
 */
export const univ2navFeed = defineFeedHandler({
  name: 'univ2nav',
  acceptsAssetType: 'erc20',
  configSchema: z.object({
    token0: FeedSchema,
    token1: FeedSchema,
  }),
  handler: async ({ asset, config, ctx, resolve }) => {
    try {
      // Asset is guaranteed to be { type: 'erc20', address: string }
      const poolAddress = asset.address.toLowerCase();

      // Create contract instance for the LP token
      const lpContract = new univ2Abi.Contract(ctx.sqdRpcCtx, poolAddress);

      // Cache key for pool configuration (immutable data)
      const poolConfigKey = poolAddress;

      // Try to get cached pool configuration first
      let poolConfig = (await ctx.handlerMetadataCache.get(
        'univ2nav',
        poolConfigKey,
      )) as PoolConfig | null;

      if (!poolConfig) {
        // Get token addresses and decimals from the pool
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

        // Cache the pool configuration (immutable)
        await ctx.handlerMetadataCache.set('univ2nav', poolConfigKey, poolConfig);
      }

      // Get pool reserves and total supply (dynamic data, not cached)
      const [reservesData, totalSupply] = await Promise.all([
        lpContract.getReserves(),
        lpContract.totalSupply(),
      ]);

      const { _reserve0: reserve0, _reserve1: reserve1 } = reservesData;

      // Recursively price both underlying tokens using the config
      const [price0Result, price1Result] = await Promise.all([
        resolve({ type: 'erc20', address: poolConfig.token0Address }, config.token0, ctx),
        resolve({ type: 'erc20', address: poolConfig.token1Address }, config.token1, ctx),
      ]);

      // Calculate LP token price using NAV formula
      // NAV = (reserve0 * price0 + reserve1 * price1) / totalSupply

      // Value of token0 reserves in USD
      const token0Value = new Big(reserve0.toString())
        .div(Math.pow(10, price0Result.metadata.decimals))
        .mul(price0Result.price);

      // Value of token1 reserves in USD
      const token1Value = new Big(reserve1.toString())
        .div(Math.pow(10, price1Result.metadata.decimals))
        .mul(price1Result.price);

      // Total pool value in USD
      const totalPoolValue = token0Value.plus(token1Value);

      // LP token price = total pool value / total LP supply
      const lpTokenPrice = totalPoolValue.div(
        new Big(totalSupply.toString()).div(Math.pow(10, poolConfig.lpDecimals)),
      );

      return Number(lpTokenPrice.toString());
    } catch (error) {
      logger.warn(`Failed to price Uniswap V2 LP token ${asset.address}:`, error);
      return 0;
    }
  },
});
