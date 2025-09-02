// Handler metadata cache implementation for storing arbitrary state

import { RedisClientType } from 'redis';
import { HandlerMetadataCache } from '../types/pricing';

export class RedisHandlerMetadataCache implements HandlerMetadataCache {
  constructor(private redis: RedisClientType) {}

  private key(handlerName: string, key: string) {
    return `handlerMeta:${handlerName}:${key}`;
  }

  private handlerPrefix(handlerName: string) {
    return `handlerMeta:${handlerName}:*`;
  }

  async set(handlerName: string, key: string, data: any): Promise<void> {
    const cacheKey = this.key(handlerName, key);
    await this.redis.json.set(cacheKey, '$', data as any);
  }

  async get(handlerName: string, key: string): Promise<any | null> {
    const cacheKey = this.key(handlerName, key);
    const result = await this.redis.json.get(cacheKey);
    return result;
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
    const deltas = await this.redis.zRangeByScore(`${baseKey}:d`, 0, height);

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
    const amount = await this.redis.hGet(baseKey, 'amount');
    const updatedHeight = await this.redis.hGet(baseKey, 'updatedHeight');

    if (!amount || !updatedHeight) return null;

    return {
      value: amount,
      height: Number(updatedHeight),
    };
  }
}
