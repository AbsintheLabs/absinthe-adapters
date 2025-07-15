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
import { BlockHandlerContext } from './interfaces/interfaces';
import { Store } from '@subsquid/typeorm-store';

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

export async function getOptimizedTokenPrices(
  poolId: string,
  token0: { id: string; decimals: number },
  token1: { id: string; decimals: number },
  block: BlockHeader,
  coingeckoApiKey: string,
  ctx: BlockHandlerContext<Store>,
): Promise<[number, number]> {
  /* ------------------------------------------------------------ */
  /* Helpers & prelims                                            */
  /* ------------------------------------------------------------ */
  const whitelist = WHITELIST_TOKENS.map((t) => t.toLowerCase());
  const whitelistWithIds = WHITELIST_TOKENS_WITH_COINGECKO_ID;

  const token0Addr = token0.id.toLowerCase();
  const token1Addr = token1.id.toLowerCase();

  const isTok0WL = whitelist.includes(token0Addr);
  const isTok1WL = whitelist.includes(token1Addr);

  const getCGId = (addr: string) =>
    whitelistWithIds.find((t) => t.address.toLowerCase() === addr)?.coingeckoId ?? null;

  /* ------------------------------------------------------------ */
  /* 1. Neither token whitelisted → straight Coingecko            */
  /* ------------------------------------------------------------ */
  if (!isTok0WL && !isTok1WL) {
    return Promise.all([
      fetchHistoricalUsd(token0.id, block.timestamp, coingeckoApiKey),
      fetchHistoricalUsd(token1.id, block.timestamp, coingeckoApiKey),
    ]);
  }

  /* ------------------------------------------------------------ */
  /* Fetch pool quote once — we’ll reuse it below                  */
  /* ------------------------------------------------------------ */
  let price0: number | null = null; // token1 per 1 token0
  let price1: number | null = null; // token0 per 1 token1

  const needPool = isTok0WL || isTok1WL; // we’ll always hit this in “both WL” too
  if (needPool) {
    try {
      const multicall = new Multicall(ctx, MULTICALL_ADDRESS);
      const res = await multicall.tryAggregate(
        poolAbi.functions.slot0,
        poolId,
        [{}],
        MULTICALL_PAGE_SIZE,
      );
      if (res[0]?.success && res[0].value?.sqrtPriceX96) {
        [price0, price1] = sqrtPriceX96ToTokenPrices(
          res[0].value.sqrtPriceX96,
          token0.decimals,
          token1.decimals,
        );
      } else {
        throw new Error('slot0 decode failed');
      }
    } catch (e) {
      console.warn(`Multicall failed for ${poolId}; falling back to Coingecko`, e);
      price0 = price1 = null; // force fallback below
    }
  }

  /* ------------------------------------------------------------ */
  /* 2. Both tokens whitelisted                                   */
  /* ------------------------------------------------------------ */
  if (isTok0WL && isTok1WL && price0 != null && price1 != null) {
    // pick token0 as the anchor (could pick token1, result identical)
    const anchorUsd = await fetchHistoricalUsd(
      getCGId(token0Addr)!,
      block.timestamp,
      coingeckoApiKey,
    );

    const token0Usd = anchorUsd; // by definition
    const token1Usd = anchorUsd / price0; // price0 = token1 per token0

    return [token0Usd, token1Usd];
  }

  /* ------------------------------------------------------------ */
  /* 3. Exactly one token whitelisted                             */
  /* ------------------------------------------------------------ */
  if (price0 != null && price1 != null) {
    // (A) whitelist is token0
    if (isTok0WL) {
      const tok0Usd = await fetchHistoricalUsd(
        getCGId(token0Addr)!,
        block.timestamp,
        coingeckoApiKey,
      );
      const tok1Usd = tok0Usd / price0; // divide!
      return [tok0Usd, tok1Usd];
    }
    // (B) whitelist is token1
    if (isTok1WL) {
      const tok1Usd = await fetchHistoricalUsd(
        getCGId(token1Addr)!,
        block.timestamp,
        coingeckoApiKey,
      );
      const tok0Usd = tok1Usd * price1; // multiply!
      return [tok0Usd, tok1Usd];
    }
  }

  /* ------------------------------------------------------------ */
  /* 4. Fallback — pool quote unavailable or CG ID missing        */
  /* ------------------------------------------------------------ */
  return Promise.all([
    fetchHistoricalUsd(token0.id, block.timestamp, coingeckoApiKey),
    fetchHistoricalUsd(token1.id, block.timestamp, coingeckoApiKey),
  ]);
}
