import { AdapterMetadata } from '../../src/types/manifest.ts';

// Metadata for the Uniswap V2 adapter
export const metadata = {
  displayName: 'Uniswap V2',
  description:
    'Uniswap V2 is a decentralized exchange protocol that allows users to swap ERC20 tokens.',
  tags: ['uniswap', 'v2', 'dex', 'amm', 'evm'],
} as const satisfies AdapterMetadata;
