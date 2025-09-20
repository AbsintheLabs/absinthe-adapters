// enrichers/base/add-chain-metadata.ts
import { Enricher } from '../core.ts';
import { getRuntime } from '../../runtime/context.ts';
import { ChainArch } from '../../config/schema.ts';

type ChainFields = {
  chainId: string; // Use string for JSON serialization
  chainShortName: string;
  chainArch: ChainArch;
};

export const addChainMetadata = <T extends object>(): Enricher<T, T & ChainFields> => {
  return (item) => {
    const { chainId, chainShortName, chainArch } = getRuntime();

    return {
      ...item,
      chainId: chainId.toString(),
      chainShortName: chainShortName,
      chainArch,
    };
  };
};
