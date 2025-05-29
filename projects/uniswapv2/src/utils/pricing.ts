import Big from 'big.js';
import { PoolConfig, PoolState } from '../model';
import { validateEnv } from '@absinthe/common';
import { fetchWithRetry } from '@absinthe/common';
import { DataHandlerContext, BlockData } from '@subsquid/evm-processor';
import { Store } from '@subsquid/typeorm-store';
import { updatePoolStateFromOnChain } from './pool';
import { Currency } from '@absinthe/common';

const env = validateEnv();

export async function fetchHistoricalUsd(id: string, tsMs: number): Promise<number> {
    // round to day, call Coingecko once per day → cheaper
    const d = new Date(tsMs);
    const date = `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1)
        .toString().padStart(2, '0')}-${d.getFullYear()}`;

    const url = `https://pro-api.coingecko.com/api/v3/coins/${id}/history?date=${date}&localization=false`;
    const res = await fetch(url, {
        headers: { accept: 'application/json', 'x-cg-pro-api-key': env.coingeckoApiKey }
    });
    const j = await res.json();
    console.log(j, "j", url)
    if (!j.market_data?.current_price?.[Currency.USD]) {
        // warn: this is not a fatal error, but it should be investigated since position value will be inaccurate
        // throw new Error(`No market data found for ${id} on ${date}`);
        console.error(`No market data found for ${id} on ${date}`);
        return 0;
    }
    return j.market_data.current_price[Currency.USD];
}

/** in-memory, process-wide price cache (key = "<id>-<hourBucket>") */
const hourlyPriceCache = new Map<string, number>();

export async function getHourlyPrice(
    coingeckoId: string,
    timestampMs: number,
    isMocked: boolean = false
): Promise<number> {
    if (isMocked) return 0;
    if (!coingeckoId) throw new Error('coingeckoId required');
    const dayBucket =
        new Date(timestampMs).setHours(0, 0, 0, 0);           // round to top-of-day
    const k = `${coingeckoId}-${dayBucket}`;

    if (hourlyPriceCache.has(k)) return hourlyPriceCache.get(k)!;

    const price = await fetchHistoricalUsd(coingeckoId, timestampMs);
    hourlyPriceCache.set(k, price);
    return price;
}

export async function computePricedSwapVolume(
    tokenAmount: bigint,
    coingeckoId: string,
    decimals: number,
    atMs: number,
    isMocked: boolean = false
): Promise<number> {
    if (isMocked) return 0;
    const price = await getHourlyPrice(coingeckoId, atMs);
    return new Big(tokenAmount.toString())
        .div(new Big(10).pow(decimals))
        .mul(price)
        .toNumber();
}

export function pricePosition(price: number, amount: bigint, decimals: number): number {
    return new Big(amount.toString())
        .div(new Big(10).pow(decimals))
        .mul(price)
        .toNumber();
}

export async function computeLpTokenPrice(
    ctx: DataHandlerContext<Store>,
    block: BlockData,
    poolConfig: PoolConfig,
    poolState: PoolState,
    timestampMs?: number
): Promise<number> {
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

    if (poolState.isDirty) {
        poolState = await updatePoolStateFromOnChain(ctx, block, poolConfig.lpToken.address, poolConfig);
    }

    // Check for zero total supply to avoid division by zero
    if (poolState.totalSupply === 0n) {
        console.warn(`Pool ${poolConfig.id} has zero total supply, returning price 0`);
        return 0;
    }

    const timestamp = timestampMs ?? Number(poolState.lastTsMs);
    const [token0Price, token1Price] = await Promise.all([
        getHourlyPrice(poolConfig.token0.coingeckoId, timestamp),
        getHourlyPrice(poolConfig.token1.coingeckoId, timestamp)
    ]);

    // If either token price is 0, we can't calculate a meaningful LP token price
    if (token0Price === 0 || token1Price === 0) {
        console.warn(`One or both token prices are 0 for pool ${poolConfig.id}, returning price 0`);
        return 0;
    }

    const token0Value = new Big(poolState.reserve0.toString())
        .div(new Big(10).pow(poolConfig.token0.decimals))
        .mul(token0Price);

    // Calculate token1 value in USD
    const token1Value = new Big(poolState.reserve1.toString())
        .div(new Big(10).pow(poolConfig.token1.decimals))
        .mul(token1Price);

    // Total value in the pool
    const totalPoolValue = token0Value.add(token1Value);

    // Calculate price per LP token
    const totalSupplyBig = new Big(poolState.totalSupply.toString())
        .div(new Big(10).pow(poolConfig.lpToken.decimals));

    // Additional safety check for zero total supply after conversion
    if (totalSupplyBig.eq(0)) {
        console.warn(`Pool ${poolConfig.id} has zero total supply after decimal conversion, returning price 0`);
        return 0;
    }

    const price = totalPoolValue.div(totalSupplyBig).toNumber();

    return price;
}