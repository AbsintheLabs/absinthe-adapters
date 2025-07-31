import Big from 'big.js';
import { PoolConfig, PoolState } from '../model';
import { DataHandlerContext, BlockData } from '@subsquid/evm-processor';
import { Store } from '@subsquid/typeorm-store';
import { updatePoolStateFromOnChain } from './pool';
import { fetchHistoricalUsd, pricePosition } from '@absinthe/common';

/** in-memory, process-wide price cache (key = "<id>-<hourBucket>") */
const hourlyPriceCache = new Map<string, number>();

export async function getHourlyPrice(
  coingeckoId: string,
  timestampMs: number,
  coingeckoApiKey: string,
  isMocked: boolean = false,
): Promise<number> {
  if (isMocked) return 0;
  if (!coingeckoId) throw new Error('coingeckoId required');
  const dayBucket = new Date(timestampMs).setHours(0, 0, 0, 0); // round to top-of-day
  const k = `${coingeckoId}-${dayBucket}`;

  if (hourlyPriceCache.has(k)) return hourlyPriceCache.get(k)!;

  const price = await fetchHistoricalUsd(coingeckoId, timestampMs, coingeckoApiKey);
  hourlyPriceCache.set(k, price);
  return price;
}

export async function computePricedSwapVolume(
  tokenAmount: bigint,
  coingeckoId: string,
  decimals: number,
  atMs: number,
  coingeckoApiKey: string,
  isMocked: boolean = false,
): Promise<number> {
  if (isMocked) return 0;
  const price = await getHourlyPrice(coingeckoId, atMs, coingeckoApiKey);
  return pricePosition(price, tokenAmount, decimals);
}

// Value of a token in USD
// Value of 1 LP token in USD
export async function computeLpTokenPrice(
  ctx: DataHandlerContext<Store>,
  block: BlockData,
  poolConfig: PoolConfig,
  poolState: PoolState,
  coingeckoApiKey: string,
  timestampMs?: number,
): Promise<{
  price: number;
  token0Price: number;
  token1Price: number;
  token0Value: number;
  token1Value: number;
  totalPoolValue: number;
  totalSupplyBig: Big.Big;
  reserve0: bigint;
  reserve1: bigint;
}> {
  if (!poolConfig) {
    throw new Error('No poolConfig provided to computeLpTokenPrice');
  }

  if (!poolState) {
    throw new Error('No poolState provided to computeLpTokenPrice');
  }

  if (!poolConfig.token0) {
    throw new Error(`poolConfig.token0 is missing in poolConfig ${poolConfig.id}`);
  }

  if (!poolConfig.token1) {
    throw new Error(`poolConfig.token1 is missing in poolConfig ${poolConfig.id}`);
  }

  if (!poolConfig.lpToken) {
    throw new Error(`poolConfig.lpToken is missing in poolConfig ${poolConfig.id}`);
  }

  if (!poolConfig.token0.coingeckoId || !poolConfig.token1.coingeckoId) {
    throw new Error('No coingecko id found for token0 or token1');
  }

  poolState = await updatePoolStateFromOnChain(
    ctx,
    block,
    poolConfig.lpToken.address,
    poolConfig,
    poolState,
  );

  // Check for zero total supply to avoid division by zero
  if (poolState.totalSupply === 0n) {
    console.warn(`Pool ${poolConfig.id} has zero total supply, returning price 0`);
    return {
      price: 0,
      token0Price: 0,
      token1Price: 0,
      token0Value: 0,
      token1Value: 0,
      totalPoolValue: 0,
      totalSupplyBig: new Big(0),
      reserve0: BigInt(0),
      reserve1: BigInt(0),
    };
  }

  const timestamp = timestampMs ?? Number(poolState.lastTsMs);
  const [token0Price, token1Price] = await Promise.all([
    getHourlyPrice(poolConfig.token0.coingeckoId, timestamp, coingeckoApiKey),
    getHourlyPrice(poolConfig.token1.coingeckoId, timestamp, coingeckoApiKey),
  ]);

  if (token0Price === 0 || token1Price === 0) {
    console.warn(`One or both token prices are 0 for pool ${poolConfig.id}, returning price 0`);
    return {
      price: 0,
      token0Price: 0,
      token1Price: 0,
      token0Value: 0,
      token1Value: 0,
      totalPoolValue: 0,
      totalSupplyBig: new Big(0),
      reserve0: BigInt(0),
      reserve1: BigInt(0),
    };
  }

  const token0Value = pricePosition(token0Price, poolState.reserve0, poolConfig.token0.decimals);
  const token1Value = pricePosition(token1Price, poolState.reserve1, poolConfig.token1.decimals);

  const totalPoolValue = token0Value + token1Value;

  // Calculate price per LP token
  const totalSupplyBig = new Big(poolState.totalSupply.toString()).div(
    new Big(10).pow(poolConfig.lpToken.decimals),
  );

  // Additional safety check for zero total supply after conversion
  if (totalSupplyBig.eq(0)) {
    console.warn(
      `Pool ${poolConfig.id} has zero total supply after decimal conversion, returning price 0`,
    );
    return {
      price: 0,
      token0Price: 0,
      token1Price: 0,
      token0Value: 0,
      token1Value: 0,
      totalPoolValue: 0,
      totalSupplyBig: new Big(0),
      reserve0: BigInt(0),
      reserve1: BigInt(0),
    };
  }

  const price = new Big(totalPoolValue).div(totalSupplyBig).toNumber();

  return {
    price,
    token0Price,
    token1Price,
    token0Value,
    token1Value,
    totalPoolValue,
    totalSupplyBig,
    reserve0: poolState.reserve0,
    reserve1: poolState.reserve1,
  };
}
