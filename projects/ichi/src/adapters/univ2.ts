import Big from 'big.js';
import { Adapter } from '../types/adapter';
import { AssetFeedConfig } from '../types/pricing';
import * as univ2Abi from '../abi/univ2';

// Example function to create a Uniswap V2 adapter with LP token pricing
export function createUniv2Adapter(feedConfig: AssetFeedConfig): Adapter {
  return {
    onLog: async (block, log, emit) => {
      // Handle Transfer events (LP token transfers)
      if (log.topics[0] === univ2Abi.events.Transfer.topic) {
        const { from, to, value } = univ2Abi.events.Transfer.decode(log);
        if (from !== '0x0000000000000000000000000000000000000000') {
          await emit.balanceDelta({
            user: from,
            asset: log.address.toLowerCase(),
            amount: new Big(value.toString()).neg(),
          });
        }
        if (to !== '0x0000000000000000000000000000000000000000') {
          await emit.balanceDelta({
            user: to,
            asset: log.address.toLowerCase(),
            amount: new Big(value.toString()),
          });
        }
      }
      if (log.topics[0] === univ2Abi.events.Sync.topic) {
        // await emit.reprice();
      }
    },
    topic0s: [univ2Abi.events.Sync.topic, univ2Abi.events.Transfer.topic],
    feedConfig,
    // univ2nav feed is now officially registered in the pricing engine
  };
}
