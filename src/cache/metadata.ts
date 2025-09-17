// Metadata cache implementation

import { Redis } from 'ioredis';
import { AssetMetadata } from '../types/core.ts';
import { MetadataCache } from '../types/pricing.ts';

export class RedisMetadataCache implements MetadataCache {
  constructor(private redis: Redis) {}

  private key(assetKey: string) {
    return `metadata:${assetKey}`;
  }

  async get(assetKey: string): Promise<AssetMetadata | null> {
    const key = this.key(assetKey);
    const result = (await this.redis.call('JSON.GET', key)) as string | null;
    if (result == null) return null;
    return JSON.parse(result) as AssetMetadata;
  }

  async set(assetKey: string, metadata: AssetMetadata): Promise<void> {
    const key = this.key(assetKey);
    await this.redis.call('JSON.SET', key, '$', JSON.stringify(metadata));
  }
}
