import { defineFeedHandler } from '../types/asset.ts';
import { z } from 'zod';

/**
 * Pegged Price Feed Handler
 *
 * Returns a fixed USD price for stablecoins or other pegged assets
 * Accepts: Any asset type
 * Requires: Fixed USD peg value in config
 */
export const peggedFeed = defineFeedHandler({
  name: 'pegged',
  acceptsAssetType: 'erc20',
  configSchema: z.object({
    usdPegValue: z.number().describe('Fixed USD price (e.g., 1 for USDC/USDT)'),
  }),
  handler: async ({ config }) => {
    return config.usdPegValue;
  },
});
