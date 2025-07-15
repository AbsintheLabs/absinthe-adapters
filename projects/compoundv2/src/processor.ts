// // https://github.com/subsquid-labs/showcase05-dex-pair-creation-and-swaps/blob/master/src/processor.ts

// import {
//   BlockHeader,
//   DataHandlerContext,
//   EvmBatchProcessor,
//   EvmBatchProcessorFields,
//   Log as _Log,
//   Transaction as _Transaction,
// } from '@subsquid/evm-processor';
// import { validateEnv } from '@absinthe/common';
// import * as compoundv2Abi from './abi/compoundv2';

// const env = validateEnv();
// const contractAddress = env.protocols
//   .filter((protocol) => protocol.type === 'compound')
//   .map((protocol) => protocol.contractAddress);
// const earliestFromBlock = Math.min(
//   ...env.protocols
//     .filter((protocol) => protocol.type === 'compound')
//     .map((protocol) => protocol.fromBlock),
// );
// export const processor = new EvmBatchProcessor()
//   .setGateway(env.gatewayUrl)
//   .setRpcEndpoint(env.rpcUrl)
//   .setBlockRange({
//     from: earliestFromBlock,
//     ...(env.toBlock ? { to: Number(env.toBlock) } : {}),
//   })
//   .setFinalityConfirmation(75)
//   .addLog({
//     address: contractAddress,
//     topic0: [compoundv2Abi.events.Transfer.topic],
//   })
//   .setFields({
//     log: {
//       transactionHash: true,
//     },
//     transaction: {
//       to: true,
//       from: true,
//     },
//   });

// export type Fields = EvmBatchProcessorFields<typeof processor>;
// export type Block = BlockHeader<Fields>;
// export type Log = _Log<Fields>;
// export type Transaction = _Transaction<Fields>;
// export type ProcessorContext<Store> = DataHandlerContext<Store, Fields>;
