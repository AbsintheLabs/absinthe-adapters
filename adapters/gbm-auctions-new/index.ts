// New registry imports
import { Manifest, evmAddress } from '../../src/types/manifest.ts';
import { metadata } from './metadata.ts';

import * as gbmAbi from './abi/main.ts';
import * as erc20Abi from './abi/erc20.ts';
// Handlers
import { handleBid } from './bid.ts';
import { handleClaim } from './claim.ts';
import { AdapterDef, defineAdapter } from '../_shared/index.ts';

export const manifest: Manifest = {
  name: 'gbm-auctions-new',
  version: '0.0.1',
  chainArch: 'evm',
  trackables: {
    bid: {
      kind: 'action',
      quantityType: 'token_based',
      params: {
        auctionContractAddress: evmAddress('The auction contract address to track'),
      },
      assetSelectors: {
        bidTokenAddress: evmAddress('The token being used for bidding'),
      },
    },
    claim: {
      kind: 'action',
      quantityType: 'none',
      params: {
        auctionContractAddress: evmAddress('The auction contract address to track'),
      },
    },
  },
} satisfies Manifest;

export default defineAdapter({
  manifest,
  metadata,
  build: ({ config }) => {
    const bidAddrs = new Set([
      ...config.bid.map((bid) => bid.params.auctionContractAddress as string),
    ]);

    const claimAddrs = new Set([
      ...config.claim.map((claim) => claim.params.auctionContractAddress as string),
    ]);

    const allAddrs = new Set([...bidAddrs, ...claimAddrs]);

    const bidTopic = gbmAbi.events.AuctionBid_Placed.topic;
    const claimTopic = gbmAbi.events.Auction_Claimed.topic;

    return {
      buildSqdProcessor: (base) =>
        base.addLog({
          address: Array.from(allAddrs),
          topic0: [bidTopic, claimTopic],
        }),
      onLog: async ({ log, emitFns, sqdRpcCtx, redis }) => {
        const address = log.address;

        // Handle Bid events
        if (log.topic0 === bidTopic) {
          const bidInstances =
            config.bid?.filter((b) => b.params.auctionContractAddress === address) || [];

          for (const instance of bidInstances) {
            await handleBid(log, emitFns, instance, address, sqdRpcCtx, redis);
          }
        }

        // Handle Claim events
        if (log.topic0 === claimTopic) {
          const claimInstances =
            config.claim?.filter((s) => s.params.auctionContractAddress === address) || [];

          for (const instance of claimInstances) {
            await handleClaim(log, emitFns, instance);
          }
        }
      },
    };
  },
});
