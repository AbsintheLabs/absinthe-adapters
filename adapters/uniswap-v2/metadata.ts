import {
  ABSINTHE_CORE_TEAM,
  ABSINTHE_CORE_TEAM_URL,
  ABSINTHE_ICON_URL,
} from '../../src/types/absinthe-meta-constants.ts';
import { AdapterMetadata } from '../../src/types/manifest.ts';

// Metadata for the Uniswap V2 adapter
export const metadata = {
  displayName: 'Uniswap V2',
  description:
    'Uniswap V2 is a decentralized exchange protocol that allows users to swap ERC20 tokens.',
  category: 'trading',
  tags: ['uniswap', 'v2', 'dex', 'amm', 'evm'],
  author: ABSINTHE_CORE_TEAM,
  authorUrl: ABSINTHE_CORE_TEAM_URL,
  authorIcon: ABSINTHE_ICON_URL,
  adapterIcon:
    'https://raw.githubusercontent.com/0xa3k5/web3icons/refs/heads/main/raw-svgs/exchanges/branded/uniswap.svg',
  status: 'beta',
  compatibleWith: 'uniswap-v2',
  createdAt: '2025-10-02',
  trackables: {
    swap: {
      displayName: 'Swap',
      description: 'Track swaps on Uniswap V2.',
    },
    lp: {
      displayName: 'Liquidity Position',
      description: 'Track liquidity positions on Uniswap V2.',
    },
  },
} as const satisfies AdapterMetadata;
