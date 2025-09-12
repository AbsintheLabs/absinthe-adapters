// ICHI protocol adapter implementation

import Big from 'big.js';
import { Adapter } from '../types/adapter';
import { AssetFeedConfig } from '../types/pricing';
import * as ichiAbi from '../abi/ichi';

export function createIchiAdapter(feedConfig: AssetFeedConfig): Adapter {
  return {
    onLog: async (block, log, emit) => {
      if (log.topics[0] === ichiAbi.events.Transfer.topic) {
        const { from, to, value } = ichiAbi.events.Transfer.decode(log);
        // await emit.event({
        //   amount: new Big(value.toString()),
        //   asset: log.address,
        //   user: from,
        //   // random metadata for testing
        //   // meta: {
        //   //   to: to,
        //   //   blockNumber: block.header.height,
        //   //   // randomNum: Math.floor(Math.random() * 100)
        //   // },
        // });
        await emit.balanceDelta({
          user: from,
          asset: log.address,
          amount: new Big(value.toString()).neg(),
          activity: 'hold',
        });
        await emit.balanceDelta({
          user: to,
          asset: log.address,
          amount: new Big(value.toString()),
          activity: 'hold',
        });
      }
    },
    // onTransaction: async (block, transaction, emit) => {
    //   // Track transactions with gas fees similar to BatchProcessor pattern
    //   const { input, from, to, gasPrice, gasUsed } = transaction;

    //   if (input?.startsWith(demosAbi.functions.userVerify.sighash)) {
    //     // Track all successful transactions for gas fee analysis
    //     await emit.event({
    //       // can be empty and the engine will fill in the rest!
    //       // amount: new Big(gasFee.toString()),
    //       // meta: {
    //       //   to: to,
    //       //   gasPrice: gasPrice.toString(),
    //       //   gasUsed: gasUsed.toString(),
    //       //   displayGasFee: displayGasFee,
    //       //   blockNumber: block.header.height,
    //       //   input: input ? input.slice(0, 10) : null, // first 4 bytes of function selector
    //       // },
    //     });
    //   }
    // },
    feedConfig,
  };
}
