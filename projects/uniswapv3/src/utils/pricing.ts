import { BlockHeader } from '@subsquid/evm-processor';
import { WHITELIST_TOKENS, WHITELIST_TOKENS_WITH_COINGECKO_ID } from './constants';
import * as poolAbi from '../abi/pool';
import { Multicall } from './multicall';
import {
  fetchHistoricalUsd,
  getCoingeckoIdFromAddress,
  HEMI_WHITELIST_TOKENS,
  HEMI_WHITELIST_TOKENS_WITH_COINGECKO_ID,
  logger,
  MULTICALL_ADDRESS_HEMI,
  MULTICALL_PAGE_SIZE,
} from '@absinthe/common';
import { BlockHandlerContext } from './interfaces/interfaces';
import { Store } from '@subsquid/typeorm-store';

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
  ctx: BlockHandlerContext<Store>,
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
  const whitelistWithIds = HEMI_WHITELIST_TOKENS_WITH_COINGECKO_ID;

  logger.info('📋 Whitelist info:', {
    whitelistTokens: whitelist,
    whitelistWithIds: whitelistWithIds.map((t) => ({ address: t.address, id: t.coingeckoId })),
  });

  const token0Addr = token0.id.toLowerCase();
  const token1Addr = token1.id.toLowerCase();

  const isTok0WL = whitelist.includes(token0Addr);
  const isTok1WL = whitelist.includes(token1Addr);

  const getCGId = (addr: string) =>
    whitelistWithIds.find((t) => t.address.toLowerCase() === addr)?.coingeckoId ?? null;

  //todo: remove this extra call from here
  logger.info('🔍 Token whitelist analysis:', {
    poolId: poolId,
    token0Addr: token0Addr,
    token1Addr: token1Addr,
    isTok0WL: isTok0WL,
    isTok1WL: isTok1WL,
    token0CoinGeckoId: getCGId(token0Addr),
    token1CoinGeckoId: getCGId(token1Addr),
  });

  /* ------------------------------------------------------------ */
  /* 1. Neither token whitelisted → straight Coingecko            */
  /* ------------------------------------------------------------ */
  if (!isTok0WL && !isTok1WL) {
    logger.info('🔄 ROUTE 1: Neither token whitelisted - using CoinGecko address lookup', {
      chainPlatform: chainPlatform,
      token0Addr: token0Addr,
      token1Addr: token1Addr,
    });

    const addressLookupStart = Date.now();
    const [token0Id, token1Id] = await Promise.all([
      getCoingeckoIdFromAddress(chainPlatform, token0Addr, coingeckoApiKey),
      getCoingeckoIdFromAddress(chainPlatform, token1Addr, coingeckoApiKey),
    ]);
    logger.info(`🔍 Address lookup completed in ${Date.now() - addressLookupStart}ms:`, {
      token0Id,
      token1Id,
    });

    if (token0Id && token1Id) {
      logger.info('💰 Fetching historical USD prices for both tokens');
      const priceStart = Date.now();
      const prices = await Promise.all([
        fetchHistoricalUsd(token0Id, block.timestamp, coingeckoApiKey),
        fetchHistoricalUsd(token1Id, block.timestamp, coingeckoApiKey),
      ]);
      logger.info(`💰 Price fetch completed in ${Date.now() - priceStart}ms:`, {
        token0Price: prices[0],
        token1Price: prices[1],
        totalTime: Date.now() - startTime,
      });
      return prices;
    }

    logger.warn('❌ Could not get CoinGecko IDs for tokens, returning [0, 0]');
    return [0, 0];
  }

  /* ------------------------------------------------------------ */
  /* Fetch pool quote once — we'll reuse it below                  */
  /* ------------------------------------------------------------ */
  let price0: number | null = null; // token1 per 1 token0
  let price1: number | null = null; // token0 per 1 token1

  const needPool = isTok0WL || isTok1WL; // we'll always hit this in "both WL" too
  if (needPool) {
    logger.info('🔄 Pool quote needed - making multicall to get slot0');
    try {
      const multicallStart = Date.now();
      const multicall = new Multicall(ctx, MULTICALL_ADDRESS_HEMI);
      logger.info('📞 Created multicall instance, calling slot0');

      const res = await multicall.tryAggregate(
        poolAbi.functions.slot0,
        poolId,
        [{}],
        MULTICALL_PAGE_SIZE,
      );

      logger.info(`📞 Multicall completed in ${Date.now() - multicallStart}ms:`, {
        success: res[0]?.success,
        hasSqrtPriceX96: !!res[0]?.value?.sqrtPriceX96,
        sqrtPriceX96: res[0]?.value?.sqrtPriceX96?.toString(),
      });

      if (res[0]?.success && res[0].value?.sqrtPriceX96) {
        logger.info('🔢 Converting sqrtPriceX96 to token prices');
        const priceCalcStart = Date.now();
        [price0, price1] = sqrtPriceX96ToTokenPrices(
          res[0].value.sqrtPriceX96,
          token0.decimals,
          token1.decimals,
        );
        logger.info(`🔢 Price calculation completed in ${Date.now() - priceCalcStart}ms:`, {
          price0,
          price1,
          price0Scientific: price0?.toExponential(),
          price1Scientific: price1?.toExponential(),
        });
      } else {
        throw new Error('slot0 decode failed');
      }
    } catch (e) {
      logger.warn(`❌ Multicall failed for ${poolId}; falling back to Coingecko:`, e);
      price0 = price1 = null; // force fallback below
    }
  }

  /* ------------------------------------------------------------ */
  /* 2. Both tokens whitelisted                                   */
  /* ------------------------------------------------------------ */
  if (isTok0WL && isTok1WL && price0 != null && price1 != null) {
    logger.info('🔄 ROUTE 2: Both tokens whitelisted - using token0 as anchor');

    const anchorStart = Date.now();
    // pick token0 as the anchor (could pick token1, result identical)
    const anchorUsd = await fetchHistoricalUsd(
      getCGId(token0Addr)!,
      block.timestamp,
      coingeckoApiKey,
    );

    logger.info(`💰 Anchor price fetch completed in ${Date.now() - anchorStart}ms:`, {
      anchorToken: token0Addr,
      anchorUsd,
    });

    const token0Usd = anchorUsd; // by definition
    const token1Usd = anchorUsd / price0; // price0 = token1 per token0

    logger.info('✅ Both tokens whitelisted calculation completed:', {
      token0Usd,
      token1Usd,
      calculation: `token1Usd = ${anchorUsd} / ${price0} = ${token1Usd}`,
      totalTime: Date.now() - startTime,
    });

    return [token0Usd, token1Usd];
  }

  /* ------------------------------------------------------------ */
  /* 3. Exactly one token whitelisted                             */
  /* ------------------------------------------------------------ */
  if (price0 != null && price1 != null) {
    logger.info('🔄 ROUTE 3: Exactly one token whitelisted');

    // (A) whitelist is token0
    if (isTok0WL) {
      logger.info('🔄 ROUTE 3A: Token0 is whitelisted');
      const priceStart = Date.now();

      const tok0Usd = await fetchHistoricalUsd(
        getCGId(token0Addr)!,
        block.timestamp,
        coingeckoApiKey,
      );

      const tok1Usd = tok0Usd / price0; // divide!

      logger.info(`✅ Token0 whitelisted calculation completed in ${Date.now() - priceStart}ms:`, {
        tok0Usd,
        tok1Usd,
        calculation: `tok1Usd = ${tok0Usd} / ${price0} = ${tok1Usd}`,
        totalTime: Date.now() - startTime,
      });

      return [tok0Usd, tok1Usd];
    }

    // (B) whitelist is token1
    if (isTok1WL) {
      logger.info('🔄 ROUTE 3B: Token1 is whitelisted');
      const priceStart = Date.now();

      const tok1Usd = await fetchHistoricalUsd(
        getCGId(token1Addr)!,
        block.timestamp,
        coingeckoApiKey,
      );

      const tok0Usd = tok1Usd * price1; // multiply!

      logger.info(`✅ Token1 whitelisted calculation completed in ${Date.now() - priceStart}ms:`, {
        tok0Usd,
        tok1Usd,
        calculation: `tok0Usd = ${tok1Usd} * ${price1} = ${tok0Usd}`,
        totalTime: Date.now() - startTime,
      });

      return [tok0Usd, tok1Usd];
    }
  }

  /* ------------------------------------------------------------ */
  /* 4. Fallback — pool quote unavailable or CG ID missing        */
  /* ------------------------------------------------------------ */
  logger.info('🔄 ROUTE 4: Fallback - pool quote unavailable or CG ID missing');
  logger.info('⚠️ Using direct CoinGecko lookup as fallback');

  const fallbackStart = Date.now();
  const fallbackPrices = await Promise.all([
    fetchHistoricalUsd(token0.id, block.timestamp, coingeckoApiKey),
    fetchHistoricalUsd(token1.id, block.timestamp, coingeckoApiKey),
  ]);

  logger.info(`🔄 Fallback completed in ${Date.now() - fallbackStart}ms:`, {
    token0Price: fallbackPrices[0],
    token1Price: fallbackPrices[1],
    totalTime: Date.now() - startTime,
  });

  return fallbackPrices;
}
