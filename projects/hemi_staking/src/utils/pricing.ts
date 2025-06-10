import Big from 'big.js';
import { validateEnv } from '@absinthe/common';
import { Currency } from '@absinthe/common';

const env = validateEnv();

// TODO: move this to a class Function
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

// Value of a token in USD
export function pricePosition(price: number, amount: bigint, decimals: number): number {
    return new Big(amount.toString())
        .div(new Big(10).pow(decimals))
        .mul(price)
        .toNumber();
} 