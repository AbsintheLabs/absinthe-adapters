import { defineFeedHandler } from '../types/asset.ts';
import { defineFeed } from './define.ts';
import ky from 'ky';
import { logger } from '../utils/logger.ts';
import { z } from 'zod';

/**
 * CoinGecko Price Feed Handler
 *
 * Fetches historical prices from CoinGecko API
 * Accepts: Any asset type (ERC20, SPL, etc.)
 * Requires: CoinGecko coin ID in config
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
    try {
      const d = new Date(atMs);
      const date = `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1)
        .toString()
        .padStart(2, '0')}-${d.getFullYear()}`;

      const apiKey = process.env.COINGECKO_API_KEY;

      const url = `https://pro-api.coingecko.com/api/v3/coins/${coingeckoId}/history`;
      const headers = {
        accept: 'application/json',
        ...(apiKey && { 'x-cg-pro-api-key': apiKey }),
      };

      const r = await ky
        .get(url, {
          searchParams: { date, localization: 'false' },
          headers,
        })
        .json<any>();

      if (!r?.market_data?.current_price?.usd) {
        // Historical data not available - fallback to current price
        logger.warn(
          `No historical data for ${coingeckoId} on ${date}, falling back to current price`,
        );
        const currentPriceUrl = `https://pro-api.coingecko.com/api/v3/simple/price`;
        const currentPriceResponse = await ky
          .get(currentPriceUrl, {
            searchParams: { ids: coingeckoId, vs_currencies: 'usd' },
            headers,
          })
          .json<Record<string, { usd?: number }>>();

        const currentPrice = currentPriceResponse[coingeckoId]?.usd;
        if (!currentPrice) {
          throw new Error(`No current price found for ${coingeckoId}`);
        }
        return currentPrice;
      }

      return r.market_data.current_price.usd;
    } catch (error) {
      logger.warn(`Failed to fetch USD price for ${coingeckoId}:`, error);
      throw new Error(`Failed to fetch USD price for ${coingeckoId}`);
    }
  },
});
