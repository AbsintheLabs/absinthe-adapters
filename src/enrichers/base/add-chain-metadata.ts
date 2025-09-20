// enrichers/base/add-chain-metadata.ts
import { Enricher } from '../core.ts';
import { getRuntime } from '../../runtime/context.ts';

type ChainFields = {
  chainId: bigint;
  chainShortName: string;
  chainArch: 'evm' | 'solana';
};

export const addChainMetadata = <T extends object>(): Enricher<T, T & ChainFields> => {
  return (item) => {
    const { chainId, chainShortName, chainArch } = getRuntime();

    return {
      ...item,
      chainId: BigInt(chainId),
      chainShortName: chainShortName,
      chainArch,
    };
  };
};
