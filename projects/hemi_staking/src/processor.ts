import {
    BlockHeader,
    DataHandlerContext,
    EvmBatchProcessor,
    EvmBatchProcessorFields,
    Log as _Log,
    Transaction as _Transaction,
} from '@subsquid/evm-processor'
import * as hemiStakingAbi from './abi/launchPool'
import { validateEnv } from '@absinthe/common';

const env = validateEnv();
const contractAddresses = ["0x4f5e928763cbfaf5ffd8907ebbb0dabd5f78ba83"];
const earliestFromBlock = 1931100;

// Log RPC configuration for debugging
const rpcEndpoint = "https://rpc.hemi.network/rpc";
const blockRangeFrom = 1931791;
const blockRangeTo = 1931800;
const contractAddress = "0x4f5e928763cbfaf5ffd8907ebbb0dabd5f78ba83";
const monitoredEvents = [hemiStakingAbi.events.Deposit.topic, hemiStakingAbi.events.Withdraw.topic];

console.log('Processor configured with:', {
    rpcEndpoint,
    blockRange: { from: blockRangeFrom, to: blockRangeTo },
    contractAddress,
    monitoredEvents
});

export const processor = new EvmBatchProcessor()
    // .setGateway(env.gatewayUrl)
    // .setRpcEndpoint(env.rpcUrl)
    // .setBlockRange({
    //     from: earliestFromBlock,
    //     ...(env.toBlock ? { to: Number(env.toBlock) } : {})
    // })
    // .setFinalityConfirmation(75)
    // .addLog({
    //     address: contractAddresses,
    //     topic0: [hemiStakingAbi.events.Deposit.topic, hemiStakingAbi.events.Withdraw.topic],       
    // })
    // .setFields({
    //     log: {
    //         transactionHash: true,
    //         data: true,
    //     },
    //     transaction: {
    //         to: true,
    //         from: true,
    //     }
    // })
        .setRpcEndpoint(rpcEndpoint)
        .setBlockRange({
            from: blockRangeFrom,
            to: blockRangeTo
        })
        .setFinalityConfirmation(75)
        .addLog({
            address: [contractAddress],
            topic0: monitoredEvents,       
        })
        .setFields({
            log: {
                transactionHash: true,
                data: true,
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