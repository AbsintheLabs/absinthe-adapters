export interface TokenInfo {
  id: string;
  decimals: number;
}

export interface PoolInfo {
  address: string;
  token0Address: string;
  token1Address: string;
  fee: number;
  isActive: boolean;
}
