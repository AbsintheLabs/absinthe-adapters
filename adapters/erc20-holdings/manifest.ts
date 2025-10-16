import { evmAddress, Manifest } from '../_shared/index.ts';

export const manifest = {
  name: 'erc20-holdings',
  version: '0.0.1',
  chainArch: 'evm',
  trackables: {
    token: {
      kind: 'position',
      quantityType: 'token_based',
      params: {
        contractAddress: evmAddress('The contract address to track'),
      },
    },
  },
} as const satisfies Manifest;
