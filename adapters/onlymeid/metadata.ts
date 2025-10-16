import { ABSINTHE_CORE_TEAM, ABSINTHE_CORE_TEAM_URL, ABSINTHE_ICON_URL } from '../_shared/index.ts';
import { AdapterMetadata } from '../_shared/index.ts';

export const metadata = {
  displayName: 'OnlyMeID',
  description: 'Track user verification actions on the OnlyMeID protocol.',
  category: 'identity',
  tags: ['identity', 'verification', 'onlymeid'],
  author: ABSINTHE_CORE_TEAM,
  authorUrl: ABSINTHE_CORE_TEAM_URL,
  authorIcon: ABSINTHE_ICON_URL,
  adapterIcon: '',
  status: 'beta',
  createdAt: '2025-10-16',
} as const satisfies AdapterMetadata;
