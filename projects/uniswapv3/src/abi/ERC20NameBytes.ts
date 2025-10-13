import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const functions = {
    name: viewFun("0x06fdde03", "name()", {}, p.bytes32),
}

export class Contract extends ContractBase {

    name() {
        return this.eth_call(functions.name, {})
    }
}

/// Function types
export type NameParams = FunctionArguments<typeof functions.name>
export type NameReturn = FunctionReturn<typeof functions.name>

