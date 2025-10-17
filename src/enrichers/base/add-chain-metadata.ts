// enrichers/base/add-chain-metadata.ts
import { Enricher } from '../core.ts';
import { getRuntime } from '../../runtime/context.ts';
import { ChainArch } from '../../config/schema.ts';

type ChainFields = {
  chain_id: string; // Use string for JSON serialization
  chain_short_name: string;
  chain_arch: ChainArch;
};

export const addChainMetadata = <T extends object>(): Enricher<T, T & ChainFields> => {
  return (item) => {
    const { chainId, chainShortName, chainArch } = getRuntime();

    return {
      ...item,
      chain_id: chainId.toString(),
      chain_short_name: chainShortName,
      chain_arch: chainArch,
    };
  };
};
