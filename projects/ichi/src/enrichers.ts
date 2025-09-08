import {
  Currency,
  MessageType,
  TimeWeightedBalanceEvent,
  TimeWindowTrigger,
} from '@absinthe/common';
import { RawMeasureWindow, EnrichedMeasureWindow, PricedMeasureWindow } from './types/enrichment';
import Big from 'big.js';
import { log } from './utils/logger';
import {
  EnrichmentContext,
  Enricher,
  WindowEnricher,
  ActionEnricher,
  RawBalanceWindow,
  RawAction,
  EnrichedBalanceWindow,
  EnrichedEvent,
  PricedBalanceWindow,
  PricedEvent,
  BaseEnrichedFields,
} from './types/enrichment';

// Simple pipe runner with proper typing
export function pipeline<TOutput>(...enrichers: Enricher<any, any>[]) {
  return async (items: any[], context: EnrichmentContext): Promise<TOutput[]> => {
    let result: any[] = items;
    for (const enricher of enrichers) {
      result = await enricher(result, context);
    }
    return result as TOutput[];
  };
}

// this one will be used to properly format and customize the metadata in the appropriate way
export const enrichBaseEventMetadata: Enricher<BaseEnrichedFields, BaseEnrichedFields> = async (
  items,
  context,
) => {
  return items.map((item) => {
    return {
      ...item,
      base: {
        ...item.base,
        protocolMetadata: Object.fromEntries(
          Object.entries((item as any).meta || {}).map(([key, value]) => [
            key,
            {
              value: String(value),
              type: typeof value as 'number' | 'string',
            },
          ]),
        ),
      },
    };
  });
};

export const enrichWithCommonBaseEventFields: Enricher<
  RawBalanceWindow | RawAction,
  BaseEnrichedFields
> = async (items, context) => {
  return items.map((item) => ({
    ...item,
    base: {
      version: '1.0.0',
      // xxx: figure out how we do it in the other adapters. it should be a hash of the entire event, so probably would benefit being another enrichment step
      eventId: '',
      userId: (item as any).user,
      currency: Currency.USD,
    },
  }));
};

export const enrichWithRunnerInfo: Enricher<BaseEnrichedFields, BaseEnrichedFields> = async (
  items,
  context,
) => {
  return items.map((item) => ({
    ...item,
    base: {
      ...item.base,
      runner: {
        // xxx: this also needs to be properly implemented here
        runnerId: '1',
        apiKeyHash: '1',
      },
    },
  }));
};

export const buildEvents: ActionEnricher = async (events, context) => {
  return events.map((e) => ({
    ...e,
    eventType: MessageType.TRANSACTION,
    asset: e.asset,
    rawAmount: e.amount,
    role: e.role,
    priceable: e.priceable,
    // fixme: figure out what this should be (perhaps in the decimals step?)
    // displayAmount: Number(e.amount),
    unixTimestampMs: e.ts,
    txHash: e.txHash,
    logIndex: e.logIndex,
    blockNumber: e.height,
    blockHash: e.blockHash,
    gasUsed: e.gasUsed,
    // fixme: figure out what this should be (perhaps in the pricing step?)
    // gasFeeUsd: e.gasFeeUsd,
    currency: Currency.USD,
    base: (e as any).base,
  })) as EnrichedEvent[];
};

export const buildTimeWeightedBalanceEvents: WindowEnricher = async (windows, context) => {
  return windows.map(
    (w) =>
      ({
        ...w,
        eventType: MessageType.TIME_WEIGHTED_BALANCE,
        balanceBefore: w?.balanceBefore || w?.balance || null,
        balanceAfter: w?.balanceAfter || w?.balance || null,
        timeWindowTrigger:
          w.trigger === 'BALANCE_DELTA' //fixme: make this consistent across everywhere
            ? TimeWindowTrigger.TRANSFER
            : // : w.trigger === 'INACTIVE_POSITION'
              // ? TimeWindowTrigger.INACTIVE_POSITION
              TimeWindowTrigger.EXHAUSTED,
        startUnixTimestampMs: w.startTs,
        endUnixTimestampMs: w.endTs,
        windowDurationMs: w.endTs - w.startTs,
        startBlockNumber: w?.startBlockNumber || null, // not available for exhausted events
        endBlockNumber: w?.endBlockNumber || null, // not available for exhausted events
        prevTxHash: w?.prevTxHash || null, // WILL be available for exhausted event
        txHash: w?.txHash || null, // txHash will not be available for exhausted events
        // WARN: REMOVE ME! THIS IS A DEBUGGING STEP!
        startReadable: new Date(w.startTs).toLocaleString(),
        endReadable: new Date(w.endTs).toLocaleString(),
      }) as EnrichedBalanceWindow,
  );
};

