// src/pricing/pricing.ts
import Big from 'big.js';
import { PoolConfig, PoolState } from '../model';
import { validateEnv } from '../utils/validateEnv'; // your existing validateEnv logic
import { fetchWithRetry } from '../utils/fetchWithRetry';

const env = validateEnv();

export async function fetchHistoricalUsd(id: string, tsMs: number): Promise<number> {
    // round to day, call Coingecko once per day → cheaper
    const d = new Date(tsMs);
    const date = `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1)
        .toString().padStart(2, '0')}-${d.getFullYear()}`;

    const url = `https://pro-api.coingecko.com/api/v3/coins/${id}/history?date=${date}&localization=false`;
    const res = await fetchWithRetry(() => fetch(url, {
        headers: { accept: 'application/json', 'x-cg-pro-api-key': env.coingeckoApiKey }
    }));
    const j = await res.json();
    if (!j.market_data?.current_price?.usd) {
        throw new Error(`No market data found for ${id} on ${date}`);
    }
    return j.market_data.current_price.usd;
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
    const hourBucket =
        new Date(timestampMs).setMinutes(0, 0, 0);           // round to top-of-hour
    const k = `${coingeckoId}-${hourBucket}`;

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

export async function computeLpTokenPrice(
    poolCfg: PoolConfig,
    poolState: PoolState,
    atMs: number,
): Promise<number> {
    if (!poolCfg.token0?.coingeckoId || !poolCfg.token1?.coingeckoId) {
        throw new Error('missing coingecko id on tokens');
    }

    const [p0, p1] = await Promise.all([
        getHourlyPrice(poolCfg.token0.coingeckoId, atMs),
        getHourlyPrice(poolCfg.token1.coingeckoId, atMs)
    ]);

    const v0 = new Big(poolState.reserve0.toString())
        .div(new Big(10).pow(poolCfg.token0.decimals))
        .mul(p0);
    const v1 = new Big(poolState.reserve1.toString())
        .div(new Big(10).pow(poolCfg.token1.decimals))
        .mul(p1);

    const total = v0.add(v1);
    return total
        .div(new Big(poolState.totalSupply.toString())
            .div(new Big(10).pow(poolCfg.lpToken.decimals)))
        .toNumber();
}