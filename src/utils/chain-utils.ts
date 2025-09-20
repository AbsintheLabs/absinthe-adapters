import { ALL_EVM_CHAINS } from '../config/chains_mini.ts';

export interface ChainInfo {
  name: string;
  chainId: number;
  shortName: string;
  networkId: number;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpc: string[];
  faucets: string[];
  infoURL: string;
}

/**
 * Get the shortName for a given chainId
 * @param chainId The chain ID to look up
 * @returns The shortName for the chain, or undefined if not found
 */
export function getChainShortName(chainId: number): string {
  const chain = ALL_EVM_CHAINS.find((c) => c.chainId === chainId);
  if (!chain) {
    throw new Error(`Chain not found for chainId: ${chainId}`);
  }
  return chain.shortName;
}

/**
 * Get the full chain info for a given chainId
 * @param chainId The chain ID to look up
 * @returns The full chain info, or undefined if not found
 */
export function getChainInfo(chainId: number): ChainInfo | undefined {
  return ALL_EVM_CHAINS.find((c) => c.chainId === chainId);
}
