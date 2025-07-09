import { fetchHistoricalUsd } from '@absinthe/common';
import { createClient, RedisClientType } from 'redis';
import { PositionData, Token } from '../utils/interfaces/univ3Types';

export class PositionStorageService {
  private redis: RedisClientType;
  private isConnected = false;

  constructor() {
    this.redis = createClient({
      url: process.env.REDIS_URL,
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

  // async storePoolMetadata(poolId: string, poolMetadata: PoolMetadata): Promise<void> {
  //   const poolMetadataKey = `poolMetadata:${poolId}`;
  //   await this.redis.set(poolMetadataKey, JSON.stringify(poolMetadata));
  // }

  // async getPoolMetadata(poolId: string): Promise<PoolMetadata | null> {
  //   const poolMetadataKey = `poolMetadata:${poolId}`;
  //   const data = await this.redis.get(poolMetadataKey);
  //   if (!data) return null;
  //   return JSON.parse(data);
  // }

  async storeToken(token: Token): Promise<void> {
    const tokenKey = `token:${token.id}`;
    await this.redis.hSet(tokenKey, {
      id: token.id,
      symbol: token.symbol,
      name: token.name,
      totalSupply: token.totalSupply.toString(),
      decimals: token.decimals.toString(),
    });
  }

  async storeMultipleTokens(tokens: Token[]): Promise<void> {
    for (const token of tokens) {
      await this.storeToken(token);
    }
  }

  async getToken(tokenId: string): Promise<Token | null> {
    const tokenKey = `token:${tokenId}`;
    const data = await this.redis.hGetAll(tokenKey);
    if (!data.id) return null;
    return data as unknown as Token;
  }

  async storeEthUsdPrice(ethUsdPrice: number): Promise<void> {
    const ethUsdPriceKey = `ethUsdPrice`;
    await this.redis.setEx(ethUsdPriceKey, 60 * 5, ethUsdPrice.toString());
  }

  async getEthUsdPrice(): Promise<number> {
    const ethUsdPriceKey = `ethUsdPrice`;
    const data = await this.redis.get(ethUsdPriceKey);
    if (data) {
      return Number(data);
    }

    try {
      const coingeckoPrice = await fetchHistoricalUsd(
        'ethereum',
        Date.now(),
        process.env.COINGECKO_API_KEY || '', //todo: add this
      );
      if (coingeckoPrice > 0) {
        await this.storeEthUsdPrice(coingeckoPrice);
        return coingeckoPrice;
      }
    } catch (error) {
      console.warn('Failed to fetch ETH price from CoinGecko:', error);
    }

    return 0;
  }

  //todo: make it efficient - redis pipeline
  async storePosition(position: PositionData): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }
    const positionKey = `pool:${position.poolId}:position:${position.positionId}`;
    await this.redis.hSet(positionKey, {
      positionId: position.positionId,
      owner: position.owner,
      liquidity: position.liquidity,
      tickLower: position.tickLower.toString(),
      tickUpper: position.tickUpper.toString(),
      token0Id: position.token0Id,
      token1Id: position.token1Id,
      fee: position.fee,
      poolId: position.poolId,
      depositedToken0: position.depositedToken0,
      depositedToken1: position.depositedToken1,
      isActive: position.isActive,
      lastUpdatedBlockTs: position.lastUpdatedBlockTs.toString(),
      lastUpdatedBlockHeight: position.lastUpdatedBlockHeight.toString(),
    });
    await this.redis.set(`positionPool:${position.positionId}`, position.poolId);
    await this.redis.sAdd(`pool:${position.poolId}:positions`, position.positionId);
  }

  async storeBatchPositions(positions: PositionData[]): Promise<void> {
    for (const position of positions) {
      await this.storePosition(position);
    }
  }

  async checkIfPositionExists(positionId: string): Promise<boolean> {
    const poolId = await this.redis.get(`positionPool:${positionId}`);
    return poolId !== null;
  }

  async getPosition(positionId: string): Promise<PositionData | null> {
    if (!this.isConnected) return null;

    const poolId = await this.redis.get(`positionPool:${positionId}`);
    if (!poolId) return null;

    const positionKey = `pool:${poolId}:position:${positionId}`;
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
      fee: parseInt(data.fee),
      poolId: data.poolId,
      depositedToken0: data.depositedToken0,
      depositedToken1: data.depositedToken1,
      isActive: data.isActive,
      lastUpdatedBlockTs: parseInt(data.lastUpdatedBlockTs),
      lastUpdatedBlockHeight: parseInt(data.lastUpdatedBlockHeight),
    };

    return position;
  }

  async updatePosition(position: PositionData): Promise<void> {
    const poolId = await this.redis.get(`positionPool:${position.positionId}`);
    if (!poolId) return;

    const positionKey = `pool:${poolId}:position:${position.positionId}`;
    await this.redis.hSet(positionKey, {
      owner: position.owner,
      liquidity: position.liquidity,
      isActive: position.isActive,
      lastUpdatedBlockTs: position.lastUpdatedBlockTs.toString(),
      lastUpdatedBlockHeight: position.lastUpdatedBlockHeight.toString(),
    });
  }

  //todo: make it efficient
  async getAllPositionsByPoolId(poolId: string): Promise<PositionData[]> {
    const positionIds = await this.redis.sMembers(`pool:${poolId}:positions`);
    const positions: PositionData[] = [];

    for (const positionId of positionIds) {
      const position = await this.getPosition(positionId);
      if (position) {
        positions.push(position);
      }
    }

    return positions;
  }

  async deletePosition(positionId: string): Promise<void> {
    const poolId = await this.redis.get(`positionPool:${positionId}`);
    if (!poolId) {
      throw new Error(`Position ${positionId} not found`);
    }

    const positionKey = `pool:${poolId}:position:${positionId}`;
    await this.redis.del(positionKey);
    await this.redis.del(`positionPool:${positionId}`);

    await this.redis.sRem(`pool:${poolId}:positions`, positionId);
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.redis.disconnect();
      this.isConnected = false;
    }
  }
}
