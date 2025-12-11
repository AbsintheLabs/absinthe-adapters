import { ABSINTHE_CORE_TEAM, ABSINTHE_CORE_TEAM_URL, ABSINTHE_ICON_URL } from '../_shared/index.ts';
import { AdapterMetadata } from '../_shared/index.ts';

/**
 * METADATA
 *
 * Define your adapter's metadata for display and discovery.
 * This includes human-readable information about the adapter.
 */
export const metadata = {
  displayName: 'ERC20 Holdings',
  description: 'Tracks the holdings of an ERC20 token.',
  category: 'tokens',
  tags: ['erc20', 'holdings'], // Searchable tags
  author: ABSINTHE_CORE_TEAM,
  authorUrl: ABSINTHE_CORE_TEAM_URL,
  authorIcon: ABSINTHE_ICON_URL, // or URL to your icon
  adapterIcon: '',
  status: 'beta', // 'stable', 'beta', or 'deprecated'
  createdAt: '2025-10-07',
  // Human-readable descriptions for each trackable (must match trackable IDs in manifest)
  trackables: {
    token: {
      displayName: 'Token Balance',
      description:
        'Track wallet balances for an ERC20 token contract. Monitors transfers to and from wallets, providing real-time balance updates.',
    },
  },
} as const satisfies AdapterMetadata;
