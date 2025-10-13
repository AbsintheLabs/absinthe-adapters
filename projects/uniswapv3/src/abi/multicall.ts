import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const functions = {
    aggregate: fun("0x252dba42", "aggregate((address,bytes)[])", {"calls": p.array(p.struct({"target": p.address, "callData": p.bytes}))}, {"blockNumber": p.uint256, "returnData": p.array(p.bytes)}),
    blockAndAggregate: fun("0xc3077fa9", "blockAndAggregate((address,bytes)[])", {"calls": p.array(p.struct({"target": p.address, "callData": p.bytes}))}, {"blockNumber": p.uint256, "blockHash": p.bytes32, "returnData": p.array(p.struct({"success": p.bool, "returnData": p.bytes}))}),
    getBlockHash: viewFun("0xee82ac5e", "getBlockHash(uint256)", {"blockNumber": p.uint256}, p.bytes32),
    getBlockNumber: viewFun("0x42cbb15c", "getBlockNumber()", {}, p.uint256),
    getCurrentBlockCoinbase: viewFun("0xa8b0574e", "getCurrentBlockCoinbase()", {}, p.address),
    getCurrentBlockDifficulty: viewFun("0x72425d9d", "getCurrentBlockDifficulty()", {}, p.uint256),
    getCurrentBlockGasLimit: viewFun("0x86d516e8", "getCurrentBlockGasLimit()", {}, p.uint256),
    getCurrentBlockTimestamp: viewFun("0x0f28c97d", "getCurrentBlockTimestamp()", {}, p.uint256),
    getEthBalance: viewFun("0x4d2301cc", "getEthBalance(address)", {"addr": p.address}, p.uint256),
    getLastBlockHash: viewFun("0x27e86d6e", "getLastBlockHash()", {}, p.bytes32),
    tryAggregate: fun("0xbce38bd7", "tryAggregate(bool,(address,bytes)[])", {"requireSuccess": p.bool, "calls": p.array(p.struct({"target": p.address, "callData": p.bytes}))}, p.array(p.struct({"success": p.bool, "returnData": p.bytes}))),
    tryBlockAndAggregate: fun("0x399542e9", "tryBlockAndAggregate(bool,(address,bytes)[])", {"requireSuccess": p.bool, "calls": p.array(p.struct({"target": p.address, "callData": p.bytes}))}, {"blockNumber": p.uint256, "blockHash": p.bytes32, "returnData": p.array(p.struct({"success": p.bool, "returnData": p.bytes}))}),
}

export class Contract extends ContractBase {

    getBlockHash(blockNumber: GetBlockHashParams["blockNumber"]) {
        return this.eth_call(functions.getBlockHash, {blockNumber})
    }

    getBlockNumber() {
        return this.eth_call(functions.getBlockNumber, {})
    }

    getCurrentBlockCoinbase() {
        return this.eth_call(functions.getCurrentBlockCoinbase, {})
    }

    getCurrentBlockDifficulty() {
        return this.eth_call(functions.getCurrentBlockDifficulty, {})
    }

    getCurrentBlockGasLimit() {
        return this.eth_call(functions.getCurrentBlockGasLimit, {})
    }

    getCurrentBlockTimestamp() {
        return this.eth_call(functions.getCurrentBlockTimestamp, {})
    }

    getEthBalance(addr: GetEthBalanceParams["addr"]) {
        return this.eth_call(functions.getEthBalance, {addr})
    }

    getLastBlockHash() {
        return this.eth_call(functions.getLastBlockHash, {})
    }
}

/// Function types
export type AggregateParams = FunctionArguments<typeof functions.aggregate>
export type AggregateReturn = FunctionReturn<typeof functions.aggregate>

export type BlockAndAggregateParams = FunctionArguments<typeof functions.blockAndAggregate>
export type BlockAndAggregateReturn = FunctionReturn<typeof functions.blockAndAggregate>

export type GetBlockHashParams = FunctionArguments<typeof functions.getBlockHash>
export type GetBlockHashReturn = FunctionReturn<typeof functions.getBlockHash>

export type GetBlockNumberParams = FunctionArguments<typeof functions.getBlockNumber>
export type GetBlockNumberReturn = FunctionReturn<typeof functions.getBlockNumber>

export type GetCurrentBlockCoinbaseParams = FunctionArguments<typeof functions.getCurrentBlockCoinbase>
export type GetCurrentBlockCoinbaseReturn = FunctionReturn<typeof functions.getCurrentBlockCoinbase>

export type GetCurrentBlockDifficultyParams = FunctionArguments<typeof functions.getCurrentBlockDifficulty>
export type GetCurrentBlockDifficultyReturn = FunctionReturn<typeof functions.getCurrentBlockDifficulty>

export type GetCurrentBlockGasLimitParams = FunctionArguments<typeof functions.getCurrentBlockGasLimit>
export type GetCurrentBlockGasLimitReturn = FunctionReturn<typeof functions.getCurrentBlockGasLimit>

export type GetCurrentBlockTimestampParams = FunctionArguments<typeof functions.getCurrentBlockTimestamp>
export type GetCurrentBlockTimestampReturn = FunctionReturn<typeof functions.getCurrentBlockTimestamp>

export type GetEthBalanceParams = FunctionArguments<typeof functions.getEthBalance>
export type GetEthBalanceReturn = FunctionReturn<typeof functions.getEthBalance>

export type GetLastBlockHashParams = FunctionArguments<typeof functions.getLastBlockHash>
export type GetLastBlockHashReturn = FunctionReturn<typeof functions.getLastBlockHash>

export type TryAggregateParams = FunctionArguments<typeof functions.tryAggregate>
export type TryAggregateReturn = FunctionReturn<typeof functions.tryAggregate>

export type TryBlockAndAggregateParams = FunctionArguments<typeof functions.tryBlockAndAggregate>
export type TryBlockAndAggregateReturn = FunctionReturn<typeof functions.tryBlockAndAggregate>

