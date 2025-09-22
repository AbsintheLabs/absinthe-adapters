import { logger, WHITELIST_TOKENS_WITH_COINGECKO_ID } from '@absinthe/common';
import { TOKEN_DETAILS } from './consts';

interface JupiterResponse {
  usdPrice: number;
  blockId: number;
  decimals: number;
}

interface CachedPrice {
  price: JupiterResponse;
  timestamp: number;
}

// In-memory cache for Jupiter prices
const priceCache = new Map<string, CachedPrice>();
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour in milliseconds

async function getOptimizedTokenPrices(
  poolId: string,
  token0: { id: string; decimals: number },
  token1: { id: string; decimals: number },
  timestamp: number,
  chainPlatform: string,
): Promise<[number, number]> {
  const startTime = Date.now();
  logger.info('🚀 Starting getOptimizedTokenPrices', {
    poolId,
    token0: token0.id,
    token1: token1.id,
    timestamp: timestamp,
    timestampISO: new Date(timestamp).toISOString(),
    chainPlatform,
  });

  /* ------------------------------------------------------------ */
  /* Helpers & prelims                                            */
  /* ------------------------------------------------------------ */

  const token0Addr = token0.id.toLowerCase();
  const token1Addr = token1.id.toLowerCase();

  logger.info('🔍 Token whitelist analysis:', {
    poolId: poolId,
    token0Addr: token0Addr,
    token1Addr: token1Addr,
    token0CoinGeckoId: getCGId(token0Addr),
    token1CoinGeckoId: getCGId(token1Addr),
  });

  logger.info('🔄 ROUTE 2: Both tokens whitelisted - using token0 as anchor');

  const anchorStart = Date.now();

  //todo: rn they are not priced historically, make sure to price them historically.

  //   const token0Usd = await fetchHistoricalUsd(
  //     getCGId(token0Addr)!,
  //     timestamp,
  //     env.baseConfig.coingeckoApiKey,
  //   );

  //   const token1Usd = await fetchHistoricalUsd(
  //     getCGId(token1Addr)!,
  //     timestamp,
  //     env.baseConfig.coingeckoApiKey,
  //   );

  const token0Usd = (await getTokenPrice(token0Addr)).usdPrice;
  const token1Usd = (await getTokenPrice(token1Addr)).usdPrice;

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

async function getTokenPrice(mintAddress: string): Promise<{ usdPrice: number; decimals: number }> {
  const tokenDetails = TOKEN_DETAILS.find(
    (t) => t.address.toLowerCase() === mintAddress.toLowerCase(),
  );
  if (tokenDetails) {
    return { usdPrice: tokenDetails.price, decimals: tokenDetails.decimals };
  }
  return { usdPrice: 0, decimals: 0 };
}

async function getJupPrice(
  mintAddress: string,
  requestTimestamp?: number,
): Promise<JupiterResponse> {
  const currentTimestamp = requestTimestamp || Date.now();

  // Check if we have a cached price for this mint
  const cached = priceCache.get(mintAddress);

  if (cached) {
    const timeDiff = currentTimestamp - cached.timestamp;

    // If the cached price is less than 1 hour old, return it
    if (timeDiff <= CACHE_DURATION_MS) {
      logger.info(
        `📦 Using cached Jupiter price for ${mintAddress} (age: ${Math.round(timeDiff / 1000)}s)`,
      );
      return cached.price;
    } else {
      logger.info(
        `⏰ Cached Jupiter price for ${mintAddress} expired (age: ${Math.round(timeDiff / 1000)}s), fetching new price`,
      );
    }
  }

  // Fetch new price from Jupiter API
  const url = `https://lite-api.jup.ag/price/v3?ids=${mintAddress}`;
  const baseRetryInterval = 5000; // 5 seconds
  const maxRetryInterval = 420000; // 7 minutes
  const maxRetries = -1; // -1 means retry indefinitely

  let attempt = 0;

  while (true) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data && data[mintAddress]) {
        const priceData = data[mintAddress];

        // Cache the new price with current timestamp
        priceCache.set(mintAddress, {
          price: priceData,
          timestamp: currentTimestamp,
        });

        logger.info(`💾 Cached new Jupiter price for ${mintAddress}`);
        return priceData;
      }

      throw new Error('No price data returned');
    } catch (error) {
      attempt++;
      console.warn(`Jupiter price fetch attempt ${attempt} failed for ${mintAddress}:`, error);

      // If we have a max retry limit and reached it, throw the error
      if (maxRetries > 0 && attempt >= maxRetries) {
        throw error;
      }

      // Calculate exponential backoff with jitter, capped at maxRetryInterval
      const exponentialDelay = Math.min(
        baseRetryInterval * Math.pow(2, attempt - 1),
        maxRetryInterval,
      );
      const jitter = Math.random() * 1000; // Add up to 1 second of jitter
      const retryInterval = exponentialDelay + jitter;

      console.log(`Retrying in ${Math.round(retryInterval / 1000)} seconds (attempt ${attempt})`);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, retryInterval));
    }
  }
}

const getCGId = (addr: string) =>
  WHITELIST_TOKENS_WITH_COINGECKO_ID.find((t) => t.address.toLowerCase() === addr.toLowerCase())
    ?.coingeckoId ?? null;

export { getCGId, getOptimizedTokenPrices, getJupPrice, getTokenPrice };
