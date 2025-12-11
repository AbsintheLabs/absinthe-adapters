import {
  ABSINTHE_CORE_TEAM,
  ABSINTHE_CORE_TEAM_URL,
  ABSINTHE_ICON_URL,
} from '../../src/types/absinthe-meta-constants.ts';
import { AdapterMetadata } from '../../src/types/manifest.ts';

// Metadata for the Uniswap V3 adapter
export const metadata = {
  displayName: 'Uniswap V3',
  description:
    'Uniswap V3 is a decentralized exchange protocol with concentrated liquidity and multiple fee tiers. Track swaps and liquidity positions.',
  category: 'trading',
  tags: ['uniswap', 'v3', 'dex', 'amm', 'evm', 'concentrated-liquidity'],
  author: ABSINTHE_CORE_TEAM,
  authorUrl: ABSINTHE_CORE_TEAM_URL,
  authorIcon: ABSINTHE_ICON_URL,
  adapterIcon:
    'https://raw.githubusercontent.com/0xa3k5/web3icons/refs/heads/main/raw-svgs/exchanges/branded/uniswap.svg',
  status: 'beta',
  compatibleWith: 'uniswap-v3',
  createdAt: '2025-10-11',
  // Human-readable descriptions for each trackable (must match trackable IDs in manifest)
  trackables: {
    swap: {
      displayName: 'Swap',
      description:
        'Track token swaps on Uniswap V3 pools. Each swap event captures the trade between token0 and token1, including the amount swapped and price impact.',
    },
    lp: {
      displayName: 'Liquidity Position',
      description:
        'Track NFT-based concentrated liquidity positions. Captures mints, burns, increases, decreases, and transfers of liquidity positions with specific price ranges.',
    },
  },
} as const satisfies AdapterMetadata;
