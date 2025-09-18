import type { Redis } from 'ioredis';
import { withPrefix } from '../../redis/ts-util.ts';

type TSPoint = { timestamp: number; value: number };

/**
 * Gets the previous sample at or before the given timestamp from Redis TimeSeries
 */
export async function getPrevSample(
  redis: Redis,
  rawKey: string,
  ts: number,
): Promise<TSPoint | null> {
  const key = withPrefix(redis, rawKey);
  // TS.REVRANGE key 0 ts COUNT 1
  let resp = (await redis.call('TS.REVRANGE', key, '0', String(ts), 'COUNT', '1')) as Array<
    [number | string, string]
  > | null;
  if (Array.isArray(resp) && resp.length) {
    const [t, v] = resp[0] as any;
    return { timestamp: Number(t), value: Number(v) };
  }

  // If no previous sample, get the next one after ts
  // TS.RANGE key ts + COUNT 1
  resp = (await redis.call('TS.RANGE', key, String(ts), '+', 'COUNT', '1')) as Array<
    [number | string, string]
  > | null;

  if (Array.isArray(resp) && resp.length) {
    const [t, v] = resp[0] as any;
    return { timestamp: Number(t), value: Number(v) };
  }

  return null;
}

/**
 * Gets all samples within the given time range from Redis TimeSeries
 */
export async function getSamplesIn(
  redis: Redis,
  rawKey: string,
  start: number,
  end: number,
): Promise<TSPoint[]> {
  const key = withPrefix(redis, rawKey);
  const resp = (await redis.call('TS.RANGE', key, String(start), String(end))) as Array<
    [number | string, string]
  > | null;
  if (!Array.isArray(resp)) return [];
  return resp.map(([t, v]: any) => ({ timestamp: Number(t), value: Number(v) }));
}

/**
 * Compute time-weighted average on a step function (last value carries forward)
 * over [start, end], using:
 * - prev sample at/before start (if any) for boundary value
 * - all samples within (start, end]
 * If there is no prev sample and the first sample is after start, we start coverage
 * at the first sample timestamp (so coveredDuration < (end-start)).
 */
export function twaFromSamples(
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
