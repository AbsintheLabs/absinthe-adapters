// https://github.com/subsquid-labs/showcase05-dex-pair-creation-and-swaps/blob/master/src/processor.ts

import {
    BlockHeader,
    DataHandlerContext,
    EvmBatchProcessor,
    EvmBatchProcessorFields,
    Log as _Log,
    Transaction as _Transaction,
} from '@subsquid/evm-processor'
import * as univ2Abi from './abi/univ2'
import { validateEnv } from '@absinthe/common';

const env = validateEnv();

export const processor = new EvmBatchProcessor()
    .setGateway(process.env.GATEWAY_URL!)
    .setRpcEndpoint(process.env.RPC_URL!)
    .setBlockRange({
        from: Number(env.pools[0].fromBlock),
        ...(process.env.TO_BLOCK ? { to: Number(process.env.TO_BLOCK) } : {})
    })
    .setFinalityConfirmation(75)
    .addLog({
        address: [env.pools[0].contractAddress],
        topic0: [univ2Abi.events.Transfer.topic, univ2Abi.events.Sync.topic, univ2Abi.events.Swap.topic],
    })
    .setFields({
        log: {
            transactionHash: true,
        },
        transaction: {
            to: true,
            from: true,

        }
    })

export type Fields = EvmBatchProcessorFields<typeof processor>
export type Block = BlockHeader<Fields>
export type Log = _Log<Fields>
export type Transaction = _Transaction<Fields>
export type ProcessorContext<Store> = DataHandlerContext<Store, Fields>