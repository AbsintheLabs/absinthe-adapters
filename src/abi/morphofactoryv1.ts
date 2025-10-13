import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    CreateMetaMorpho: event("0xed8c95d05909b0f217f3e68171ef917df4b278d5addfe4dda888e90279be7d1d", "CreateMetaMorpho(address,address,address,uint256,address,string,string,bytes32)", {"metaMorpho": indexed(p.address), "caller": indexed(p.address), "initialOwner": p.address, "initialTimelock": p.uint256, "asset": indexed(p.address), "name": p.string, "symbol": p.string, "salt": p.bytes32}),
}

export const functions = {
    MORPHO: viewFun("0x3acb5624", "MORPHO()", {}, p.address),
    createMetaMorpho: fun("0xb5102025", "createMetaMorpho(address,uint256,address,string,string,bytes32)", {"initialOwner": p.address, "initialTimelock": p.uint256, "asset": p.address, "name": p.string, "symbol": p.string, "salt": p.bytes32}, p.address),
    isMetaMorpho: viewFun("0x29b5352c", "isMetaMorpho(address)", {"_0": p.address}, p.bool),
}

export class Contract extends ContractBase {

    MORPHO() {
        return this.eth_call(functions.MORPHO, {})
    }

    isMetaMorpho(_0: IsMetaMorphoParams["_0"]) {
        return this.eth_call(functions.isMetaMorpho, {_0})
    }
}

/// Event types
export type CreateMetaMorphoEventArgs = EParams<typeof events.CreateMetaMorpho>

/// Function types
export type MORPHOParams = FunctionArguments<typeof functions.MORPHO>
export type MORPHOReturn = FunctionReturn<typeof functions.MORPHO>

export type CreateMetaMorphoParams = FunctionArguments<typeof functions.createMetaMorpho>
export type CreateMetaMorphoReturn = FunctionReturn<typeof functions.createMetaMorpho>

export type IsMetaMorphoParams = FunctionArguments<typeof functions.isMetaMorpho>
export type IsMetaMorphoReturn = FunctionReturn<typeof functions.isMetaMorpho>

