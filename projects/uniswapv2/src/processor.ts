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
const contractAddresses = env.protocols.filter(protocol => protocol.type === 'uniswap-v2').map(protocol => protocol.contractAddress);
const earliestFromBlock = Math.min(...env.protocols.filter(protocol => protocol.type === 'uniswap-v2').map(protocol => protocol.fromBlock));
export const processor = new EvmBatchProcessor()
    .setGateway(env.gatewayUrl)
    .setRpcEndpoint(env.rpcUrl)
    .setBlockRange({
        from: earliestFromBlock,
        ...(env.toBlock ? { to: Number(env.toBlock) } : {})
    })
    .setFinalityConfirmation(75)
    .addLog({
        address: contractAddresses,
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