// https://github.com/subsquid-labs/showcase05-dex-pair-creation-and-swaps/blob/master/src/processor.ts

// import {
//     BlockHeader,
//     DataHandlerContext,
//     EvmBatchProcessor,
//     EvmBatchProcessorFields,
//     Log as _Log,
//     Transaction as _Transaction,
// } from '@subsquid/evm-processor'
// import * as factoryv2abi from './abi/factoryv2'
// import * as pairabi from './abi/pair'

// export const FACTORY_ADDRESSES = [
//     '0xbcfccbde45ce874adcb698cc183debcf17952812',
//     '0xca143ce32fe78f1f7019d7d551a6402fc5350c73',
// ]

// export const processor = new EvmBatchProcessor()
//     .setDataSource({
//         archive: 'https://v2.archive.subsquid.io/network/binance-mainnet',
//     })
//     .setBlockRange({ from: 586_851 })
//     .addLog({
//         address: FACTORY_ADDRESSES,
//         topic0: [factoryv2abi.events.PairCreated.topic],
//     })
//     .addLog({
//         topic0: [pairabi.events.Swap.topic],
//     })
//     .setFields({
//         log: {
//             transactionHash: true,
//         },
//     })

// export type Fields = EvmBatchProcessorFields<typeof processor>
// export type Block = BlockHeader<Fields>
// export type Log = _Log<Fields>
// export type Transaction = _Transaction<Fields>
// export type ProcessorContext<Store> = DataHandlerContext<Store, Fields>