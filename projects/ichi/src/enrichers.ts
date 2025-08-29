import {
  Currency,
  MessageType,
  TimeWeightedBalanceEvent,
  TimeWindowTrigger,
} from '@absinthe/common';
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
import { createHash } from 'crypto';

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
  return items.map((item) => {
    const balanceEventHash = `${context.chainConfig.networkId}-${item.user}-${(item as RawBalanceWindow).startTs}-${(item as RawBalanceWindow).endTs}-${context.absintheApiKey}-${context.indexerId || ''}`; //todo: change indexerId to type
    const rawEventHash = `${context.chainConfig.networkId}-${item.txHash}-${item.user}-${(item as RawEvent).logIndex}-${context.absintheApiKey}`;
    const isRawBalanceWindow = 'startTs' in item && 'endTs' in item;
    const eventId = createHash('md5')
      .update(isRawBalanceWindow ? balanceEventHash : rawEventHash)
      .digest('hex')
      .slice(0, 16);

    return {
      ...item,
      base: {
        version: '1.0.0',
        eventId: eventId,
        userId: item.user,
        currency: Currency.USD,
        chain: context.chainConfig,
        protocolName: 'demo1', //todo: add this for different contracts
        protocolType: 'type',
        contractAddress: item.contractAddress,
      },
    };
  });
};

export const enrichWithRunnerInfo: Enricher<BaseEnrichedFields, BaseEnrichedFields> = async (
  items,
  context,
) => {
  const apiKeyHash = createHash('md5').update(context.absintheApiKey).digest('hex').slice(0, 8);

  return items.map((item) => ({
    ...item,
    base: {
      ...item.base,
      runner: {
        runnerId: context.indexerId,
        apiKeyHash: apiKeyHash,
      },
    },
  }));
};

export const buildEvents: EventEnricher = async (events, context) => {
  const currentTime = Date.now();

  return events.map((e) => ({
    ...e,
    eventType: MessageType.TRANSACTION,
    rawAmount: e.amount,
    // fixme: figure out what this should be (perhaps in the decimals step?)
    // displayAmount: Number(e.amount),
    unixTimestampMs: e.ts,
    txHash: e.txHash,
    indexedTimeMs: currentTime,
    logIndex: e.logIndex,
    blockNumber: e.height,
    blockHash: e.blockHash,
    gasUsed: e.gasUsed,
    // fixme: figure out what this should be (perhaps in the pricing step?)
    // gasFeeUsd: e.gasFeeUsd,
    currency: Currency.USD,
  }));
};

export const buildTimeWeightedBalanceEvents: WindowEnricher = async (windows, context) => {
  const currentTime = Date.now();

  return windows.map((w) => ({
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
    tokenPrice: null,
    tokenDecimals: null,
    indexedTimeMs: currentTime,
    windowDurationMs: w.endTs - w.startTs,
    startBlockNumber: w?.startBlockNumber || null, // not available for exhausted events
    endBlockNumber: w?.endBlockNumber || null, // not available for exhausted events
    prevTxHash: w?.prevTxHash || null, // WILL be available for exhausted event
    txHash: w?.txHash || null, // txHash will not be available for exhausted events
    // WARN: REMOVE ME! THIS IS A DEBUGGING STEP!
  }));
};

// Enrich balance windows with pricing data
export const enrichWithPrice: WindowEnricher = async (windows, context) => {
  // todo: automatically average the prices over the durations, this way we automatically get
  // todo: one row during backfills rather than a row for each window

  /*
      - each of the windows has a start and end ts
      - for each of the windows, we need to average out the price over that duration based on the prices we have stored
      - we store the price of each asset and different timestamps (we compute the windows)

      brute force sample algo:
      for each window in our array of windows:
          1. get all price keys for that asset where the timestamp is between startTs and endTs of the window
          2. get the values of each of those keys.
          3. avg_price = time_weighted_avg(prices)

      redis twa algo method: <-- this is the preferred method
          1. query between the window start and end for the window and let the redis twa algo do the work
      */

  const out = [];
  for (const w of windows) {
    const key = `price:${w.asset}`; // e.g. "price:eth:0x..."
    const start = w.startTs; // ms
    const end = w.endTs; // ms
    // const bucket = Math.max(1, end - start); // duration in ms, must be >= 1

    // todo: maybe add an exists function to the price cache
    if (!(await context.redis.exists(key))) {
      out.push({
        ...w,
        base: {
          ...w.base,
          valueUsd: 0,
        },
      });
      continue; // nothing stored yet for this asset
    }

    // TS.RANGE key start end ALIGN start AGGREGATION TWA bucket BUCKETTIMESTAMP last EMPTY
    // Expect exactly 1 bucket back when EMPTY is present.
    // xxx: don't have this fail if no key is found!
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

    let valueUsd: number = 0;
    if (Array.isArray(resp) && resp.length) {
      const v = Number(resp[0].value);
      if (Number.isFinite(v)) valueUsd = v;
    }

    if (valueUsd === 0) {
      // 2) Fallback: get the last known price bucket at/before `end`
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

    // get metadata as well
    const metadata = await context.metadataCache.get(w.asset);
    if (!metadata) {
      out.push({
        ...w,
        base: {
          ...w.base,
          valueUsd: 0,
        },
      });
      continue;
    }

    // resp is [[timestamp, value]] or [] if key missing

    // todo: clean up the logic so it's clear that we're multiplying the price by the balance before
    // FIXME: have this use big.js so we don't lose precision
    // const price = new Big(valueUsd ?? 0).mul(w.balanceBefore).div(10 ** metadata.decimals);
    const price = new Big(valueUsd).div(10 ** metadata.decimals);
    const balanceBefore = w.balanceBefore || w.balance || '0';
    const totalPosition = new Big(balanceBefore).mul(price);
    // todo: clean up the final output to work with the absinthe sink, currently don't support totalPosition in the api
    out.push({
      ...w,
      base: {
        ...w.base,
        valueUsd: Number(price),
      },
    });
  }
  return out;
};

export const cleanupForApi: WindowEnricher = async (windows, context) => {
  return windows.map((w) => {
    const { user, asset, contractAddress, trigger, ...cleanWindow } = w;
    return cleanWindow;
  });
};

//todo: rn this would fail, for eg - zebu auction_claimed event where we pass valueUSD =
// export const filterOutZeroValueEvents: Enricher<PricedBalanceWindow, PricedBalanceWindow> = async (
//   windows,
//   context,
// ) => {
//   return windows.filter((w) => w.valueUsd > 0);
// };
