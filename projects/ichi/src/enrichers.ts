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
        protocolType: 'type', //todo: add this for different contracts
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
    eventName: 'Mint', //todo: have the eventName
    unixTimestampMs: Number(e.ts),
    txHash: e.txHash,
    indexedTimeMs: currentTime,
    logIndex: e.logIndex,
    blockNumber: e.height,
    blockHash: e.blockHash,
    gasUsed: Number(e.gasUsed),
    gasPrice: Number(e.gasPrice),
    // fixme: figure out what this should be (perhaps in the pricing step?)
    // gasFeeUsd: ((Number(e.gasPrice) * Number(e.gasUsed)) / 10) * 18,
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

// creating this because in rawEvents we don't have the startTs/endTs, and I will inject displayAmount from here
// Pricing enricher specifically for events (similar to enrichWithPrice but for events)
export const enrichEventsWithAssetPrice: EventEnricher = async (events, context) => {
  const out = [];

  for (const e of events) {
    let assetPrice = 0;
    const key = `price:${e.asset}`; // e.g. "price:0x677d..."
    const timestamp = e.ts; // events use 'ts' not 'startTs/endTs'
    const metadata = await context.metadataCache.get(e.asset);
    if (!metadata) {
      out.push({
        ...e,
        displayAmount: 0,
        base: {
          ...e.base,
          valueUsd: 0,
        },
      });
      continue;
    }
    const displayAmount = new Big(e.amount).div(10 ** metadata.decimals);
    // Check if price data exists for this asset
    if (!(await context.redis.exists(key))) {
      out.push({
        ...e,
        displayAmount: Number(displayAmount),
        base: {
          ...e.base,
          valueUsd: 0,
        },
      });
      continue; // nothing stored yet for this asset
    }

    // Get price at the specific event timestamp
    const resp = await context.redis.ts.range(key, timestamp, timestamp, {
      LATEST: true,
      AGGREGATION: {
        type: 'LAST', // Get last known price at this timestamp
        timeBucket: 1000 * 60 * 60 * 4, // 4 hour buckets
        EMPTY: true,
      },
      ALIGN: '0',
      COUNT: 1,
    });

    if (Array.isArray(resp) && resp.length) {
      const v = Number(resp[0].value);
      if (Number.isFinite(v)) assetPrice = v;
    }

    // Fallback: get the last known price before this timestamp
    if (assetPrice === 0) {
      const last = await context.redis.ts.revRange(key, 0, timestamp, {
        AGGREGATION: { type: 'LAST', timeBucket: 1000 * 60 * 60 * 4, EMPTY: true },
        ALIGN: '0',
        COUNT: 1,
      });
      if (Array.isArray(last) && last.length) {
        const v = Number(last[0].value);
        if (Number.isFinite(v)) assetPrice = v;
      }
    }

    // For events, calculate price per token (not total position value)
    const pricePerToken = new Big(displayAmount).mul(assetPrice);
    out.push({
      ...e,
      displayAmount: Number(displayAmount),
      base: {
        ...e.base,
        valueUsd: Number(pricePerToken), // Price per token in USD
      },
    });
  }

  return out;
};

// Generalized enricher for pricing gas fees with any asset
export const enrichEventsWithGasPricing: EventEnricher = async (events, context) => {
  const gasTokenAddress = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
  const gasPriceKey = `price:${gasTokenAddress.toLowerCase()}`;

  // Debug: Check what prices exist for ETH
  const allEthPrices = await context.redis.ts.range(gasPriceKey, 0, Date.now(), {
    AGGREGATION: { type: 'LAST', timeBucket: 1000 * 60 * 60 * 4, EMPTY: true },
    ALIGN: '0',
    COUNT: 10,
  });
  console.log('All ETH prices in Redis:', allEthPrices);

  const out = [];
  for (const e of events) {
    let gasTokenPrice = 0;

    // Get the LAST known ETH price (don't try to match exact timestamp)
    if (await context.redis.exists(gasPriceKey)) {
      const resp = await context.redis.ts.revRange(gasPriceKey, 0, Date.now(), {
        AGGREGATION: {
          type: 'LAST',
          timeBucket: 1000 * 60 * 60 * 4,
          EMPTY: true,
        },
        ALIGN: '0',
        COUNT: 1,
      });

      if (Array.isArray(resp) && resp.length) {
        const v = Number(resp[0].value);
        if (Number.isFinite(v)) gasTokenPrice = v;
      }
    }

    // Calculate gas fee in USD
    const gasFeeWei = (Number(e.gasPrice) || 0) * (Number(e.gasUsed) || 0);
    const gasFeeNative = gasFeeWei / 10 ** 18;
    const gasFeeUsd = gasFeeNative * gasTokenPrice;

    out.push({
      ...e,
      gasFeeUsd: Number(gasFeeUsd),
    });
  }

  return out;
};

export const cleanupForApi: WindowEnricher = async (windows, context) => {
  return windows.map((w) => {
    const { user, asset, trigger, meta, contractAddress, ...cleanWindow } = w;

    if ('ts' in cleanWindow) delete cleanWindow.ts;
    if ('amount' in cleanWindow) delete cleanWindow.amount;
    if ('height' in cleanWindow) delete cleanWindow.height;
    if ('currency' in cleanWindow) delete cleanWindow.currency;
    if ('to' in cleanWindow) delete cleanWindow.to;
    if ('from' in cleanWindow) delete cleanWindow.from;
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
