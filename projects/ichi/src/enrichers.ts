import {
  Currency,
  MessageType,
  TimeWeightedBalanceEvent,
  TimeWindowTrigger,
} from '@absinthe/common';
import { RedisClientType } from 'redis';
import Big from 'big.js';

// todo: narrow the types! these are too general here
type Enricher = (windows: any[], context: any) => Promise<any[]>;

// used for metadata
type Entry = { value: string; type: 'number' | 'string' };
type ProtocolMetadata = Record<string, Entry>;

// Simple pipe runner
export const pipeline =
  (...enrichers: Enricher[]) =>
  async (windows: any[], context: any) => {
    let result = windows;
    for (const enricher of enrichers) {
      result = await enricher(result, context);
    }
    return result;
  };

// this one will be used to properly format and customize the metadata in the appropriate way
export const enrichBaseEventMetadata: Enricher = async (windows, context) => {
  return windows.map((w) => {
    return {
      ...w,
      base: {
        ...w.base,
        protocolMetadata: Object.fromEntries(
          Object.entries(w.meta || {}).map(([key, value]) => [
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

export const enrichWithCommonBaseEventFields: Enricher = async (windows, context) => {
  return windows.map((w) => ({
    ...w,
    base: {
      version: '1.0.0',
      eventId: '', // fixme: figure out how we do it in the other adapters
      userId: w.user,
      currency: Currency.USD,
    },
  }));
};

export const enrichWithRunnerInfo: Enricher = async (windows, context) => {
  return windows.map((w) => ({
    ...w,
    base: {
      ...w.base,
      runner: {
        runnerId: '1',
        apiKeyHash: '1',
      },
    },
  }));
};

export const buildEvents: Enricher = async (events, context) => {
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
  }));
};

export const buildTimeWeightedBalanceEvents: Enricher = async (windows, context) => {
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
      }) as TimeWeightedBalanceEvent,
  );
};

// fixme: this needs to be fixed so that we're passing context / redis properly into all the enrichers
export const enrichWithPrice: Enricher = async (windows, context) => {
  console.log('enrichWithPrice');
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
      console.log('no price found for', w.asset);
      out.push({ ...w, valueUsd: null });
      continue; // nothing stored yet for this asset
    } else {
      console.log('price found for', w.asset);
    }

    // TS.RANGE key start end ALIGN start AGGREGATION TWA bucket BUCKETTIMESTAMP last EMPTY
    // Expect exactly 1 bucket back when EMPTY is present.
    // xxx: don't have this fail if no key is found!
    console.log('getting price for', key, start, end);
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

    let valueUsd: number | null = null;
    if (Array.isArray(resp) && resp.length) {
      const v = Number(resp[0].value);
      if (Number.isFinite(v)) valueUsd = v;
    }

    if (valueUsd == null) {
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
      console.log('no metadata found for', w.asset);
      out.push({ ...w, valueUsd: null });
      continue;
    }

    // resp is [[timestamp, value]] or [] if key missing

    // console.log("**************************************************")
    // console.log("valueUsd", valueUsd);
    // console.log("balanceBefore", w.balanceBefore);
    // console.log("metadata", metadata);
    // console.log("**************************************************")

    // todo: clean up the logic so it's clear that we're multiplying the price by the balance before
    // FIXME: have this use big.js so we don't lose precision
    // const price = new Big(valueUsd ?? 0).mul(w.balanceBefore).div(10 ** metadata.decimals);
    const price = new Big(valueUsd ?? 0).div(10 ** metadata.decimals);
    const totalPosition = new Big(w.balanceBefore).mul(price);
    // todo: clean up the final output to work with the absinthe sink, currently don't support totalPosition in the api
    out.push({ ...w, valueUsd: Number(price), totalPosition: Number(totalPosition) });
  }
  return out;
};

export const filterOutZeroValueEvents: Enricher = async (windows, context) => {
  return windows.filter((w) => w.valueUsd !== 0);
};
