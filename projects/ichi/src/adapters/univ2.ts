// Uniswap V2 protocol adapter implementation

import Big from 'big.js';
import { Adapter } from '../types/adapter';
import { AssetFeedConfig } from '../types/pricing';
import * as univ2Abi from '../abi/univ2';

export function createUniv2Adapter(feedConfig: AssetFeedConfig): Adapter {
  return {
    // fixme: add typing on block, log
    onLog: async (block, log, emit) => {
      // Handle Transfer events (LP token transfers)
      if (log.topics[0] === univ2Abi.events.Transfer.topic) {
        const { from, to, value } = univ2Abi.events.Transfer.decode(log);
        if (from !== '0x0000000000000000000000000000000000000000') {
          await emit.balanceDelta({
            user: from,
            asset: log.address,
            amount: new Big(value.toString()).neg(),
          });
        }
        if (to !== '0x0000000000000000000000000000000000000000') {
          await emit.balanceDelta({
            user: to,
            asset: log.address,
            amount: new Big(value.toString()),
          });
        }
      }
      if (log.topics[0] === univ2Abi.events.Sync.topic) {
        // await emit.reprice();
      }
    },

    //     // Handle LP token transfers (excluding mints and burns)
    //     if (from !== '0x0000000000000000000000000000000000000000' &&
    //         to !== '0x0000000000000000000000000000000000000000') {
    //         // Regular transfer: deduct from sender, add to receiver
    //         await emit.balanceDelta({
    //             user: from,
    //             asset: log.address, // LP token address
    //             amount: new Big(value.toString()).neg(),
    //         });
    //         await emit.balanceDelta({
    //             user: to,
    //             asset: log.address, // LP token address
    //             amount: new Big(value.toString()),
    //         });
    //     }
    //     // Mint operation (liquidity added)
    //     else if (from === '0x0000000000000000000000000000000000000000') {
    //         await emit.balanceDelta({
    //             user: to,
    //             asset: log.address, // LP token address
    //             amount: new Big(value.toString()),
    //         });
    //     }
    //     // Burn operation (liquidity removed)
    //     else if (to === '0x0000000000000000000000000000000000000000') {
    //         await emit.balanceDelta({
    //             user: from,
    //             asset: log.address, // LP token address
    //             amount: new Big(value.toString()).neg(),
    //         });
    //     }
    // }
    topic0s: [univ2Abi.events.Sync.topic, univ2Abi.events.Transfer.topic],

    feedConfig,
  };
}
