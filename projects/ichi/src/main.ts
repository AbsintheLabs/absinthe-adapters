// // ------------------------------------------------------------
// // Example adapter (the actual implementation steps)
// // ------------------------------------------------------------

// // todo: add helper to get the decimals dynamically from erc20 contracts (this can be a common util since the abi is shared for many erc20s)

// import { TwbEngine } from '@absinthe/common/src/services/TwbEngine';
// import * as hemiAbi from './abi/hemi';
// const sampleAdapter: TwbAdapter = {
//   onEvent: async (block, log, emit) => {
//     if (log.topics[0] === hemiAbi.events.Deposit.topic) {
//       const { depositor, token, amount } = hemiAbi.events.Deposit.decode(log);
//       emit.balanceDelta({
//         user: depositor,
//         asset: token,
//         amount: new Big(amount.toString()),
//       });
//     } else if (log.topics[0] === hemiAbi.events.Withdraw.topic) {
//       const { withdrawer, token, amount } = hemiAbi.events.Withdraw.decode(log);
//       emit.balanceDelta({
//         user: withdrawer,
//         asset: token,
//         amount: new Big(amount.toString()).neg(),
//       });
//     }
//   },
//   priceAsset: async (input, providers) => {
//     // todo: need to figure out how to abstract away the tokens from the intracacies of each pricing module

//     return 0;
//   },
// };

// // ------------------------------------------------------------
// // Final! Running the engine. This is just the driver.
// // Will probably load the config from the env anyway so it might even stay the same for all indexers.
// // ------------------------------------------------------------
// import { processor } from './processor';
// // todo: add a feature to not actually send data to the api to allow for testing
// // todo: what does testing and validation look like before actually hooking it up to the api?
// const engine = new TwbEngine(
//   { flushMs: 1000 * 60 * 60 * 48, enablePriceCache: false },
//   processor,
//   sampleAdapter,
//   env,
// );
// engine.run();
