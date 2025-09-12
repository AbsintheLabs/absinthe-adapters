import Big from 'big.js';
import { Adapter } from '../types/adapter';
import { AssetFeedConfig } from '../types/pricing';
import * as univ2Abi from '../abi/univ2';
import { EVM_NULL_ADDRESS } from '../utils/conts';

// Example function to create a Uniswap V2 adapter with LP token pricing
export function createUniv2Adapter(feedConfig: AssetFeedConfig): Adapter {
  return {
    onLog: async (block, log, emit) => {
      // Handle Transfer events (LP token transfers)
      if (log.topics[0] === univ2Abi.events.Transfer.topic) {
        const { from, to, value } = univ2Abi.events.Transfer.decode(log);
        if (from !== EVM_NULL_ADDRESS) {
          await emit.balanceDelta({
            user: from,
            asset: log.address,
            amount: new Big(value.toString()).neg(),
            activity: 'hold',
          });
        }
        if (to !== EVM_NULL_ADDRESS) {
          await emit.balanceDelta({
            user: to,
            asset: log.address,
            amount: new Big(value.toString()),
            activity: 'hold',
          });
        }
      }
      if (log.topics[0] === univ2Abi.events.Sync.topic) {
        // await emit.reprice();
      }
    },
    feedConfig,
    // univ2nav feed is now officially registered in the pricing engine
  };
}
