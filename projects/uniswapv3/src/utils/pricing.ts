import { BlockHeader } from '@subsquid/evm-processor';
import {
  fetchHistoricalUsd,
  HEMI_WHITELIST_TOKENS,
  HEMI_WHITELIST_TOKENS_WITH_COINGECKO_ID,
  logger,
} from '@absinthe/common';

export function sqrtPriceX96ToTokenPrices(
  sqrtPriceX96: bigint,
  decimals0: number,
  decimals1: number,
): number[] {
  logger.info('🔢 Starting sqrtPriceX96ToTokenPrices calculation', {
    sqrtPriceX96: sqrtPriceX96.toString(),
    decimals0,
    decimals1,
  });

  // Validate inputs
  if (!sqrtPriceX96) {
    logger.warn('❌ sqrtPriceX96 is falsy, returning [0, 0]');
    return [0, 0];
  }

  if (sqrtPriceX96 <= 0n) {
    logger.warn('❌ sqrtPriceX96 is <= 0, returning [0, 0]');
    return [0, 0];
  }

  if (decimals0 < 0 || decimals1 < 0) {
    logger.warn('❌ Invalid decimals (negative), returning [0, 0]', { decimals0, decimals1 });
    return [0, 0];
  }

  try {
    logger.info('🔄 Converting sqrtPriceX96 to float');
    // Convert sqrtPriceX96 to number safely
    const sqrtPriceFloat = Number(sqrtPriceX96);
    logger.info('📊 sqrtPriceFloat:', sqrtPriceFloat);

    if (!isFinite(sqrtPriceFloat)) {
      throw new Error('sqrtPrice conversion to float resulted in non-finite number');
    }

    logger.info('🧮 Calculating price with decimal adjustment');
    // Calculate square of price with decimal adjustment
    const price =
      (sqrtPriceFloat * sqrtPriceFloat * Math.pow(10, decimals1 - decimals0)) / Number(1n << 192n);

    logger.info('📈 Calculated raw price:', price);

    // Validate calculated price
    if (!isFinite(price) || price <= 0) {
      throw new Error('Invalid price calculation result');
    }

    const price0 = 1 / price;
    const price1 = price;

    logger.info('💰 Final calculated prices:', {
      price0: price0,
      price1: price1,
      price0Scientific: price0.toExponential(),
      price1Scientific: price1.toExponential(),
    });

    // Validate final prices
    if (!isFinite(price0) || !isFinite(price1) || price0 <= 0 || price1 <= 0) {
      throw new Error('Invalid final price values');
    }

    logger.info('✅ sqrtPriceX96ToTokenPrices completed successfully');
    return [price0, price1];
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    logger.error(`❌ Price calculation failed: ${error}`);
    logger.error(
      `Input values: sqrtPriceX96=${sqrtPriceX96}, decimals0=${decimals0}, decimals1=${decimals1}`,
    );

    return [0, 0];
  }
}

export async function getOptimizedTokenPrices(
  poolId: string,
  token0: { id: string; decimals: number },
  token1: { id: string; decimals: number },
  block: BlockHeader,
  coingeckoApiKey: string,
  chainPlatform: string,
): Promise<[number, number]> {
  const startTime = Date.now();
  logger.info('🚀 Starting getOptimizedTokenPrices', {
    poolId,
    token0: token0.id,
    token1: token1.id,
    blockHeight: block.height,
    timestamp: block.timestamp,
    timestampISO: new Date(block.timestamp).toISOString(),
    chainPlatform,
  });

  /* ------------------------------------------------------------ */
  /* Helpers & prelims                                            */
  /* ------------------------------------------------------------ */
  const whitelist = HEMI_WHITELIST_TOKENS.map((t) => t.toLowerCase());

  const token0Addr = token0.id.toLowerCase();
  const token1Addr = token1.id.toLowerCase();

  const isTok0WL = whitelist.includes(token0Addr);
  const isTok1WL = whitelist.includes(token1Addr);

  logger.info('🔍 Token whitelist analysis:', {
    poolId: poolId,
    token0Addr: token0Addr,
    token1Addr: token1Addr,
    isTok0WL: isTok0WL,
    isTok1WL: isTok1WL,
    token0CoinGeckoId: getCGId(token0Addr),
    token1CoinGeckoId: getCGId(token1Addr),
  });

  // /* ------------------------------------------------------------ */
  // /* 1. Neither token whitelisted → straight Coingecko            */
  // /* ------------------------------------------------------------ */
  // if (!isTok0WL && !isTok1WL) {
  //   logger.info('🔄 ROUTE 1: Neither token whitelisted - using CoinGecko address lookup', {
  //     chainPlatform: chainPlatform,
  //     token0Addr: token0Addr,
  //     token1Addr: token1Addr,
  //   });

  //   const addressLookupStart = Date.now();
  //   const [token0Id, token1Id] = await Promise.all([
  //     getCoingeckoIdFromAddress(chainPlatform, token0Addr, coingeckoApiKey),
  //     getCoingeckoIdFromAddress(chainPlatform, token1Addr, coingeckoApiKey),
  //   ]);
  //   logger.info(`🔍 Address lookup completed in ${Date.now() - addressLookupStart}ms:`, {
  //     token0Id,
  //     token1Id,
  //   });

  //   if (token0Id && token1Id) {
  //     logger.info('💰 Fetching historical USD prices for both tokens');
  //     const priceStart = Date.now();
  //     const prices = await Promise.all([
  //       fetchHistoricalUsd(token0Id, block.timestamp, coingeckoApiKey),
  //       fetchHistoricalUsd(token1Id, block.timestamp, coingeckoApiKey),
  //     ]);
  //     logger.info(`💰 Price fetch completed in ${Date.now() - priceStart}ms:`, {
  //       token0Price: prices[0],
  //       token1Price: prices[1],
  //       totalTime: Date.now() - startTime,
  //     });
  //     return prices;
  //   }

  //   logger.warn('❌ Could not get CoinGecko IDs for tokens, returning [0, 0]');
  //   return [0, 0];
  // }

  /* ------------------------------------------------------------ */
  /* 2. Both tokens whitelisted                                   */
  /* ------------------------------------------------------------ */
  if (isTok0WL && isTok1WL) {
    logger.info('🔄 ROUTE 2: Both tokens whitelisted - using token0 as anchor');

    const anchorStart = Date.now();
    // pick token0 as the anchor (could pick token1, result identical)
    const token0Usd = await fetchHistoricalUsd(
      getCGId(token0Addr)!,
      block.timestamp,
      coingeckoApiKey,
    );

    const token1Usd = await fetchHistoricalUsd(
      getCGId(token1Addr)!,
      block.timestamp,
      coingeckoApiKey,
    );

    logger.info(`💰 Anchor price fetch completed in ${Date.now() - anchorStart}ms:`, {
      token0Usd,
      token1Usd,
    });

    logger.info('✅ Both tokens whitelisted calculation completed:', {
      token0Usd,
      token1Usd,
      totalTime: Date.now() - startTime,
    });

    return [token0Usd, token1Usd];
  }

  return [0, 0];
}

export const getCGId = (addr: string) =>
  HEMI_WHITELIST_TOKENS_WITH_COINGECKO_ID.find(
    (t) => t.address.toLowerCase() === addr.toLowerCase(),
  )?.coingeckoId ?? null;
