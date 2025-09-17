// Handler metadata cache implementation for storing arbitrary state

import { Redis } from 'ioredis';
import { HandlerMetadataCache } from '../types/pricing.ts';

export class RedisHandlerMetadataCache implements HandlerMetadataCache {
  constructor(private redis: Redis) {}

  private key(handlerName: string, key: string) {
    return `handlerMeta:${handlerName}:${key}`;
  }

  private handlerPrefix(handlerName: string) {
    return `handlerMeta:${handlerName}:*`;
  }

  async set(handlerName: string, key: string, data: any): Promise<void> {
    const cacheKey = this.key(handlerName, key);
    await this.redis.call('JSON.SET', cacheKey, '$', JSON.stringify(data));
  }

  async get(handlerName: string, key: string): Promise<any | null> {
    const cacheKey = this.key(handlerName, key);
    const result = (await this.redis.call('JSON.GET', cacheKey)) as string | null;
    return result == null ? null : JSON.parse(result);
  }

  async has(handlerName: string, key: string): Promise<boolean> {
    const cacheKey = this.key(handlerName, key);
    const exists = await this.redis.exists(cacheKey);
    return exists === 1;
  }

  async delete(handlerName: string, key: string): Promise<void> {
    const cacheKey = this.key(handlerName, key);
    await this.redis.del(cacheKey);
  }

  async clearHandler(handlerName: string): Promise<void> {
    const pattern = this.handlerPrefix(handlerName);
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(keys);
    }
  }

  // Measure-specific methods
  async getMeasureAtHeight(asset: string, metric: string, height: number): Promise<string | null> {
    const baseKey = `meas:${asset}:${metric}`;

    // Start from initial state (0)
    let amt = BigInt(0);

    // Get all deltas up to the target height
    const deltas = (await this.redis.call('ZRANGEBYSCORE', `${baseKey}:d`, 0, height)) as string[];

    // Apply all deltas in order
    for (const delta of deltas) {
      amt += BigInt(delta);
    }

    return amt.toString();
  }

  async getMeasureNearestSnapshot(
    asset: string,
    metric: string,
    height: number,
  ): Promise<{ value: string; height: number } | null> {
    const baseKey = `meas:${asset}:${metric}`;

    // For now, just return the current state as the "snapshot"
    // TODO: Implement proper snapshot mechanism if needed
    const amount = (await this.redis.hget(baseKey, 'amount')) as string | null;
    const updatedHeight = (await this.redis.hget(baseKey, 'updatedHeight')) as string | null;

    if (!amount || !updatedHeight) return null;

    return {
      value: amount,
      height: Number(updatedHeight),
    };
  }
}
