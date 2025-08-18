import {
  Currency,
  MessageType,
  TimeWeightedBalanceEvent,
  TimeWindowTrigger,
} from '@absinthe/common';

type Enricher = (windows: any[], context: any) => Promise<any[]>;

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
        txHash: w?.txHash || null, // txHash will not be available for exhausted events
        // WARN: REMOVE ME! THIS IS A DEBUGGING STEP!
        startReadable: new Date(w.startTs).toLocaleString(),
        endReadable: new Date(w.endTs).toLocaleString(),
      }) as TimeWeightedBalanceEvent,
  );
};

// fixme: this needs to be fixed so that we're passing context / redis properly into all the enrichers
export const enrichWithPrice: Enricher = async (windows, redis) => {
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

    // TS.RANGE key start end ALIGN start AGGREGATION TWA bucket BUCKETTIMESTAMP last EMPTY
    // Expect exactly 1 bucket back when EMPTY is present.
    const resp = await redis.call(
      'TS.RANGE',
      key,
      start.toString(),
      end.toString(),
      'AGGREGATION',
      'TWA',
      1000 * 60 * 60 * 4, // fixme: pull this dynamically from the flush config interval
      // 'BUCKETTIMESTAMP', 'last',
      'ALIGN',
      'start',
      'EMPTY',
    );

    // resp is [[timestamp, value]] or [] if key missing
    let valueUsd = null;
    if (Array.isArray(resp) && resp.length > 0) {
      const [, v] = resp[0]; // [bucketTimestamp, twaValue]
      valueUsd = parseFloat(v);
      if (!Number.isFinite(valueUsd)) valueUsd = null; // guard NaN
    }

    out.push({ ...w, valueUsd });
  }
  return out;
};
