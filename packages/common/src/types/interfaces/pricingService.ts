interface PriceStore {
  get(asset: string, bucketMs: number, atMs: number): Promise<Price | null>;
  put(asset: string, bucketMs: number, atMs: number, price: Price): Promise<void>;
}

interface PriceProvider {
  // Called only when cache miss; you implement the method (Chainlink, UniV3 TWAP, NAV math, etc.)
  compute(asset: string, atMs: number, ctx: { block: any }): Promise<Price>;
}

type Price = {
  value: number;
  atMs: number;
  source: 'coingecko' | 'uniV3' | 'nav' | 'offchain' | 'defillama' | 'codex';
};

export { PriceStore, PriceProvider, Price };
