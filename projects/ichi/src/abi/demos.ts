import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    Approval: event("0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925", "Approval(address,address,uint256)", {"owner": indexed(p.address), "spender": indexed(p.address), "value": p.uint256}),
    Initialized: event("0xc7f505b2f371ae2175ee4913f4499e1f2633a7b5936321eed1cdaeb6115181d2", "Initialized(uint64)", {"version": p.uint64}),
    OwnershipTransferred: event("0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0", "OwnershipTransferred(address,address)", {"previousOwner": indexed(p.address), "newOwner": indexed(p.address)}),
    Transfer: event("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "Transfer(address,address,uint256)", {"from": indexed(p.address), "to": indexed(p.address), "value": p.uint256}),
    Upgraded: event("0xbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b", "Upgraded(address)", {"implementation": indexed(p.address)}),
}

export const functions = {
    UPGRADE_INTERFACE_VERSION: viewFun("0xad3cb1cc", "UPGRADE_INTERFACE_VERSION()", {}, p.string),
    adminBurn: fun("0x2e46e59c", "adminBurn(address[])", {"_users": p.array(p.address)}, ),
    adminMint: fun("0x21cbb5bd", "adminMint(address[])", {"_users": p.array(p.address)}, ),
    allowance: viewFun("0xdd62ed3e", "allowance(address,address)", {"owner": p.address, "spender": p.address}, p.uint256),
    approve: fun("0x095ea7b3", "approve(address,uint256)", {"spender": p.address, "value": p.uint256}, p.bool),
    balanceOf: viewFun("0x70a08231", "balanceOf(address)", {"account": p.address}, p.uint256),
    burnTime: viewFun("0xa999f390", "burnTime(address)", {"_0": p.address}, p.uint256),
    decimals: viewFun("0x313ce567", "decimals()", {}, p.uint8),
    initialize: fun("0x485cc955", "initialize(address,address)", {"initialOwner": p.address, "_proofSigner": p.address}, ),
    isTokenBurned: viewFun("0x95a23646", "isTokenBurned(address)", {"user": p.address}, p.bool),
    lastVerified: viewFun("0xad4cc33b", "lastVerified(address)", {"_0": p.address}, p.uint256),
    minEnrollTime: viewFun("0x7c7a2d04", "minEnrollTime()", {}, p.uint256),
    mintPrice: viewFun("0x6817c76c", "mintPrice()", {}, p.uint256),
    mintTime: viewFun("0xb3cdb0dd", "mintTime(address)", {"_0": p.address}, p.uint256),
    name: viewFun("0x06fdde03", "name()", {}, p.string),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    proofSigner: viewFun("0x564490c4", "proofSigner()", {}, p.address),
    proxiableUUID: viewFun("0x52d1902d", "proxiableUUID()", {}, p.bytes32),
    renounceOwnership: fun("0x715018a6", "renounceOwnership()", {}, ),
    setMinEnrollment: fun("0xcae6b116", "setMinEnrollment(uint256)", {"enrollment": p.uint256}, ),
    setMintPrice: fun("0xf4a0a528", "setMintPrice(uint256)", {"newPrice": p.uint256}, ),
    setSignatureValidity: fun("0xd9a23a6d", "setSignatureValidity(uint256)", {"_signatureValidity": p.uint256}, ),
    setVerifyPrice: fun("0xdc106c19", "setVerifyPrice(uint256)", {"newPrice": p.uint256}, ),
    signatureValidity: viewFun("0x64e4b8c2", "signatureValidity()", {}, p.uint256),
    symbol: viewFun("0x95d89b41", "symbol()", {}, p.string),
    totalSupply: viewFun("0x18160ddd", "totalSupply()", {}, p.uint256),
    transfer: fun("0xa9059cbb", "transfer(address,uint256)", {"to": p.address, "value": p.uint256}, p.bool),
    transferFrom: fun("0x23b872dd", "transferFrom(address,address,uint256)", {"from": p.address, "to": p.address, "value": p.uint256}, p.bool),
    transferOwnership: fun("0xf2fde38b", "transferOwnership(address)", {"newOwner": p.address}, ),
    updateSigner: fun("0xa7ecd37e", "updateSigner(address)", {"_proofSigner": p.address}, ),
    upgradeToAndCall: fun("0x4f1ef286", "upgradeToAndCall(address,bytes)", {"newImplementation": p.address, "data": p.bytes}, ),
    userBurn: fun("0x20a462d2", "userBurn()", {}, ),
    userFreeMint: fun("0x9c767fed", "userFreeMint(uint256,bytes)", {"signatureTimestamp": p.uint256, "mintProof": p.bytes}, ),
    userMint: fun("0xfee3d2d1", "userMint(uint256,bytes)", {"signatureTimestamp": p.uint256, "mintProof": p.bytes}, ),
    userVerify: fun("0xa4760a9e", "userVerify(uint256,bytes)", {"signatureTimestamp": p.uint256, "verifyProof": p.bytes}, ),
    verifyMessage: viewFun("0xf962a22a", "verifyMessage(string,bytes)", {"message": p.string, "signature": p.bytes}, p.address),
    verifyPrice: viewFun("0xea526759", "verifyPrice()", {}, p.uint256),
    withdraw: fun("0x51cff8d9", "withdraw(address)", {"recipient": p.address}, ),
}

