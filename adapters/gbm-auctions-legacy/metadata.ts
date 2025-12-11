import {
  ABSINTHE_CORE_TEAM,
  ABSINTHE_CORE_TEAM_URL,
  ABSINTHE_ICON_URL,
} from '../../src/types/absinthe-meta-constants.ts';
import { AdapterMetadata } from '../../src/types/manifest.ts';

// Metadata for the Uniswap V2 adapter
export const metadata = {
  displayName: 'GBM Auctions Legacy',
  description:
    'GBM Auctions Legacy is a decentralized auction protocol that allows users to bid on ERC20 tokens.',
  category: 'auctions',
  tags: ['gbm', 'auctions', 'legacy', 'evm'],
  author: ABSINTHE_CORE_TEAM,
  authorUrl: ABSINTHE_CORE_TEAM_URL,
  authorIcon: ABSINTHE_ICON_URL,
  adapterIcon:
    'https://raw.githubusercontent.com/0xa3k5/web3icons/refs/heads/main/raw-svgs/exchanges/branded/uniswap.svg',
  status: 'beta',
  compatibleWith: 'uniswap-v2',
  createdAt: '2025-10-11',
  trackables: {
    bid: {
      displayName: 'Bid',
      description: 'Track bids on GBM Auctions Legacy.',
    },
    claim: {
      displayName: 'Claim',
      description: 'Track claims on GBM Auctions Legacy.',
    },
  },
} as const satisfies AdapterMetadata;
