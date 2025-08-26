import { HandlerFactory } from './interface';
import axios from 'axios';

// Simple function implementation using FeedHandler signature
export const coinGeckoFactory: HandlerFactory<'coingecko'> = (resolve) => async (args) => {
  const { assetConfig, ctx } = args;
  const coingeckoId = assetConfig.priceFeed.id;
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

    const r = await axios.get(url, {
      params: { date, localization: 'false' },
      headers,
    });

    if (!r.data?.market_data?.current_price?.usd) {
      console.warn(`No market data found for ${coingeckoId} on ${date}`);
      return 0;
    }

    return r.data.market_data.current_price.usd;
  } catch (error) {
    console.warn(`Failed to fetch historical USD price for ${coingeckoId}:`, error);
    return 0;
  }
};
