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

      // TODO: This should come from the config / env object once we get to this
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
        logger.warn(`No market data found for ${coingeckoId} on ${date}`);
        return 0;
      }

      return r.market_data.current_price.usd;
    } catch (error) {
      logger.warn(`Failed to fetch historical USD price for ${coingeckoId}:`, error);
      return 0;
    }
  },
});
