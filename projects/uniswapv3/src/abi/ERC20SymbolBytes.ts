import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const functions = {
    symbol: viewFun("0x95d89b41", "symbol()", {}, p.bytes32),
}

export class Contract extends ContractBase {

    symbol() {
        return this.eth_call(functions.symbol, {})
    }
}

/// Function types
export type SymbolParams = FunctionArguments<typeof functions.symbol>
export type SymbolReturn = FunctionReturn<typeof functions.symbol>

