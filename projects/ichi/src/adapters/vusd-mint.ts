// ICHI protocol adapter implementation

import Big from 'big.js';
import { Adapter } from '../types/adapter';
import { AssetFeedConfig } from '../types/pricing';
import * as vusdMintAbi from '../abi/mint';

export function createVusdMintAdapter(feedConfig: AssetFeedConfig): Adapter {
  return {
    onLog: async (block, log, emit) => {
      if (log.topics[0] === vusdMintAbi.events.Mint.topic) {
        const { tokenIn, amountIn, amountInAfterTransferFee, mintage, receiver } =
          vusdMintAbi.events.Mint.decode(log);
        await emit.event({
          amount: new Big(mintage.toString()),
          asset: '0x677ddbd918637E5F2c79e164D402454dE7dA8619'.toLowerCase(),
          user: receiver,
          meta: {
            tokenIn: tokenIn.toLowerCase(),
            amountIn: amountIn.toString(),
            amountInAfterTransferFee: amountInAfterTransferFee.toString(),
            mintage: mintage.toString(),
          },
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
