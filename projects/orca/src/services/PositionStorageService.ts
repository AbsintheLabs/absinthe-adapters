import { fetchHistoricalUsd } from '@absinthe/common';
import { createClient, RedisClientType } from 'redis';
import { Token, PositionDetails, PoolDetails } from '../utils/types';

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

  //token storage

  async storeToken(token: Token): Promise<void> {
    const tokenKey = `token:${token.id}`;
    await this.redis.hSet(tokenKey, {
      id: token.id,
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

  //pool storage
  async storePool(pool: PoolDetails): Promise<void> {
    const poolKey = `pool:${pool.poolId}`;
    await this.redis.hSet(poolKey, {
      poolId: pool.poolId,
      token0Id: pool.token0Id,
      token1Id: pool.token1Id,
      fee: pool.fee.toString(),
      token0Decimals: pool.token0Decimals.toString(),
      token1Decimals: pool.token1Decimals.toString(),
    });
  }

  async getPool(poolId: string): Promise<PoolDetails | null> {
    const poolKey = `pool:${poolId}`;
    const data = await this.redis.hGetAll(poolKey);
    if (!data.poolId) return null;

    return {
      poolId: data.poolId,
      token0Id: data.token0Id,
      token1Id: data.token1Id,
      fee: data.fee,
      token0Decimals: parseInt(data.token0Decimals),
      token1Decimals: parseInt(data.token1Decimals),
      poolType: data.poolType,
      currentTick: parseInt(data.currentTick),
      whirlpoolConfig: data.whirlpoolConfig,
      tickSpacing: parseInt(data.tickSpacing),
      tokenProgram: data.tokenProgram,
      systemProgram: data.systemProgram,
      tokenVault0: data.tokenVault0,
      tokenVault1: data.tokenVault1,
      funder: data.funder,
    };
  }

  //eth price storage

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

  async storePosition(position: PositionDetails): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }
    const positionKey = `pool:${position.poolId}:position:${position.positionId}`;
    await this.redis.hSet(positionKey, {
      positionId: position.positionId,
      positionMint: position.positionMint,
      owner: position.owner,
      liquidity: position.liquidity,
      tickLower: position.tickLower.toString(),
      tickUpper: position.tickUpper.toString(),
      poolId: position.poolId,
      isActive: position.isActive,
      lastUpdatedBlockTs: position.lastUpdatedBlockTs.toString(),
      lastUpdatedBlockHeight: position.lastUpdatedBlockHeight.toString(),
    });
    await this.redis.set(`positionPool:${position.positionId}`, position.poolId);
    await this.redis.sAdd(`pool:${position.poolId}:positions`, position.positionId);
  }

  async storeBatchPositions(positions: PositionDetails[]): Promise<void> {
    for (const position of positions) {
      await this.storePosition(position);
    }
  }

  async checkIfPositionExists(positionId: string): Promise<boolean> {
    const poolId = await this.redis.get(`positionPool:${positionId}`);
    return poolId !== null;
  }

  async getPosition(positionId: string, whirlpool: string): Promise<PositionDetails | null> {
    if (!this.isConnected) return null;

    const poolId = await this.redis.get(`positionPool:${positionId}`);
    if (!poolId) return null;

    if (poolId !== whirlpool) return null;

    const positionKey = `pool:${poolId}:position:${positionId}`;
    const data = await this.redis.hGetAll(positionKey);
    if (!data.positionId) return null;

    const position: PositionDetails = {
      positionId: data.positionId,
      owner: data.owner,
      liquidity: data.liquidity,
      tickLower: parseInt(data.tickLower),
      tickUpper: parseInt(data.tickUpper),
      positionMint: data.positionMint,
      tokenProgram: data.tokenProgram,
      poolId: data.poolId,
      isActive: data.isActive,
      lastUpdatedBlockTs: parseInt(data.lastUpdatedBlockTs),
      lastUpdatedBlockHeight: parseInt(data.lastUpdatedBlockHeight),
    };

    return position;
  }

  async updatePosition(position: PositionDetails): Promise<void> {
    const poolId = await this.redis.get(`positionPool:${position.positionId}`);
    if (!poolId) return;

    const positionKey = `pool:${poolId}:position:${position.positionId}`;
    await this.redis.hSet(positionKey, {
      owner: position.owner,
      liquidity: position.liquidity,
      isActive: position.isActive,
      lastUpdatedBlockTs: position.lastUpdatedBlockTs.toString(),
      lastUpdatedBlockHeight: position.lastUpdatedBlockHeight.toString(),
      positionMint: position.positionMint,
      tickLower: position.tickLower.toString(),
      tickUpper: position.tickUpper.toString(),
      poolId: position.poolId,
    });
  }

  //todo: efficiency
  async getAllPositionsByPoolId(poolId: string): Promise<PositionDetails[]> {
    const positionIds = await this.redis.sMembers(`pool:${poolId}:positions`);
    const positions: PositionDetails[] = [];

    for (const positionId of positionIds) {
      const position = await this.getPosition(positionId, poolId);
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
