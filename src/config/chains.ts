// utils/chains.ts
import { ALL_EVM_CHAINS } from './chains_mini.ts';

export const SUPPORTED_CHAIN_IDS = ALL_EVM_CHAINS.map((chain) => chain.chainId);

export type ChainConfig = Extract<
  typeof ALL_EVM_CHAINS,
  {
    chainId: number;
    name: string;
    shortName: string;
    nativeCurrency: {
      name: string;
      symbol: string;
      decimals: number;
    };
  }
>;

export function getChainConfig(chainId: number): ChainConfig {
  const chain = ALL_EVM_CHAINS.find((c) => c.chainId === chainId);
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return chain as ChainConfig;
}

export function isValidChainId(chainId: number): boolean {
  return SUPPORTED_CHAIN_IDS.includes(chainId);
}
