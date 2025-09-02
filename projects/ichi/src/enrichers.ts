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
  EventEnricher,
  RawBalanceWindow,
  RawEvent,
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
  RawBalanceWindow | RawEvent,
  BaseEnrichedFields
> = async (items, context) => {
  return items.map((item) => ({
    ...item,
    base: {
      version: '1.0.0',
      eventId: '', // fixme: figure out how we do it in the other adapters
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
        runnerId: '1',
        apiKeyHash: '1',
      },
    },
  }));
};

export const buildEvents: EventEnricher = async (events, context) => {
  return events.map((e) => ({
    ...e,
    eventType: MessageType.TRANSACTION,
    rawAmount: e.amount,
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
          w.trigger === 'BALANCE_CHANGE' //fixme: make this consistent across everywhere
            ? TimeWindowTrigger.TRANSFER
            : TimeWindowTrigger.EXHAUSTED,
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

// Enrich balance windows with pricing data
export const enrichWithPrice: WindowEnricher = async (windows, context) => {
  log.debug(`💰 ENRICH: Starting price enrichment for ${windows.length} windows`);

  const out = [];
  for (const w of windows) {
    log.debug(
      `💰 ENRICH: Processing window for asset ${w.asset}, start: ${new Date(w.startTs).toISOString()}, end: ${new Date(w.endTs).toISOString()}`,
    );
    const key = `price:${w.asset}`; // e.g. "price:eth:0x..."
    const start = w.startTs; // ms
    const end = w.endTs; // ms

    log.debug(`💰 ENRICH: Checking price key ${key} for asset ${w.asset}`);

    // Check if price data exists for this asset
    const keyExists = await context.redis.exists(key);
    log.debug(`💰 ENRICH: Price key ${key} exists: ${keyExists}`);

    if (!keyExists) {
      log.warn(
        `💰 ENRICH: No price data found for asset ${w.asset} (key: ${key}), setting valueUsd to null`,
      );
      out.push({ ...w, valueUsd: null });
      continue; // nothing stored yet for this asset
    }

    // TS.RANGE key start end ALIGN start AGGREGATION TWA bucket BUCKETTIMESTAMP last EMPTY
    log.debug(`💰 ENRICH: Querying TS.RANGE for ${key} from ${start} to ${end}`);

    const resp = await context.redis.ts.range(key, start, end, {
      LATEST: true, // return values for a bucket even if the bucket hasn't elapsed yet
      AGGREGATION: {
        type: 'TWA', // we care about getting the time-weighted average of the price over the duration
        // fixme: pull this dynamically from the flush config interval
        timeBucket: 1000 * 60 * 60 * 4, // bucket interval in ms
        EMPTY: true, // make sure buckets without values still get a value
      },
      ALIGN: '0', // aligns buckets to 0 (aka: on the hour)
      COUNT: 1,
    });

    log.debug(`💰 ENRICH: TS.RANGE response:`, resp);

    let valueUsd: number | null = null;
    if (Array.isArray(resp) && resp.length) {
      const v = Number(resp[0].value);
      log.debug(`💰 ENRICH: Raw TWA value from TS.RANGE: ${v}`);
      if (Number.isFinite(v)) {
        valueUsd = v;
        log.debug(`💰 ENRICH: Valid TWA value: ${valueUsd}`);
      } else {
        log.warn(`💰 ENRICH: Invalid TWA value: ${v}`);
      }
    } else {
      log.warn(`💰 ENRICH: No TWA data returned from TS.RANGE for ${key}`);
    }

    if (valueUsd == null) {
      log.debug(`💰 ENRICH: TWA query returned null, trying fallback LAST query`);
      // 2) Fallback: get the last known price bucket at/before `end`
      const last = await context.redis.ts.revRange(key, 0, end, {
        AGGREGATION: { type: 'LAST', timeBucket: 1000 * 60 * 60 * 4, EMPTY: true },
        ALIGN: '0',
        COUNT: 1,
      });

      log.debug(`💰 ENRICH: Fallback LAST query response:`, last);

      if (Array.isArray(last) && last.length) {
        const v = Number(last[0].value);
        log.debug(`💰 ENRICH: Raw fallback value: ${v}`);
        if (Number.isFinite(v)) {
          valueUsd = v;
          log.debug(`💰 ENRICH: Using fallback value: ${valueUsd}`);
        } else {
          log.warn(`💰 ENRICH: Invalid fallback value: ${v}`);
        }
      } else {
        log.warn(`💰 ENRICH: No fallback price data found for ${key}`);
      }
    }

    // get metadata as well
    log.debug(`💰 ENRICH: Getting metadata for asset ${w.asset}`);
    const metadata = await context.metadataCache.get(w.asset);

    if (!metadata) {
      log.error(`💰 ENRICH: No metadata found for asset ${w.asset}, setting valueUsd to null`);
      out.push({ ...w, valueUsd: null });
      continue;
    }

    log.debug(`💰 ENRICH: Found metadata for ${w.asset}:`, {
      decimals: metadata.decimals,
      symbol: metadata.symbol,
    });

    // Final calculation
    const balanceBefore = w.balanceBefore || w.balance || '0';
    log.debug(
      `💰 ENRICH: Calculating final values - valueUsd: ${valueUsd}, balance: ${balanceBefore}, decimals: ${metadata.decimals}`,
    );

    const price = new Big(valueUsd ?? 0).div(10 ** metadata.decimals);
    const totalPosition = new Big(balanceBefore).mul(price);

    const finalPrice = Number(price);
    const finalTotalPosition = Number(totalPosition);

    log.debug(
      `💰 ENRICH: Final calculated values - price: ${finalPrice}, totalPosition: ${finalTotalPosition}`,
    );

    out.push({ ...w, valueUsd: finalPrice, totalPosition: finalTotalPosition });
  }

  const pricedCount = out.filter((w) => w.valueUsd !== null).length;
  const nullCount = out.filter((w) => w.valueUsd === null).length;

  log.debug(
    `💰 ENRICH: Completed price enrichment - ${pricedCount} windows with prices, ${nullCount} windows with null prices`,
  );

  return out as PricedBalanceWindow[];
};

// Enrich measure windows with pricing data
export const enrichMeasureWithPrice = async (
  windows: EnrichedMeasureWindow[],
  context: EnrichmentContext,
): Promise<PricedMeasureWindow[]> => {
  log.debug(`📏 MEASURE ENRICH: Starting price enrichment for ${windows.length} measure windows`);

  const out = [];
  for (const w of windows) {
    log.debug(`📏 MEASURE ENRICH: Processing measure window for asset ${w.asset}`);
    const key = `price:${w.asset}`; // e.g. "price:erc721:PM:TID"
    const start = w.startTs;
    const end = w.endTs;

    const keyExists = await context.redis.exists(key);
    log.debug(`📏 MEASURE ENRICH: Price key ${key} exists: ${keyExists}`);

    if (!keyExists) {
      log.warn(`📏 MEASURE ENRICH: No price data found for measure asset ${w.asset}`);
      out.push({ ...w, valueUsd: null });
      continue;
    }

    // TS.RANGE key start end ALIGN start AGGREGATION TWA bucket BUCKETTIMESTAMP last EMPTY
    const resp = await context.redis.ts.range(key, start, end, {
      LATEST: true,
      AGGREGATION: {
        type: 'TWA',
        timeBucket: 1000 * 60 * 60 * 4,
        EMPTY: true,
      },
      ALIGN: '0',
      COUNT: 1,
    });

    let valueUsd: number | null = null;
    if (Array.isArray(resp) && resp.length) {
      const v = Number(resp[0].value);
      if (Number.isFinite(v)) valueUsd = v;
    }

    if (valueUsd == null) {
      const last = await context.redis.ts.revRange(key, 0, end, {
        AGGREGATION: { type: 'LAST', timeBucket: 1000 * 60 * 60 * 4, EMPTY: true },
        ALIGN: '0',
        COUNT: 1,
      });
      if (Array.isArray(last) && last.length) {
        const v = Number(last[0].value);
        if (Number.isFinite(v)) valueUsd = v;
      }
    }

    // Get metadata
    const metadata = await context.metadataCache.get(w.asset);
    if (!metadata) {
      out.push({ ...w, valueUsd: null });
      continue;
    }

    const price = new Big(valueUsd ?? 0).div(10 ** metadata.decimals);
    const measureBefore = w.measureBefore || w.measure || '0';
    const totalPosition = new Big(measureBefore).mul(price);

    out.push({ ...w, valueUsd: Number(price), totalPosition: Number(totalPosition) });
  }

  const pricedCount = out.filter((w) => w.valueUsd !== null).length;
  const nullCount = out.filter((w) => w.valueUsd === null).length;

  log.debug(
    `📏 MEASURE ENRICH: Completed measure price enrichment - ${pricedCount} windows with prices, ${nullCount} windows with null prices`,
  );

  return out as PricedMeasureWindow[];
};

export const filterOutZeroValueEvents: Enricher<PricedBalanceWindow, PricedBalanceWindow> = async (
  windows,
  context,
) => {
  return windows.filter((w) => w.valueUsd !== 0);
};
