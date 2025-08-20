import { PriceStore, Price } from '../types/interfaces/pricingService';
import { RedisService } from './RedisService';

export class RedisPriceStore implements PriceStore {
  private redisService: RedisService;
  private keyPrefix: string;
  private defaultTtlSeconds: number = 7 * 24 * 60 * 60; // 7 days

  constructor(redisService: RedisService, keyPrefix: string) {
    this.redisService = redisService;
    this.keyPrefix = keyPrefix;
  }

  async get(asset: string, bucketMs: number, atMs: number): Promise<Price | null> {
    const key = this.generateKey(asset, bucketMs, atMs);

    try {
      const data = await this.redisService.execute(async (client) => {
        return await client.get(key);
      });

      if (!data) {
        return null;
      }

      return JSON.parse(data) as Price;
    } catch (error) {
      console.warn(`Failed to get price from cache for key ${key}:`, error);
      return null;
    }
  }

  async put(asset: string, bucketMs: number, atMs: number, price: Price): Promise<void> {
    const key = this.generateKey(asset, bucketMs, atMs);

    try {
      await this.redisService.execute(async (client) => {
        return await client.setEx(key, this.defaultTtlSeconds, JSON.stringify(price));
      });

      console.log(
        `💾 Cached price for ${asset} at ${new Date(atMs).toISOString()}: $${price.value}`,
      );
    } catch (error) {
      console.warn(`Failed to cache price for key ${key}:`, error);
      // Don't throw - caching failures shouldn't break the flow
    }
  }

  private generateKey(asset: string, bucketMs: number, atMs: number): string {
    const bucket = Math.floor(atMs / bucketMs) * bucketMs;
    return `${this.keyPrefix}:${asset.toLowerCase()}:${bucketMs}:${bucket}`;
  }
}
