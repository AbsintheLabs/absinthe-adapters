// New registry imports
import { Manifest, evmAddress } from '../../src/types/manifest.ts';
import { metadata } from './metadata.ts';

import * as gbmAbi from './abi/main.ts';
import * as aavegotchiAbi from './abi/aavegotchi.ts';

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
    // Collect all pool addresses from both swap and lp configs into a single array
    const poolAddrs = new Set([
      ...config.bid.map((bid) => bid.params.auctionContractAddress as string),
    ]);

    const claimAddrs = new Set([
      ...config.claim.map((claim) => claim.params.auctionContractAddress as string),
    ]);

    // define topics
    const transferTopic = gbmAbi.events.Auction_BidPlaced.topic;
    const transferAavegotchiTopic = aavegotchiAbi.events.Auction_BidPlaced.topic; //todo : check if needed
    const claimedTopic = aavegotchiAbi.events.Auction_ItemClaimed.topic;

    return {
      buildSqdProcessor: (base) =>
        base.addLog({
          address: Array.from(poolAddrs).concat(Array.from(claimAddrs)),
          topic0: [transferTopic, transferAavegotchiTopic, claimedTopic],
        }),
      onLog: async ({ log, emitFns, sqdRpcCtx, redis }) => {
        const address = log.address;
        // Cache token addresses for this pool
        // const token0Key = `univ2:${poolAddr}:token0`;
        // const token1Key = `univ2:${poolAddr}:token1`;
        // let tk0Addr = await redis.get(token0Key);
        // let tk1Addr = await redis.get(token1Key);

        // if (!tk0Addr || !tk1Addr) {
        //   try {
        //     const poolContract = new univ2Abi.Contract(sqdRpcCtx, poolAddr);
        //     tk0Addr = (await poolContract.token0()).toLowerCase();
        //     tk1Addr = (await poolContract.token1()).toLowerCase();
        //     await redis.set(token0Key, tk0Addr);
        //     await redis.set(token1Key, tk1Addr);
        //   } catch (error) {
        //     throw new Error(
        //       `Failed to fetch token addresses for pool ${poolAddr}: ${error instanceof Error ? error.message : String(error)}`,
        //     );
        //   }
        // }

        // Handle Bid events
        if (log.topic0 === transferTopic || log.topic0 === transferAavegotchiTopic) {
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
