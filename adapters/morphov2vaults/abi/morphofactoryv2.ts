import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    CreateVaultV2: event("0x341ce009267aa0d78cc12b34155e223904a51ed49d144beb6eb8be87813edb4e", "CreateVaultV2(address,address,bytes32,address)", {"owner": indexed(p.address), "asset": indexed(p.address), "salt": p.bytes32, "newVaultV2": indexed(p.address)}),
}

export const functions = {
    createVaultV2: fun("0xa7a28469", "createVaultV2(address,address,bytes32)", {"owner": p.address, "asset": p.address, "salt": p.bytes32}, p.address),
    isVaultV2: viewFun("0x5edec50d", "isVaultV2(address)", {"account": p.address}, p.bool),
    vaultV2: viewFun("0x8d8b08a8", "vaultV2(address,address,bytes32)", {"owner": p.address, "asset": p.address, "salt": p.bytes32}, p.address),
}

export class Contract extends ContractBase {

    isVaultV2(account: IsVaultV2Params["account"]) {
        return this.eth_call(functions.isVaultV2, {account})
    }

    vaultV2(owner: VaultV2Params["owner"], asset: VaultV2Params["asset"], salt: VaultV2Params["salt"]) {
        return this.eth_call(functions.vaultV2, {owner, asset, salt})
    }
}

/// Event types
export type CreateVaultV2EventArgs = EParams<typeof events.CreateVaultV2>

/// Function types
export type CreateVaultV2Params = FunctionArguments<typeof functions.createVaultV2>
export type CreateVaultV2Return = FunctionReturn<typeof functions.createVaultV2>

export type IsVaultV2Params = FunctionArguments<typeof functions.isVaultV2>
export type IsVaultV2Return = FunctionReturn<typeof functions.isVaultV2>

export type VaultV2Params = FunctionArguments<typeof functions.vaultV2>
export type VaultV2Return = FunctionReturn<typeof functions.vaultV2>

