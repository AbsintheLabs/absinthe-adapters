import { BlockHeader } from '@subsquid/evm-processor';
import {
  MULTICALL_ADDRESS,
  MULTICALL_PAGE_SIZE,
  WHITELIST_TOKENS,
  WHITELIST_TOKENS_WITH_COINGECKO_ID,
} from './constants';
import * as poolAbi from '../abi/pool';
import { Multicall } from './multicall';
import { fetchHistoricalUsd } from '@absinthe/common';

export function sqrtPriceX96ToTokenPrices(
  sqrtPriceX96: bigint,
  decimals0: number,
  decimals1: number,
): number[] {
  // Validate inputs
  if (!sqrtPriceX96) {
    return [0, 0];
  }

  if (sqrtPriceX96 <= 0n) {
    return [0, 0];
  }

  if (decimals0 < 0 || decimals1 < 0) {
    return [0, 0];
  }

  try {
    // Convert sqrtPriceX96 to number safely
    const sqrtPriceFloat = Number(sqrtPriceX96);
    if (!isFinite(sqrtPriceFloat)) {
      throw new Error('sqrtPrice conversion to float resulted in non-finite number');
    }

    // Calculate square of price with decimal adjustment
    const price =
      (sqrtPriceFloat * sqrtPriceFloat * Math.pow(10, decimals0 - decimals1)) / Number(1n << 192n);

    // Validate calculated price
    if (!isFinite(price) || price <= 0) {
      throw new Error('Invalid price calculation result');
    }

    const price0 = 1 / price;
    const price1 = price;

    // Validate final prices
    if (!isFinite(price0) || !isFinite(price1) || price0 <= 0 || price1 <= 0) {
      throw new Error('Invalid final price values');
    }

    return [price0, price1];
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Price calculation failed: ${error}`);
    console.error(
      `Input values: sqrtPriceX96=${sqrtPriceX96}, decimals0=${decimals0}, decimals1=${decimals1}`,
    );

    return [0, 0];
  }
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedAmountUSD(
  token0: string,
  amount0USD: number,
  token1: string,
  amount1USD: number,
): number {
  // Convert addresses to lowercase for comparison
  const t0 = token0.toLowerCase();
  const t1 = token1.toLowerCase();
  const whitelist = WHITELIST_TOKENS.map((t) => t.toLowerCase());

  // both are whitelist tokens, return sum of both amounts
  if (whitelist.includes(t0) && whitelist.includes(t1)) {
    return (amount0USD + amount1USD) / 2;
  }

  // take value of the whitelisted token amount
  if (whitelist.includes(t0) && !whitelist.includes(t1)) {
    return amount0USD;
  }

  // take value of the whitelisted token amount
  if (!whitelist.includes(t0) && whitelist.includes(t1)) {
    return amount1USD;
  }

  // neither token is on white list, tracked amount is 0
  return 0;
}

// ... existing code ...

// ... existing code ...

/**
 * Get optimized token prices using pool pricing for whitelist tokens
 * @param poolId - The pool address
 * @param token0 - Token0 data
 * @param token1 - Token1 data
 * @param block - Block header for timestamp
 * @param coingeckoApiKey - API key for fallback pricing
 * @param ctx - Context for multicall
 * @returns [token0PriceInUSD, token1PriceInUSD] - Both prices in USD
 */
export async function getOptimizedTokenPrices(
  poolId: string,
  token0: { id: string; decimals: number },
  token1: { id: string; decimals: number },
  block: BlockHeader,
  coingeckoApiKey: string,
  ctx: any,
): Promise<[number, number]> {
  console.log('getOptimizedTokenPrices', poolId, token0, token1, block, coingeckoApiKey, ctx);
  const whitelist = WHITELIST_TOKENS.map((t) => t.toLowerCase());
  const whitelistWithIds = WHITELIST_TOKENS_WITH_COINGECKO_ID;

  const token0Address = token0.id.toLowerCase();
  const token1Address = token1.id.toLowerCase();

  const isToken0Whitelisted = whitelist.includes(token0Address);
  const isToken1Whitelisted = whitelist.includes(token1Address);

  // Helper function to get Coingecko ID for a token
  const getCoingeckoId = (tokenAddress: string): string | null => {
    const token = whitelistWithIds.find((t) => t.address.toLowerCase() === tokenAddress);
    return token?.coingeckoId || null;
  };

  // If neither token is whitelisted, use Coingecko for both
  if (!isToken0Whitelisted && !isToken1Whitelisted) {
    const [token0Price, token1Price] = await Promise.all([
      fetchHistoricalUsd(token0.id, block.timestamp, coingeckoApiKey),
      fetchHistoricalUsd(token1.id, block.timestamp, coingeckoApiKey),
    ]);
    return [token0Price, token1Price]; // Both in USD
  }

  // If both tokens are whitelisted, use pool pricing for both
  if (isToken0Whitelisted && isToken1Whitelisted) {
    try {
      const multicall = new Multicall(ctx, MULTICALL_ADDRESS);
      // const result = await multicall.tryAggregate(
      //   poolAbi.functions.slot0,
      //   poolId,
      //   [{}],
      //   MULTICALL_PAGE_SIZE,
      // );

      // if (result[0]?.success && result[0].value?.sqrtPriceX96) {
      const [price0, price1] = sqrtPriceX96ToTokenPrices(
        // result[0].value.sqrtPriceX96,
        1000000000000000000n,
        token0.decimals,
        token1.decimals,
      );

      // Get one whitelist token price from Coingecko to anchor the pricing
      const anchorCoingeckoId = getCoingeckoId(token0Address) || getCoingeckoId(token1Address);
      if (anchorCoingeckoId) {
        const anchorTokenPrice = await fetchHistoricalUsd(
          anchorCoingeckoId,
          block.timestamp,
          coingeckoApiKey,
        );
        console.log('failing');

        // Scale the pool prices to match the anchor price
        const scale = anchorTokenPrice / (isToken0Whitelisted ? price0 : price1);

        return [price0 * scale, price1 * scale]; // Both in USD
      }
      // }
    } catch (error) {
      console.warn(`Failed to get pool pricing for ${poolId}, falling back to Coingecko:`, error);
    }
  }

  // If only one token is whitelisted, use pool pricing + Coingecko for the other
  if (isToken0Whitelisted || isToken1Whitelisted) {
    try {
      const multicall = new Multicall(ctx, MULTICALL_ADDRESS);
      const result = await multicall.tryAggregate(
        poolAbi.functions.slot0,
        poolId,
        [{}],
        MULTICALL_PAGE_SIZE,
      );

      if (result[0]?.success && result[0].value?.sqrtPriceX96) {
        const [price0, price1] = sqrtPriceX96ToTokenPrices(
          result[0].value.sqrtPriceX96,
          token0.decimals,
          token1.decimals,
        );

        // Get the whitelisted token price from Coingecko using proper ID
        const whitelistedCoingeckoId = isToken0Whitelisted
          ? getCoingeckoId(token0Address)
          : getCoingeckoId(token1Address);

        if (whitelistedCoingeckoId) {
          const whitelistedTokenPrice = await fetchHistoricalUsd(
            whitelistedCoingeckoId,
            block.timestamp,
            coingeckoApiKey,
          );

          // Scale the pool prices to match the whitelisted token price
          const scale = whitelistedTokenPrice / (isToken0Whitelisted ? price0 : price1);

          // For the non-whitelisted token, use the scaled pool price
          const nonWhitelistedTokenPrice = isToken0Whitelisted ? price1 * scale : price0 * scale;

          return isToken0Whitelisted
            ? [whitelistedTokenPrice, nonWhitelistedTokenPrice] // Both in USD
            : [nonWhitelistedTokenPrice, whitelistedTokenPrice]; // Both in USD
        }
      }
    } catch (error) {
      console.warn(`Failed to get pool pricing for ${poolId}, falling back to Coingecko:`, error);
    }
  }

  // Fallback to Coingecko for both tokens
  const [token0Price, token1Price] = await Promise.all([
    fetchHistoricalUsd(token0.id, block.timestamp, coingeckoApiKey),
    fetchHistoricalUsd(token1.id, block.timestamp, coingeckoApiKey),
  ]);

  return [token0Price, token1Price]; // Both in USD
}
