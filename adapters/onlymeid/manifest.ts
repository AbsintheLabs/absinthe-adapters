import { evmAddress, Manifest } from '../_shared/index.ts';

export const manifest = {
  name: 'onlymeid',
  version: '0.0.1',
  chainArch: 'evm',
  trackables: {
    verify: {
      kind: 'action',
      quantityType: 'none',
      params: {
        onlyMeIdAddress: evmAddress('The OnlyMeID contract address to track'),
      },
    },
  },
} as const satisfies Manifest;
