// New registry imports
import { Manifest, evmAddress } from '../../src/types/manifest.ts';
import { metadata } from './metadata.ts';

import * as gbmAbi from './abi/main.ts';
import * as erc20Abi from './abi/erc20.ts';
// Handlers
// import { handleBid } from './bid.ts';
import { handleClaim } from './claim.ts';
import { AdapterDef, defineAdapter } from '../_shared/index.ts';

export const manifest: Manifest = {
  name: 'gbm-auctions-new-base',
  version: '0.0.1',
  chainArch: 'evm',
  trackables: {
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
    // Collect all pool addresses from both swap and lp configs into a single array
    // const poolAddrs = new Set([
    //   ...config.bid.map((bid) => bid.params.auctionContractAddress as string),
    // ]);

    const claimAddrs = new Set([
      ...config.claim.map((claim) => claim.params.auctionContractAddress as string),
    ]);

    // define topics
    const transferTopic = gbmAbi.events.AuctionBid_Placed.topic;
    const claimTopic = gbmAbi.events.Auction_Claimed.topic;

    return {
      buildSqdProcessor: (base) =>
        base.addLog({
          address: Array.from(claimAddrs),
          topic0: [transferTopic, claimTopic],
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
        // if (log.topic0 === transferTopic) {
        //   const bidInstances =
        //     config.bid?.filter((b) => b.params.auctionContractAddress === address) || [];

        //   for (const instance of bidInstances) {
        //     await handleBid(log, emitFns, instance, address);
        //   }
        // }

        // improvement - ask andrew if we can remove config.claim completely and we can just use the config.bid for parsing the claim topic because the addresses are the same
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
