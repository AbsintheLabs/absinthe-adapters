// New registry imports
import { Manifest, evmAddress } from '../../src/types/manifest.ts';
import { metadata } from './metadata.ts';

import * as aavegotchiAbi from './abi/aavegotchi.ts';
import * as gbmAbi from './abi/main.ts';
// Handlers
import { handleBid } from './bid.ts';
import { handleClaim } from './claim.ts';
import { AdapterDef, defineAdapter } from '../_shared/index.ts';

export const manifest: Manifest = {
  name: 'gbm-auctions-legacy',
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
};

export default defineAdapter({
  manifest,
  metadata,
  build: ({ config }) => {
    const addressToTrack = new Set([
      ...config.claim.map((claim) => claim.params.auctionContractAddress as string),
    ]);

    const transferTopic = gbmAbi.events.Auction_BidPlaced.topic;
    const claimedTopic = aavegotchiAbi.events.Auction_ItemClaimed.topic;

    return {
      buildSqdProcessor: (base) =>
        base
          .addLog({
            address: Array.from(addressToTrack[0]),
            topic0: [transferTopic],
          })
          .addLog({
            address: Array.from(addressToTrack[1]),
            topic0: [transferTopic, claimedTopic],
          }),
      onLog: async ({ log, emitFns, sqdRpcCtx, redis }) => {
        const address = log.address;

        // Handle Bid events
        if (log.topic0 === transferTopic) {
          const bidInstances =
            config.bid?.filter((b) => b.params.auctionContractAddress === address) || [];

          for (const instance of bidInstances) {
            await handleBid(log, emitFns, instance, address);
          }
        }

        if (log.topic0 === claimedTopic) {
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