export const buildTimeWeightedMeasureEvents = async (
  windows: RawMeasureWindow[],
  context: EnrichmentContext,
): Promise<EnrichedMeasureWindow[]> => {
  return windows.map(
    (w) =>
      ({
        ...w,
        eventType: MessageType.TIME_WEIGHTED_BALANCE, // TODO: Use TIME_WEIGHTED_MEASURE when available
        measureBefore: w?.measureBefore || w?.measure || null,
        measureAfter: w?.measureAfter || w?.measure || null,
        timeWindowTrigger:
          w.trigger === 'MEASURE_CHANGE' ? TimeWindowTrigger.TRANSFER : TimeWindowTrigger.EXHAUSTED,
        startUnixTimestampMs: w.startTs,
        endUnixTimestampMs: w.endTs,
        windowDurationMs: w.endTs - w.startTs,
        startBlockNumber: w?.startBlockNumber || null,
        endBlockNumber: w?.endBlockNumber || null,
        prevTxHash: w?.prevTxHash || null,
        txHash: w?.txHash || null,
        startReadable: new Date(w.startTs).toLocaleString(),
        endReadable: new Date(w.endTs).toLocaleString(),
      }) as EnrichedMeasureWindow,
  );
};

type TSPoint = { timestamp: number; value: number };

async function getPrevSample(redis: any, key: string, ts: number): Promise<TSPoint | null> {
  // TS.REVRANGE key - ts COUNT 1
  let resp = await redis.ts.revRange(key, 0, ts, { COUNT: 1 });
  if (Array.isArray(resp) && resp.length) {
    return { timestamp: Number(resp[0].timestamp), value: Number(resp[0].value) };
  }

  // If no previous sample, get the next one after ts
  // TODO: need to sanity check that this logic is sound
  resp = await redis.ts.range(key, ts, '+', { COUNT: 1 });

  if (Array.isArray(resp) && resp.length) {
    return { timestamp: Number(resp[0].timestamp), value: Number(resp[0].value) };
  }

  return null;
}

async function getSamplesIn(
  redis: any,
  key: string,
  start: number,
  end: number,
): Promise<TSPoint[]> {
  const resp = await redis.ts.range(key, start, end);
  if (!Array.isArray(resp)) return [];
  return resp.map((row: any) => ({ timestamp: Number(row.timestamp), value: Number(row.value) }));
}

/**
 * Compute time-weighted average on a step function (last value carries forward)
 * over [start, end], using:
 * - prev sample at/before start (if any) for boundary value
 * - all samples within (start, end]
 * If there is no prev sample and the first sample is after start, we start coverage
 * at the first sample timestamp (so coveredDuration < (end-start)).
 */
function twaFromSamples(
  start: number,
  end: number,
  prev: TSPoint | null,
  points: TSPoint[],
): { avg: number | null; coveredMs: number } {
  if (end <= start) return { avg: null, coveredMs: 0 };

  // Establish initial (t0, v0)
  let t0 = start;
  let v0: number | undefined = prev?.value;

  // If no previous value, we can only start coverage at the first in-window sample
  let idx = 0;
  if (v0 == null) {
    if (!points.length) return { avg: null, coveredMs: 0 };
    // start coverage when we first know a value
    t0 = Math.max(start, points[0].timestamp);
    v0 = points[0].value;
    idx = 1; // we consumed the first point as the starting value
  }

  let area = 0;
  let coveredStart = t0;

  // Walk through in-window samples
  for (; idx < points.length; idx++) {
    const { timestamp: ti, value: vi } = points[idx];
    const dt = Math.max(0, Math.min(ti, end) - t0);
    if (dt > 0) area += dt * (v0 as number);
    if (ti >= end) {
      // next sample is beyond end; we'll finish below
      t0 = end;
      v0 = v0; // unchanged
      break;
    }
    // step to next
    t0 = ti;
    v0 = vi;
  }

  // Cover the tail up to end
  if (t0 < end && v0 != null) {
    area += (end - t0) * v0;
  }

  const coveredMs = Math.max(0, end - coveredStart);
  if (coveredMs === 0) return { avg: null, coveredMs: 0 };
  return { avg: area / coveredMs, coveredMs };
}

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

    const balanceBefore = new Big(w.balanceBefore ?? w.balance ?? '0'); // base units
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

export const dedupeActions: ActionEnricher = async (actions, context) => {
  const seen = new Set<string>();
  return actions.filter((a) => {
    if (!a.key) return true; // fallback: keep if no key
    if (seen.has(a.key)) return false;
    seen.add(a.key);
    return true;
  });
};

export const filterOutZeroValueEvents: Enricher<PricedBalanceWindow, PricedBalanceWindow> = async (
  windows,
  context,
) => {
  return windows.filter((w) => w.valueUsd !== 0 && w.valueUsd !== undefined);
};
