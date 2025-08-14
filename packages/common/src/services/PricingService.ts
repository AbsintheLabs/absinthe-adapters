import { fetchHistoricalUsd } from '../utils/helper/helper';
import { RedisService } from './RedisService';

interface CachedPrice {
  value: number;
  cachedAtMs: number;
  source: string;
}

class PriceService {
  private cacheValidityMs: number = 60 * 60 * 1000; // 1 hour default
  constructor(
    private store: RedisService,
    private coingeckoApiKey: string,
  ) {}

  async getPrice(asset: string, coingeckoId: string, atMs: number): Promise<number> {
    // Check cache first
    const cached = await this.getCachedPrice(asset, atMs);

    if (cached && this.isCacheValid(cached, atMs)) {
      console.log(`🎯 Using cached price for ${asset}: $${cached.value}`);
      return cached.value;
    }

    // Fetch from Coingecko
    console.log(`🔄 Fetching fresh price for ${coingeckoId} at ${new Date(atMs).toISOString()}`);
    const price = await fetchHistoricalUsd(coingeckoId, atMs, this.coingeckoApiKey);

    // Cache the result
    await this.cachePrice(asset, price, atMs);

    console.log(`💰 Fetched and cached price for ${asset}: $${price}`);
    return price;
  }

  private async getCachedPrice(asset: string, atMs: number): Promise<CachedPrice | null> {
    try {
      const key = this.generateKey(asset, atMs);
      const data = await this.store.execute(async (client) => {
        return await client.get(key);
      });

      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn(`Failed to get cached price for ${asset}:`, error);
      return null;
    }
  }

  private async cachePrice(asset: string, price: number, atMs: number): Promise<void> {
    try {
      const key = this.generateKey(asset, atMs);
      const cachedPrice: CachedPrice = {
        value: price,
        cachedAtMs: atMs,
        source: 'coingecko',
      };

      await this.store.execute(async (client) => {
        // Cache for 24 hours
        return await client.setEx(key, 24 * 60 * 60, JSON.stringify(cachedPrice));
      });

      console.log(`💾 Cached price for ${asset}: $${price}`);
    } catch (error) {
      console.warn(`Failed to cache price for ${asset}:`, error);
      // Don't throw - caching failures shouldn't break the flow
    }
  }

  private isCacheValid(cached: CachedPrice, currentAtMs: number): boolean {
    const ageMs = Math.abs(currentAtMs - cached.cachedAtMs);
    const isValid = ageMs <= this.cacheValidityMs;

    if (!isValid) {
      console.log(`⏰ Cache expired for asset. Age: ${ageMs}ms, Max: ${this.cacheValidityMs}ms`);
    }

    return isValid;
  }

  private generateKey(asset: string, atMs: number): string {
    // Use hour-based bucketing for consistent caching
    const hourBucket = Math.floor(atMs / this.cacheValidityMs) * this.cacheValidityMs;
    return `price:${asset.toLowerCase()}:${hourBucket}`;
  }

  // Allow users to manually cache prices if needed
  async manualCache(asset: string, price: number, atMs: number): Promise<void> {
    await this.cachePrice(asset, price, atMs);
  }

  // Check if we have a cached price
  async hasCachedPrice(asset: string, atMs: number): Promise<boolean> {
    const cached = await this.getCachedPrice(asset, atMs);
    return cached !== null && this.isCacheValid(cached, atMs);
  }
}

export { PriceService };
