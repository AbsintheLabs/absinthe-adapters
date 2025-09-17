import { fetchHistoricalUsd } from '@absinthe/common';
import { Redis } from 'ioredis';
import { PositionData, Token } from '../utils/interfaces/univ3Types';

export class PositionStorageService {
  private redis: Redis;
  private isConnected = false;

  constructor() {
    // ioredis auto-connects; configure retry strategy via retryStrategy
    this.redis = new Redis(process.env.REDIS_URL || '', {
      retryStrategy: (times) => Math.min(times * 50, 500),
    });
    this.setupRedis();
  }

  private async setupRedis() {
    try {
      // ioredis connects automatically; wait until ready
      await new Promise<void>((resolve, reject) => {
        const onReady = () => {
          cleanup();
          resolve();
        };
        const onError = (err: any) => {
          cleanup();
          reject(err);
        };
        const cleanup = () => {
          this.redis.off('ready', onReady);
          this.redis.off('error', onError);
        };
        this.redis.once('ready', onReady);
        this.redis.once('error', onError);
      });
      this.isConnected = true;
      console.log('Redis connected successfully');
    } catch (error) {
      console.error('Redis connection failed:', error);
      this.isConnected = false;
    }
  }

  async storeToken(token: Token): Promise<void> {
    const tokenKey = `token:${token.id}`;
    await this.redis.hset(tokenKey, {
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
    const data = (await this.redis.hgetall(tokenKey)) as any;
    if (!data.id) return null;
    return data as unknown as Token;
  }

  async storeEthUsdPrice(ethUsdPrice: number): Promise<void> {
    const ethUsdPriceKey = `ethUsdPrice`;
    await this.redis.set(ethUsdPriceKey, ethUsdPrice.toString(), 'EX', 60 * 5);
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
        process.env.COINGECKO_API_KEY || '',
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

  //todo: efficiency
  async storePosition(position: PositionData): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }
    const positionKey = `pool:${position.poolId}:position:${position.positionId}`;
    await this.redis.hset(positionKey, {
      positionId: position.positionId,
      owner: position.owner,
      liquidity: position.liquidity,
      tickLower: position.tickLower.toString(),
      tickUpper: position.tickUpper.toString(),
      currentTick: position.currentTick.toString(),
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
    await this.redis.sadd(`pool:${position.poolId}:positions`, position.positionId);
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
    const data = (await this.redis.hgetall(positionKey)) as any;
    if (!data.positionId) return null;

    const position: PositionData = {
      positionId: data.positionId,
      owner: data.owner,
      liquidity: data.liquidity,
      tickLower: parseInt(data.tickLower),
      tickUpper: parseInt(data.tickUpper),
      currentTick: parseInt(data.currentTick),
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
    await this.redis.hset(positionKey, {
      owner: position.owner,
      liquidity: position.liquidity,
      isActive: position.isActive,
      lastUpdatedBlockTs: position.lastUpdatedBlockTs.toString(),
      lastUpdatedBlockHeight: position.lastUpdatedBlockHeight.toString(),
      depositedToken0: position.depositedToken0,
      depositedToken1: position.depositedToken1,
      tickLower: position.tickLower.toString(),
      tickUpper: position.tickUpper.toString(),
      currentTick: position.currentTick.toString(),
      poolId: position.poolId,
    } as any);
  }

  //todo: efficiency
  async getAllPositionsByPoolId(poolId: string): Promise<PositionData[]> {
    const positionIds = await this.redis.smembers(`pool:${poolId}:positions`);
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

    await this.redis.srem(`pool:${poolId}:positions`, positionId);
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.redis.quit();
      this.isConnected = false;
    }
  }
}
