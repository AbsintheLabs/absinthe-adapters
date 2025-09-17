// Metadata cache implementation

import { RedisClientType } from 'redis';
import { AssetMetadata } from '../types/core.ts';
import { MetadataCache } from '../types/pricing.ts';

export class RedisMetadataCache implements MetadataCache {
  constructor(private redis: RedisClientType) {}

  private key(assetKey: string) {
    return `metadata:${assetKey}`;
  }

  async get(assetKey: string): Promise<AssetMetadata | null> {
    const key = this.key(assetKey);
    const result = await this.redis.json.get(key);
    return result as AssetMetadata | null;
  }

  async set(assetKey: string, metadata: AssetMetadata): Promise<void> {
    const key = this.key(assetKey);
    await this.redis.json.set(key, '$', metadata as any);
  }
}
