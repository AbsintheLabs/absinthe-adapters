// https://github.com/subsquid-labs/showcase05-dex-pair-creation-and-swaps/blob/master/src/processor.ts

import {
    BlockHeader,
    DataHandlerContext,
    EvmBatchProcessor,
    EvmBatchProcessorFields,
    Log as _Log,
    Transaction as _Transaction,
} from '@subsquid/evm-processor'
import * as velodromeAbi from './abi/velodrome'

const contractAddress = process.env.CONTRACT_ADDRESS!.toLowerCase()

export const processor = new EvmBatchProcessor()
    .setGateway(process.env.GATEWAY_URL!)
    .setRpcEndpoint(process.env.RPC_URL!)
    .setBlockRange({
        from: Number(process.env.FROM_BLOCK!),
        ...(process.env.TO_BLOCK ? { to: Number(process.env.TO_BLOCK) } : {})
    })
    .setFinalityConfirmation(75)
    .addLog({
        address: [contractAddress],
        topic0: [velodromeAbi.events.Transfer.topic, velodromeAbi.events.Sync.topic],
    })
    .setFields({
        log: {
            transactionHash: true,
        },
    })

export type Fields = EvmBatchProcessorFields<typeof processor>
export type Block = BlockHeader<Fields>
export type Log = _Log<Fields>
export type Transaction = _Transaction<Fields>
export type ProcessorContext<Store> = DataHandlerContext<Store, Fields>