export class Contract extends ContractBase {

    UPGRADE_INTERFACE_VERSION() {
        return this.eth_call(functions.UPGRADE_INTERFACE_VERSION, {})
    }

    allowance(owner: AllowanceParams["owner"], spender: AllowanceParams["spender"]) {
        return this.eth_call(functions.allowance, {owner, spender})
    }

    balanceOf(account: BalanceOfParams["account"]) {
        return this.eth_call(functions.balanceOf, {account})
    }

    burnTime(_0: BurnTimeParams["_0"]) {
        return this.eth_call(functions.burnTime, {_0})
    }

    decimals() {
        return this.eth_call(functions.decimals, {})
    }

    isTokenBurned(user: IsTokenBurnedParams["user"]) {
        return this.eth_call(functions.isTokenBurned, {user})
    }

    lastVerified(_0: LastVerifiedParams["_0"]) {
        return this.eth_call(functions.lastVerified, {_0})
    }

    minEnrollTime() {
        return this.eth_call(functions.minEnrollTime, {})
    }

    mintPrice() {
        return this.eth_call(functions.mintPrice, {})
    }

    mintTime(_0: MintTimeParams["_0"]) {
        return this.eth_call(functions.mintTime, {_0})
    }

    name() {
        return this.eth_call(functions.name, {})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    proofSigner() {
        return this.eth_call(functions.proofSigner, {})
    }

    proxiableUUID() {
        return this.eth_call(functions.proxiableUUID, {})
    }

    signatureValidity() {
        return this.eth_call(functions.signatureValidity, {})
    }

    symbol() {
        return this.eth_call(functions.symbol, {})
    }

    totalSupply() {
        return this.eth_call(functions.totalSupply, {})
    }

    verifyMessage(message: VerifyMessageParams["message"], signature: VerifyMessageParams["signature"]) {
        return this.eth_call(functions.verifyMessage, {message, signature})
    }

    verifyPrice() {
        return this.eth_call(functions.verifyPrice, {})
    }
}

/// Event types
export type ApprovalEventArgs = EParams<typeof events.Approval>
export type InitializedEventArgs = EParams<typeof events.Initialized>
export type OwnershipTransferredEventArgs = EParams<typeof events.OwnershipTransferred>
export type TransferEventArgs = EParams<typeof events.Transfer>
export type UpgradedEventArgs = EParams<typeof events.Upgraded>

/// Function types
export type UPGRADE_INTERFACE_VERSIONParams = FunctionArguments<typeof functions.UPGRADE_INTERFACE_VERSION>
export type UPGRADE_INTERFACE_VERSIONReturn = FunctionReturn<typeof functions.UPGRADE_INTERFACE_VERSION>

export type AdminBurnParams = FunctionArguments<typeof functions.adminBurn>
export type AdminBurnReturn = FunctionReturn<typeof functions.adminBurn>

export type AdminMintParams = FunctionArguments<typeof functions.adminMint>
export type AdminMintReturn = FunctionReturn<typeof functions.adminMint>

export type AllowanceParams = FunctionArguments<typeof functions.allowance>
export type AllowanceReturn = FunctionReturn<typeof functions.allowance>

export type ApproveParams = FunctionArguments<typeof functions.approve>
export type ApproveReturn = FunctionReturn<typeof functions.approve>

export type BalanceOfParams = FunctionArguments<typeof functions.balanceOf>
export type BalanceOfReturn = FunctionReturn<typeof functions.balanceOf>

export type BurnTimeParams = FunctionArguments<typeof functions.burnTime>
export type BurnTimeReturn = FunctionReturn<typeof functions.burnTime>

export type DecimalsParams = FunctionArguments<typeof functions.decimals>
export type DecimalsReturn = FunctionReturn<typeof functions.decimals>

export type InitializeParams = FunctionArguments<typeof functions.initialize>
export type InitializeReturn = FunctionReturn<typeof functions.initialize>

export type IsTokenBurnedParams = FunctionArguments<typeof functions.isTokenBurned>
export type IsTokenBurnedReturn = FunctionReturn<typeof functions.isTokenBurned>

export type LastVerifiedParams = FunctionArguments<typeof functions.lastVerified>
export type LastVerifiedReturn = FunctionReturn<typeof functions.lastVerified>

export type MinEnrollTimeParams = FunctionArguments<typeof functions.minEnrollTime>
export type MinEnrollTimeReturn = FunctionReturn<typeof functions.minEnrollTime>

export type MintPriceParams = FunctionArguments<typeof functions.mintPrice>
export type MintPriceReturn = FunctionReturn<typeof functions.mintPrice>

export type MintTimeParams = FunctionArguments<typeof functions.mintTime>
export type MintTimeReturn = FunctionReturn<typeof functions.mintTime>

export type NameParams = FunctionArguments<typeof functions.name>
export type NameReturn = FunctionReturn<typeof functions.name>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type ProofSignerParams = FunctionArguments<typeof functions.proofSigner>
export type ProofSignerReturn = FunctionReturn<typeof functions.proofSigner>

export type ProxiableUUIDParams = FunctionArguments<typeof functions.proxiableUUID>
export type ProxiableUUIDReturn = FunctionReturn<typeof functions.proxiableUUID>

export type RenounceOwnershipParams = FunctionArguments<typeof functions.renounceOwnership>
export type RenounceOwnershipReturn = FunctionReturn<typeof functions.renounceOwnership>

export type SetMinEnrollmentParams = FunctionArguments<typeof functions.setMinEnrollment>
export type SetMinEnrollmentReturn = FunctionReturn<typeof functions.setMinEnrollment>

export type SetMintPriceParams = FunctionArguments<typeof functions.setMintPrice>
export type SetMintPriceReturn = FunctionReturn<typeof functions.setMintPrice>

export type SetSignatureValidityParams = FunctionArguments<typeof functions.setSignatureValidity>
export type SetSignatureValidityReturn = FunctionReturn<typeof functions.setSignatureValidity>

export type SetVerifyPriceParams = FunctionArguments<typeof functions.setVerifyPrice>
export type SetVerifyPriceReturn = FunctionReturn<typeof functions.setVerifyPrice>

export type SignatureValidityParams = FunctionArguments<typeof functions.signatureValidity>
export type SignatureValidityReturn = FunctionReturn<typeof functions.signatureValidity>

export type SymbolParams = FunctionArguments<typeof functions.symbol>
export type SymbolReturn = FunctionReturn<typeof functions.symbol>

export type TotalSupplyParams = FunctionArguments<typeof functions.totalSupply>
export type TotalSupplyReturn = FunctionReturn<typeof functions.totalSupply>

export type TransferParams = FunctionArguments<typeof functions.transfer>
export type TransferReturn = FunctionReturn<typeof functions.transfer>

export type TransferFromParams = FunctionArguments<typeof functions.transferFrom>
export type TransferFromReturn = FunctionReturn<typeof functions.transferFrom>

export type TransferOwnershipParams = FunctionArguments<typeof functions.transferOwnership>
export type TransferOwnershipReturn = FunctionReturn<typeof functions.transferOwnership>

export type UpdateSignerParams = FunctionArguments<typeof functions.updateSigner>
export type UpdateSignerReturn = FunctionReturn<typeof functions.updateSigner>

export type UpgradeToAndCallParams = FunctionArguments<typeof functions.upgradeToAndCall>
export type UpgradeToAndCallReturn = FunctionReturn<typeof functions.upgradeToAndCall>

export type UserBurnParams = FunctionArguments<typeof functions.userBurn>
export type UserBurnReturn = FunctionReturn<typeof functions.userBurn>

export type UserFreeMintParams = FunctionArguments<typeof functions.userFreeMint>
export type UserFreeMintReturn = FunctionReturn<typeof functions.userFreeMint>

export type UserMintParams = FunctionArguments<typeof functions.userMint>
export type UserMintReturn = FunctionReturn<typeof functions.userMint>

export type UserVerifyParams = FunctionArguments<typeof functions.userVerify>
export type UserVerifyReturn = FunctionReturn<typeof functions.userVerify>

export type VerifyMessageParams = FunctionArguments<typeof functions.verifyMessage>
export type VerifyMessageReturn = FunctionReturn<typeof functions.verifyMessage>

export type VerifyPriceParams = FunctionArguments<typeof functions.verifyPrice>
export type VerifyPriceReturn = FunctionReturn<typeof functions.verifyPrice>

export type WithdrawParams = FunctionArguments<typeof functions.withdraw>
export type WithdrawReturn = FunctionReturn<typeof functions.withdraw>

