// scratch notes


// NAV might be the same
// however, underlying price might be different
// coingecko vs defillama vs codex vs univ3
// not to mention that they need to provide configuration per asset or could try to optimistically price everything

/*
mapping our price wiring:
  1. find the first block of the window duration (which is the start of the window)
  2. invoke the priceAsset function on that window
  3. store the result of that computation into the price cache (aka: store the price for that window)
  final output: redis timeseries that has one price per asset for that particular window

  enrichment step:
  1. for each window, we get the twa price for that particular duration by iterating over the price key in redis
  2.

*/



/*
order of operations for pricing:
1. define the asset price feed config
2.


1. for each flush interval (hourly, daily), get all the asset keys
2. for each asset key, we need to price it somehow


// univ2 nav
LP pricing: get reserves, get decimals, price both underlying assets, do some quick math
  - decimals - cached. underlying asset price - cached. But these are all helpers, not inherent to the implementation.
Swap pricing:
- token0 amount scaled by decimals * price of token0 + token1 amount scaled by decimals * price of token1

// univ3:
asset: liquidity (L)
user: owner of nft
pricing logic:
  for all in range positions:
    - get state of pool (like upper/lower tick)
    - get liquidity of pool
    - get price of underlying assets
    - do some quick math
    - sum up the results
    - return the result

// simple asset:
assset: address
user: address

*/


// OLD IMPLEMENTATION
// // UNIV2 NAV PRICING
// class UniV2Nav {
//     constructor(
//         private feed: PriceFeed,
//         private ctx: any,
//         private assetMap: Record<string, AssetKey>,
//     ) { }

//     /** Total pool USD value at time `atMs` */
//     async poolValueUSD(lp: string, atMs: number): Promise<number> {
//         const { token0, token1 } = await this.r.getPairTokens(lp);
//         const [{ r0, r1 }, dec0, dec1] = await Promise.all([
//             this.r.getReserves(lp, atMs),
//             this.r.getDecimals(token0),
//             this.r.getDecimals(token1),
//         ]);

//         const a0 = Number(r0) / 10 ** dec0;
//         const a1 = Number(r1) / 10 ** dec1;

//         // Map on-chain address -> your AssetKey, then -> CoinGecko id via feed config
//         const key0 = this.assetMap[token0.toLowerCase()];
//         const key1 = this.assetMap[token1.toLowerCase()];
//         if (!key0 || !key1) throw new Error('Missing asset mapping for token0 or token1');

//         const [p0, p1] = await Promise.all([
//             this.feed.priceUSD(key0, atMs),
//             this.feed.priceUSD(key1, atMs),
//         ]);

//         return a0 * p0 + a1 * p1;
//     }

//     /** Price of 1 LP token in USD at time `atMs` */
//     async lpTokenPriceUSD(lp: string, atMs: number): Promise<number> {
//         const [poolUsd, totalSupplyRaw] = await Promise.all([
//             this.poolValueUSD(lp, atMs),
//             this.r.getTotalSupply(lp, atMs),
//         ]);
//         // LP token has 18 decimals on typical UniV2-like pairs, but don’t assume
//         const lpDecimals = 18; // read if you store it
//         const totalSupply = Number(totalSupplyRaw) / 10 ** lpDecimals;
//         if (totalSupply === 0) return 0;
//         return poolUsd / totalSupply;
//     }
// }

// // END UNIV2 NAV PRICING