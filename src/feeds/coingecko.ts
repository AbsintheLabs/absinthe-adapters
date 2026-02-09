import { defineFeedHandler } from '../types/asset.ts';
import { defineFeed } from './define.ts';
import ky, { HTTPError } from 'ky';
import { logger } from '../utils/logger.ts';
import { z } from 'zod';

/** Basic plan allows history only within the last 2 years. */
const COINGECKO_HISTORY_MAX_AGE_MS = 2 * 365 * 24 * 60 * 60 * 1000;

/** Error code when request exceeds allowed time range (Basic plan: history only last 2 years). */
const COINGECKO_ERROR_TIME_RANGE_EXCEEDED = 10012;

async function fetchCurrentPrice(
  coingeckoId: string,
  headers: Record<string, string>,
): Promise<number> {
  const currentPriceResponse = await ky
    .get('https://pro-api.coingecko.com/api/v3/simple/price', {
      searchParams: { ids: coingeckoId, vs_currencies: 'usd' },
      headers,
    })
    .json<Record<string, { usd?: number }>>();

  const currentPrice = currentPriceResponse[coingeckoId]?.usd;
  if (currentPrice == null) {
    throw new Error(`No current price found for ${coingeckoId}`);
  }
  return currentPrice;
}

/**
 * CoinGecko Price Feed Handler
 *
 * Fetches historical prices from CoinGecko API
 * Accepts: Any asset type (ERC20, SPL, etc.)
 * Requires: CoinGecko coin ID in config
 *
 * On Basic plan, /coins/{id}/history is limited to the last 2 years. For older
 * dates we fall back to current price.
 */
export const coingeckoFeed = defineFeedHandler({
  name: 'coingecko',
  acceptsAssetType: 'any',
  manifest: {
    requiredEnvVars: {
      COINGECKO_API_KEY: z.string().startsWith('CG-').min(1).describe('CoinGecko API key'),
    },
  },
  configSchema: z.object({
    id: z.string().describe('CoinGecko coin ID (e.g., "ethereum", "solana")'),
  }),
  handler: async ({ config, ctx }) => {
    const coingeckoId = config.id;
    const atMs = ctx.atMs;
    const apiKey = process.env.COINGECKO_API_KEY;
    const headers = {
      accept: 'application/json',
      ...(apiKey && { 'x-cg-pro-api-key': apiKey }),
    };

    const d = new Date(atMs);
    const date = `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${d.getFullYear()}`;

    const nowMs = Date.now();
    if (nowMs - atMs > COINGECKO_HISTORY_MAX_AGE_MS) {
      logger.warn(
        `Date ${date} is outside CoinGecko Basic plan 2-year window, using current price for ${coingeckoId}`,
      );
      return fetchCurrentPrice(coingeckoId, headers);
    }

    try {
      const url = `https://pro-api.coingecko.com/api/v3/coins/${coingeckoId}/history`;
      const r = await ky
        .get(url, {
          searchParams: { date, localization: 'false' },
          headers,
        })
        .json<any>();

      if (!r?.market_data?.current_price?.usd) {
        logger.warn(
          `No historical data for ${coingeckoId} on ${date}, falling back to current price`,
        );
        return fetchCurrentPrice(coingeckoId, headers);
      }

      return r.market_data.current_price.usd;
    } catch (error) {
      if (error instanceof HTTPError && error.response.status === 401) {
        const body = (await error.response.json().catch(() => ({}))) as { error_code?: number };
        if (body?.error_code === COINGECKO_ERROR_TIME_RANGE_EXCEEDED) {
          logger.warn(
            `CoinGecko 401 (time range exceeded) for ${coingeckoId} on ${date}, using current price`,
          );
          return fetchCurrentPrice(coingeckoId, headers);
        }
      }
      logger.warn(`Failed to fetch USD price for ${coingeckoId}:`, error);
      throw new Error(`Failed to fetch USD price for ${coingeckoId}`);
    }
  },
});
