import { ChainId } from '../../types/enums';

function getChainEnumKey(chainId: number): keyof typeof ChainId | null {
  const chainIdEntries = Object.entries(ChainId) as [keyof typeof ChainId, number][];
  const found = chainIdEntries.find(([, value]) => value === chainId);
  return found ? found[0] : null;
}

export { getChainEnumKey };
