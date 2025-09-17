// Price cache implementation using Redis TimeSeries via raw calls

import { Redis } from 'ioredis';
import { PriceCacheTS } from '../types/pricing.ts';
import { log } from '../utils/logger.ts';

export class RedisTSCache implements PriceCacheTS {
  constructor(
    private redis: Redis,
    private labelProvider = 'pricing',
  ) {}

  private key(series: string) {
    return `price:${series}`;
  }

  private async ensureSeries(key: string, assetLabel: string) {
    // TS.CREATE <key> DUPLICATE_POLICY LAST LABELS provider <label> asset <assetLabel>
    try {
      await this.redis.call(
        'TS.CREATE',
        key,
        'DUPLICATE_POLICY',
        'LAST',
        'LABELS',
        'provider',
        this.labelProvider,
        'asset',
        assetLabel,
      );
    } catch (e: any) {
      // ignore "key exists"
      const msg = String(e?.message ?? e);
      if (!msg.includes('exists')) throw e;
    }
  }

  async set(seriesKey: string, timestampMs: number, price: number) {
    log.debug('setting price for', seriesKey, timestampMs, price);
    const key = this.key(seriesKey);
    await this.ensureSeries(key, seriesKey);
    // TS.ADD <key> <ts> <value> ON_DUPLICATE LAST
    await this.redis.call(
      'TS.ADD',
      key,
      String(timestampMs),
      String(price),
      'ON_DUPLICATE',
      'LAST',
    );
  }

  async get(
    seriesKey: string,
    atMs: number, // any ts inside the bucket you care about
    bucketMs: number, // bucket width in ms
  ): Promise<number | null> {
    const key = this.key(seriesKey);

    // 0. Series doesn't exist → no price
    if (!(await this.redis.exists(key))) return null;

    // 1. Calculate bucket boundaries
    const bucketStart = Math.floor(atMs / bucketMs) * bucketMs;
    const bucketEnd = bucketStart + bucketMs - 1;

    // 2. Do we have a sample exactly at the bucketStart? (fast path)
    const exact = (await this.redis.call(
      'TS.RANGE',
      key,
      String(bucketStart),
      String(bucketStart),
    )) as Array<[number, string]> | null;
    if (exact && exact.length) return Number((exact[0] as any)[1]);

    // 3. Otherwise get the latest sample **up to atMs**
    const latest = (await this.redis.call(
      'TS.REVRANGE',
      key,
      '0',
      String(atMs),
      'COUNT',
      '1',
    )) as Array<[number, string]> | null;
    if (!latest || !latest.length) return null; // nothing before/at atMs

    // 4. Ensure that sample is inside the *current* bucket, not an older one
    const [tsStr, valueStr] = latest[0] as any;
    const ts = typeof tsStr === 'string' ? Number(tsStr) : Number(tsStr);
    if (ts < bucketStart) return null; // stale → treat as missing

    return Number(valueStr);
  }
}
