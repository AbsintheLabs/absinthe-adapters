import { ABSINTHE_CORE_TEAM, ABSINTHE_CORE_TEAM_URL, ABSINTHE_ICON_URL } from '../_shared/index.ts';
import { AdapterMetadata } from '../_shared/index.ts';

/**
 * METADATA
 *
 * Define your adapter's metadata for display and discovery.
 * This includes human-readable information about the adapter.
 */
export const metadata = {
  displayName: 'Protocol Name',
  description: 'Brief description of what this protocol does and what this adapter tracks.',
  category: 'trading', // or 'lending', 'staking', 'gaming', etc.
  tags: ['protocol', 'category', 'keywords'], // Searchable tags
  author: ABSINTHE_CORE_TEAM, // or 'Your Name'
  authorUrl: ABSINTHE_CORE_TEAM_URL, // or 'https://yourwebsite.com'
  authorIcon: ABSINTHE_ICON_URL, // or URL to your icon
  adapterIcon: '', // URL to protocol icon/logo
  status: 'beta', // 'stable', 'beta', or 'deprecated'
  // compatibleWith: 'protocol-name', // If this extends another adapter
  createdAt: '2025-10-07',
} as const satisfies AdapterMetadata;
