// Example HEMI adapter implementation (commented out but kept for reference)

import Big from 'big.js';
import { Adapter } from '../types/adapter';
import { AssetFeedConfig } from '../types/pricing';
import * as hemiAbi from '../abi/hemi';

// todo: use builder pattern to only add the gateway, rpc, and logs. transaction should not be modified since we need the txhash

// pricing strategy could be different between twb and transaction events
// example univ2 lp is diff from volume pricing of swaps
// should this be two separate pricing strategies transactions / twb?
// or any for the 2 types of events: twb and transaction they both intake a pricing function? <-- this seems like the better option

export function createHemiAdapter(feedConfig: AssetFeedConfig): Adapter {
  return {
    onLog: async (block, log, emit) => {
      if (log.topics[0] === hemiAbi.events.Deposit.topic) {
        const { depositor, token, amount } = hemiAbi.events.Deposit.decode(log);
        // make sure to await!!
        await emit.balanceDelta({
          user: depositor,
          asset: token,
          amount: Big(amount.toString()),
          activity: 'deposit',
        });
      } else if (log.topics[0] === hemiAbi.events.Withdraw.topic) {
        const { withdrawer, token, amount } = hemiAbi.events.Withdraw.decode(log);
        // make sure to await!!
        await emit.balanceDelta({
          user: withdrawer,
          asset: token,
          amount: Big(amount.toString()).neg(),
          activity: 'withdraw',
        });
      }
    },
    feedConfig,
  };
}
