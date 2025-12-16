import { ABSINTHE_CORE_TEAM, ABSINTHE_CORE_TEAM_URL, ABSINTHE_ICON_URL } from '../_shared/index.ts';
import { AdapterMetadata } from '../_shared/index.ts';

/**
 * METADATA
 *
 * Define your adapter's metadata for display and discovery.
 * This includes human-readable information about the adapter.
 */
export const metadata = {
  displayName: 'Printr Indexer',
  description:
    'Tracks Printr protocol events including token trades, curve creation, liquidity deployment, pool swaps, and ERC-20 holdings. Supports market cap threshold tracking for graduated tokens.',
  category: 'trading',
  tags: ['printr', 'bonding-curve', 'uniswap-v3', 'market-cap', 'telecoins'],
  author: ABSINTHE_CORE_TEAM,
  authorUrl: ABSINTHE_CORE_TEAM_URL,
  authorIcon: ABSINTHE_ICON_URL,
  adapterIcon: '',
  status: 'beta',
  createdAt: '2025-01-16',
  trackables: {
    tokenTrade: {
      displayName: 'Token Trade',
      description:
        'Tracks buy and sell events on the Printr bonding curve. Records trade amounts, costs, effective prices, and supply information.',
    },
    curveCreated: {
      displayName: 'Curve Created',
      description: 'Tracks when a new token curve is created on the Printr protocol.',
    },
    liquidityDeployed: {
      displayName: 'Liquidity Deployed',
      description:
        'Tracks when a token graduates from the bonding curve and liquidity is deployed to a Uniswap V3 pool.',
    },
    swap: {
      displayName: 'Pool Swap',
      description:
        'Tracks swap events in graduated token pools (Uniswap V3). Only tracks SELL swaps where tokens are sold back to the Printr contract.',
    },
    hold: {
      displayName: 'Token Holdings',
      description:
        'Tracks ERC-20 token balances for Printr tokens. Uses a generic Transfer listener to dynamically discover and track any configured token.',
    },
  },
} as const satisfies AdapterMetadata;
