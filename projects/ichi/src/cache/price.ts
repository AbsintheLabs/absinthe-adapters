// Price cache implementation using Redis TimeSeries

import { RedisClientType } from 'redis';
import { PriceCacheTS } from '../types/pricing';

export class RedisTSCache implements PriceCacheTS {
  constructor(
    private redis: RedisClientType,
    private labelProvider = 'pricing',
  ) {}

  private key(series: string) {
    return `price:${series}`;
  }

  private async ensureSeries(key: string, assetLabel: string) {
    // TS.CREATE <key> DUPLICATE_POLICY LAST LABELS provider <label> asset <assetLabel>
    try {
      await this.redis.ts.create(key, {
        DUPLICATE_POLICY: 'LAST',
        LABELS: {
          provider: this.labelProvider,
          asset: assetLabel,
        },
      });
    } catch (e: any) {
      // ignore "key exists"
      const msg = String(e?.message ?? e);
      if (!msg.includes('exists')) throw e;
    }
  }

  async set(seriesKey: string, timestampMs: number, price: number) {
    console.log('setting price for', seriesKey, timestampMs, price);
    const key = this.key(seriesKey);
    await this.ensureSeries(key, seriesKey);
    // TS.ADD <key> <ts> <value> ON_DUPLICATE LAST
    await this.redis.ts.add(key, timestampMs, price, {
      ON_DUPLICATE: 'LAST',
    });
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
    const exact = await this.redis.ts.range(key, bucketStart, bucketStart);
    if (exact.length) return Number(exact[0].value);

    // 3. Otherwise get the latest sample **up to atMs**
    const latest = await this.redis.ts.revRange(key, 0, atMs, { COUNT: 1 });
    if (!latest.length) return null; // nothing before/at atMs

    // 4. Ensure that sample is inside the *current* bucket, not an older one
    const { timestamp, value } = latest[0];
    if (timestamp < bucketStart) return null; // stale → treat as missing

    return Number(value);
  }
}
