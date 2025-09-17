import Big from 'big.js';
import { log } from '../../utils/logger.ts';
import { ActionEnricher } from '../../types/enrichment.ts';
import { getPrevSample } from '../utils/timeseries.ts';

/**
 * Enriches actions with price data from Redis TimeSeries
 */
export const enrichActionsWithPrice: ActionEnricher = async (actions, context) => {
  const out = [];
  for (const a of actions) {
    // don't price non-priceable actions
    if (!a.priceable) {
      out.push({ ...a, valueUsd: null, totalPosition: null });
      continue;
    }

    // continue with pricing logic
    const key = `price:${a.asset}`; // e.g., "price:erc721:0x...:tokenId" or "price:erc20:0x..."
    const time = a.ts;
    const exists = await context.redis.exists(key);
    if (!exists) {
      log.debug(
        `💰 ENRICH: No price data found for asset ${a.asset} (key: ${key}), user: ${a.user ?? 'unknown'}, setting valueUsd to null`,
      );
      out.push({ ...a, valueUsd: null, totalPosition: null });
      continue;
    }
    // get price at the time
    const price = await getPrevSample(context.redis, key, time);
    if (!price) {
      log.debug(
        `💰 ENRICH: No price data found for asset ${a.asset} (key: ${key}), user: ${a.user ?? 'unknown'}, setting valueUsd to null`,
      );
      out.push({ ...a, valueUsd: null, totalPosition: null });
      continue;
    }

    if (!a.asset) {
      log.debug(
        `💰 ENRICH: No asset specified for action, user: ${a.user ?? 'unknown'}, setting valueUsd to null`,
      );
      out.push({ ...a, valueUsd: null, totalPosition: null });
      continue;
    }
    const metadata = await context.metadataCache.get(a.asset);
    const decimals = metadata?.decimals ?? 0;

    const tokens = new Big(a.amount || '0').div(new Big(10).pow(decimals));
    const totalPosition = tokens.times(price.value);

    out.push({ ...a, valueUsd: price.value, totalPosition: totalPosition.toNumber() });
  }
  return out;
};
