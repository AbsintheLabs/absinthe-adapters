// Engine contracts
type BalanceDelta = {
  user: string;
  asset: string;
  amount: Big;
  // fixme: we should adapt this to follow the name, value, type format that we expect. aka; disallow nested objects, it should be flat by intention
  meta?: Record<string, unknown>;
};

type PositionToggle = {
  // implement me!
};

type Transaction = {};

// Adapter interface (you implement this per protocol)
interface TwbAdapter {
  onEvent(
    block: any,
    log: any,
    emit: {
      balanceDelta: (e: BalanceDelta) => void;
      positionToggle: (e: PositionToggle) => void;
      transaction: (e: Transaction) => void;
      // add more here as scope grows
    },
  ): Promise<void>;
  priceAsset?: (
    input: { atMs: number; asset: any; coingeckoId?: string },
    providers: {
      usdPrimitive: (
        atHourMs: number,
        reqs: Array<{ coingeckoId?: string; address?: string; chain?: string }>,
      ) => Promise<Record<string, number>>;
    },
  ) => Promise<number>;
}

export { BalanceDelta, PositionToggle, TwbAdapter };
