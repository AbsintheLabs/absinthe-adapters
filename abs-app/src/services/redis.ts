import { createClient, RedisClientType } from 'redis';
import { config } from '../config';

interface ApiKeyValidationResult {
  isValid: boolean;
  clientId?: string;
  seasonId?: string;
  permissions?: string[];
  expiresAt?: number;
}

export class RedisService {
  private redis: RedisClientType;
  private isConnected: boolean = false;
  private readonly CACHE_TTL = 15 * 60; // 15 minutes in seconds

  constructor() {
    this.redis = createClient({
      url: config.redisUrl,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500),
      },
    });
    this.setupRedis();
  }

  private async setupRedis() {
    try {
      await this.redis.connect();
      this.isConnected = true;
      console.log('Redis connected successfully');
    } catch (error) {
      console.error('Redis connection failed:', error);
      this.isConnected = false;
    }
  }

  async getApiKeyValidation(apiKey: string): Promise<ApiKeyValidationResult | null> {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping cache lookup');
      return null;
    }

    try {
      const cached = await this.redis.get(`api_key:${apiKey}`);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('Error getting API key from cache:', error);
      return null;
    }
  }

  async getAllKeys(): Promise<string[]> {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping cache lookup');
      return [];
    }
    return await this.redis.keys('api_key:*');
  }

  async setApiKeyValidation(apiKey: string, validation: ApiKeyValidationResult): Promise<void> {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping cache set');
      return;
    }

    try {
      await this.redis.setEx(`api_key:${apiKey}`, this.CACHE_TTL, JSON.stringify(validation));
      console.debug(`Cached API key validation for ${apiKey}`);
    } catch (error) {
      console.error('Error setting API key in cache:', error);
    }
  }
  async disconnect(): Promise<void> {
    if (this.redis && this.isConnected) {
      await this.redis.disconnect();
      this.isConnected = false;
    }
  }
}

export const redisService = new RedisService();
