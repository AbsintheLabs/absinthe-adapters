/* eslint-disable prettier/prettier */
import { createClient, RedisClientType } from 'redis';

interface PositionData {
  positionId: string;
  owner: string;
  liquidity: string;
  tickLower: number;
  tickUpper: number;
  token0Id: string;
  token1Id: string;
  depositedToken0: string;
  depositedToken1: string;
  isActive: boolean;
  lastUpdated: number;
}

export class PositionStorageService {
  private redis: RedisClientType;
  private isConnected = false;

  constructor() {
    // Redis client
    this.redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
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

  // Store position data
  async storePosition(position: PositionData): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }

    const positionKey = `position:${position.positionId}`;
    const tickRangeKey = `tick:${position.tickLower}:positions`;

    // Store position data
    await this.redis.hSet(positionKey, {
      ...position,
      lastUpdated: Date.now().toString(),
    });

    // Add to tick range sorted set (score = tickUpper)
    await this.redis.zAdd(tickRangeKey, {
      score: position.tickUpper,
      value: position.positionId,
    });
  }

  // Get position by ID
  async getPosition(positionId: string): Promise<PositionData | null> {
    const positionKey = `position:${positionId}`;

    if (!this.isConnected) return null;

    // Get from Redis
    const data = await this.redis.hGetAll(positionKey);
    if (!data.positionId) return null;

    const position: PositionData = {
      positionId: data.positionId,
      owner: data.owner,
      liquidity: data.liquidity,
      tickLower: parseInt(data.tickLower),
      tickUpper: parseInt(data.tickUpper),
      token0Id: data.token0Id,
      token1Id: data.token1Id,
      depositedToken0: data.depositedToken0,
      depositedToken1: data.depositedToken1,
      isActive: data.isActive === 'true',
      lastUpdated: parseInt(data.lastUpdated),
    };

    return position;
  }

  // Get all positions
  async getAllPositions(): Promise<PositionData[]> {
    const positions = await this.redis.hGetAll('position:*');
    return positions.map((position) => ({
      positionId: position.positionId,
      owner: position.owner,
      liquidity: position.liquidity,
      tickLower: parseInt(position.tickLower),
      tickUpper: parseInt(position.tickUpper),
      token0Id: position.token0Id,
      token1Id: position.token1Id,
      depositedToken0: position.depositedToken0,
      depositedToken1: position.depositedToken1,
      isActive: isActive,
      lastUpdated: parseInt(position.lastUpdated),
    }));
  }

  // Get active positions for a pool at current tick
  async getActivePositions(poolId: string, currentTick: number): Promise<PositionData[]> {
    if (!this.isConnected) return [];

    const poolKey = `pool:${poolId}:positions`;
    const positionIds = await this.redis.sMembers(poolKey);

    const activePositions: PositionData[] = [];

    for (const positionId of positionIds) {
      const position = await this.getPosition(positionId);
      if (
        position &&
        position.isActive &&
        position.tickLower <= currentTick &&
        position.tickUpper > currentTick
      ) {
        activePositions.push(position);
      }
    }

    return activePositions;
  }

  // Update position activity status based on current tick
  async updatePositionActivity(poolId: string, currentTick: number): Promise<void> {
    if (!this.isConnected) return;

    const poolKey = `pool:${poolId}:positions`;
    const positionIds = await this.redis.sMembers(poolKey);

    for (const positionId of positionIds) {
      const position = await this.getPosition(positionId);
      if (!position) continue;

      const wasActive = position.isActive;
      const isNowActive = position.tickLower <= currentTick && position.tickUpper > currentTick;

      if (wasActive !== isNowActive) {
        position.isActive = isNowActive;
        await this.storePosition(position);
      }
    }
  }

  // Get positions in a specific tick range
  async getPositionsInTickRange(
    poolId: string,
    tickLower: number,
    tickUpper: number,
  ): Promise<PositionData[]> {
    if (!this.isConnected) return [];

    const tickRangeKey = `pool:${poolId}:tick:${tickLower}:positions`;
    const positionIds = await this.redis.zRangeByScore(tickRangeKey, tickLower, tickUpper);

    const positions: PositionData[] = [];
    for (const positionId of positionIds) {
      const position = await this.getPosition(positionId);
      if (position) positions.push(position);
    }

    return positions;
  }

  // Batch operations for better performance
  async batchStorePositions(positions: PositionData[]): Promise<void> {
    if (!this.isConnected) return;

    const pipeline = this.redis.multi();

    for (const position of positions) {
      const positionKey = `position:${position.positionId}`;
      const poolKey = `pool:${position.poolId}:positions`;
      const tickRangeKey = `pool:${position.poolId}:tick:${position.tickLower}:positions`;

      pipeline.hSet(positionKey, {
        ...position,
        lastUpdated: Date.now().toString(),
      });
      pipeline.sAdd(poolKey, position.positionId);
      pipeline.zAdd(tickRangeKey, {
        score: position.tickUpper,
        value: position.positionId,
      });
    }

    await pipeline.exec();
  }

  // Cleanup old positions (optional)
  async cleanupOldPositions(olderThanMs: number): Promise<void> {
    if (!this.isConnected) return;

    const cutoff = Date.now() - olderThanMs;
    const pattern = 'position:*';
    const keys = await this.redis.keys(pattern);

    for (const key of keys) {
      const lastUpdated = await this.redis.hGet(key, 'lastUpdated');
      if (lastUpdated && parseInt(lastUpdated) < cutoff) {
        await this.redis.del(key);
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.redis.disconnect();
      this.isConnected = false;
    }
  }
}
