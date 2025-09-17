import Big from 'big.js';
import { log } from '../../utils/logger.ts';
import { WindowEnricher, PricedBalanceWindow } from '../../types/enrichment.ts';
import { getPrevSample, getSamplesIn, twaFromSamples } from '../utils/timeseries.ts';

/**
 * Enriches balance windows with time-weighted average price data from Redis TimeSeries
 */
export const enrichWindowsWithPrice: WindowEnricher = async (windows, context) => {
  log.debug(`💰 ENRICH: Starting price enrichment for ${windows.length} windows`);
  const out = [];

  for (const w of windows) {
    const key = `price:${w.asset}`; // e.g., "price:erc721:0x...:tokenId" or "price:erc20:0x..."
    const start = w.startTs;
    const end = w.endTs;

    log.debug(
      `💰 ENRICH: Processing window for asset ${w.asset}, user: ${w.user ?? 'unknown'}, start: ${new Date(start).toISOString()}, end: ${new Date(end).toISOString()}`,
    );

    // Fast existence check
    const exists = await context.redis.exists(key);
    log.debug(
      `💰 ENRICH: Price key ${key} exists: ${exists} for asset ${w.asset}, user: ${w.user ?? 'unknown'}`,
    );
    if (!exists) {
      log.debug(
        `💰 ENRICH: No price data found for asset ${w.asset} (key: ${key}), user: ${w.user ?? 'unknown'}, setting valueUsd to null`,
      );
      out.push({ ...w, valueUsd: null, totalPosition: null });
      continue;
    }

    // Pull prev sample at/before start, and all samples within (start, end]
    const [prev, points] = await Promise.all([
      getPrevSample(context.redis, key, start),
      getSamplesIn(context.redis, key, start, end),
    ]);

    log.debug(
      `💰 ENRICH: Got ${points.length} price points for asset ${w.asset}, user: ${w.user ?? 'unknown'}`,
    );

    const { avg, coveredMs } = twaFromSamples(start, end, prev, points);
    log.debug(
      `💰 ENRICH: TWA result for asset ${w.asset}, user: ${w.user ?? 'unknown'}: avg=${avg}, coveredMs=${coveredMs}`,
    );
    if (avg == null) {
      log.debug(
        `💰 ENRICH: No average price computed for asset ${w.asset}, user: ${w.user ?? 'unknown'}, setting valueUsd to null`,
      );
      out.push({ ...w, valueUsd: null, totalPosition: null });
      continue;
    }

    // Price stream should already be USD; do NOT divide by token decimals here.
    const priceUsd = avg;

    // Multiply by balance (convert balance from base units to tokens using metadata.decimals)
    const metadata = await context.metadataCache.get(w.asset);
    const decimals = metadata?.decimals ?? 0;

    const balanceBefore = new Big(w.rawBefore ?? w.rawAfter ?? '0'); // base units
    const tokens = balanceBefore.div(new Big(10).pow(decimals));
    const totalPosition = tokens.times(priceUsd);

    log.debug(
      `💰 ENRICH: Final window for asset ${w.asset}, user: ${w.user ?? 'unknown'}: valueUsd=${priceUsd}, totalPosition=${totalPosition.toNumber()}, _coverageMs=${coveredMs}, _pointsUsed=${points.length}`,
    );

    out.push({
      ...w,
      valueUsd: priceUsd, // USD per token
      totalPosition: totalPosition.toNumber(), // USD
      _coverageMs: coveredMs, // optional: for debugging
      _pointsUsed: points.length, // optional
    });
  }

  return out as PricedBalanceWindow[];
};
