import { WHITELIST_TOKENS } from './constants';

export function sqrtPriceX96ToTokenPrices(
  sqrtPriceX96: bigint,
  decimals0: number,
  decimals1: number,
  poolAddress: string,
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
    console.error(`Price calculation failed for pool ${poolAddress}: ${error}`);
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
