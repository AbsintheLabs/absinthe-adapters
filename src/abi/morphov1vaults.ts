import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    AccrueInterest: event("0xf66f28b40975dbb933913542c7e6a0f50a1d0f20aa74ea6e0efe65ab616323ec", "AccrueInterest(uint256,uint256)", {"newTotalAssets": p.uint256, "feeShares": p.uint256}),
    Approval: event("0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925", "Approval(address,address,uint256)", {"owner": indexed(p.address), "spender": indexed(p.address), "value": p.uint256}),
    Deposit: event("0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7", "Deposit(address,address,uint256,uint256)", {"sender": indexed(p.address), "owner": indexed(p.address), "assets": p.uint256, "shares": p.uint256}),
    EIP712DomainChanged: event("0x0a6387c9ea3628b88a633bb4f3b151770f70085117a15f9bf3787cda53f13d31", "EIP712DomainChanged()", {}),
    OwnershipTransferStarted: event("0x38d16b8cac22d99fc7c124b9cd0de2d3fa1faef420bfe791d8c362d765e22700", "OwnershipTransferStarted(address,address)", {"previousOwner": indexed(p.address), "newOwner": indexed(p.address)}),
    OwnershipTransferred: event("0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0", "OwnershipTransferred(address,address)", {"previousOwner": indexed(p.address), "newOwner": indexed(p.address)}),
    ReallocateSupply: event("0x89bf199df65bf65155e3e0a8abc4ad4a1be606220c8295840dba2ab5656c1f6d", "ReallocateSupply(address,bytes32,uint256,uint256)", {"caller": indexed(p.address), "id": indexed(p.bytes32), "suppliedAssets": p.uint256, "suppliedShares": p.uint256}),
    ReallocateWithdraw: event("0xdd8bf5226dff861316e0fa7863fdb7dc7b87c614eb29a135f524eb79d5a1189a", "ReallocateWithdraw(address,bytes32,uint256,uint256)", {"caller": indexed(p.address), "id": indexed(p.bytes32), "withdrawnAssets": p.uint256, "withdrawnShares": p.uint256}),
    RevokePendingCap: event("0x1026ceca5ed3747eb5edec555732d4a6f901ce1a875ecf981064628cadde1120", "RevokePendingCap(address,bytes32)", {"caller": indexed(p.address), "id": indexed(p.bytes32)}),
    RevokePendingGuardian: event("0xc40a085ccfa20f5fd518ade5c3a77a7ecbdfbb4c75efcdca6146a8e3c841d663", "RevokePendingGuardian(address)", {"caller": indexed(p.address)}),
    RevokePendingMarketRemoval: event("0xcbeb8ecdaa5a3c133e62219b63bfc35bce3fda13065d2bed32e3b7dde60a59f4", "RevokePendingMarketRemoval(address,bytes32)", {"caller": indexed(p.address), "id": indexed(p.bytes32)}),
    RevokePendingTimelock: event("0x921828337692c347c634c5d2aacbc7b756014674bd236f3cc2058d8e284a951b", "RevokePendingTimelock(address)", {"caller": indexed(p.address)}),
    SetCap: event("0xe86b6d3313d3098f4c5f689c935de8fde876a597c185def2cedab85efedac686", "SetCap(address,bytes32,uint256)", {"caller": indexed(p.address), "id": indexed(p.bytes32), "cap": p.uint256}),
    SetCurator: event("0xbd0a63c12948fbc9194a5839019f99c9d71db924e5c70018265bc778b8f1a506", "SetCurator(address)", {"newCurator": indexed(p.address)}),
    SetFee: event("0x01fe2943baee27f47add82886c2200f910c749c461c9b63c5fe83901a53bdb49", "SetFee(address,uint256)", {"caller": indexed(p.address), "newFee": p.uint256}),
    SetFeeRecipient: event("0x2e979f80fe4d43055c584cf4a8467c55875ea36728fc37176c05acd784eb7a73", "SetFeeRecipient(address)", {"newFeeRecipient": indexed(p.address)}),
    SetGuardian: event("0xcb11cc8aade2f5a556749d1b2380d108a16fac3431e6a5d5ce12ef9de0bd76e3", "SetGuardian(address,address)", {"caller": indexed(p.address), "guardian": indexed(p.address)}),
    SetIsAllocator: event("0x74dc60cbc81a9472d04ad1d20e151d369c41104d655ed3f2f3091166a502cd8d", "SetIsAllocator(address,bool)", {"allocator": indexed(p.address), "isAllocator": p.bool}),
    SetName: event("0x4df9dcd34ae35f40f2c756fd8ac83210ed0b76d065543ee73d868aec7c7fcf02", "SetName(string)", {"name": p.string}),
    SetSkimRecipient: event("0x2e7908865670e21b9779422cadf5f1cba271a62bb95c71eaaf615c0a1c48ebee", "SetSkimRecipient(address)", {"newSkimRecipient": indexed(p.address)}),
    SetSupplyQueue: event("0x6ce31538fc7fba95714ddc8a275a09252b4b1fb8f33d2550aa58a5f62ad934de", "SetSupplyQueue(address,bytes32[])", {"caller": indexed(p.address), "newSupplyQueue": p.array(p.bytes32)}),
    SetSymbol: event("0xadf3ae8bd543b3007d464f15cb8ea1db3f44e84d41d203164f40b95e27558ac6", "SetSymbol(string)", {"symbol": p.string}),
    SetTimelock: event("0xd28e9b90ee9b37c5936ff84392d71f29ff18117d7e76bcee60615262a90a3f75", "SetTimelock(address,uint256)", {"caller": indexed(p.address), "newTimelock": p.uint256}),
    SetWithdrawQueue: event("0xe0c2db6b54586be6d7d49943139fccf0dd315ba63e55364a76c73cd8fdba724d", "SetWithdrawQueue(address,bytes32[])", {"caller": indexed(p.address), "newWithdrawQueue": p.array(p.bytes32)}),
    Skim: event("0x2ae72b44f59d038340fca5739135a1d51fc5ab720bb02d983e4c5ff4119ca7b8", "Skim(address,address,uint256)", {"caller": indexed(p.address), "token": indexed(p.address), "amount": p.uint256}),
    SubmitCap: event("0xe851bb5856808a50efd748be463b8f35bcfb5ec74c5bfde776fe0a4d2a26db27", "SubmitCap(address,bytes32,uint256)", {"caller": indexed(p.address), "id": indexed(p.bytes32), "cap": p.uint256}),
    SubmitGuardian: event("0x7633313af54753bce8a149927263b1a55eba857ba4ef1d13c6aee25d384d3c4b", "SubmitGuardian(address)", {"newGuardian": indexed(p.address)}),
    SubmitMarketRemoval: event("0x3240fc70754c5a2b4dab10bf7081a00024bfc8491581ee3d355360ec0dd91f16", "SubmitMarketRemoval(address,bytes32)", {"caller": indexed(p.address), "id": indexed(p.bytes32)}),
    SubmitTimelock: event("0xb3aa0ade2442acf51d06713c2d1a5a3ec0373cce969d42b53f4689f97bccf380", "SubmitTimelock(uint256)", {"newTimelock": p.uint256}),
    Transfer: event("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "Transfer(address,address,uint256)", {"from": indexed(p.address), "to": indexed(p.address), "value": p.uint256}),
    UpdateLastTotalAssets: event("0x15c027cc4fd826d986cad358803439f7326d3aa4ed969ff90dbee4bc150f68e9", "UpdateLastTotalAssets(uint256)", {"updatedTotalAssets": p.uint256}),
    UpdateLostAssets: event("0x548669ea9bcc24888e6d74a69c9865fa98d795686853b8aa3eb87814261bbb71", "UpdateLostAssets(uint256)", {"newLostAssets": p.uint256}),
    Withdraw: event("0xfbde797d201c681b91056529119e0b02407c7bb96a4a2c75c01fc9667232c8db", "Withdraw(address,address,address,uint256,uint256)", {"sender": indexed(p.address), "receiver": indexed(p.address), "owner": indexed(p.address), "assets": p.uint256, "shares": p.uint256}),
}

export const functions = {
    DECIMALS_OFFSET: viewFun("0xaea70acc", "DECIMALS_OFFSET()", {}, p.uint8),
    DOMAIN_SEPARATOR: viewFun("0x3644e515", "DOMAIN_SEPARATOR()", {}, p.bytes32),
    MORPHO: viewFun("0x3acb5624", "MORPHO()", {}, p.address),
    acceptCap: fun("0x6fda3868", "acceptCap((address,address,address,address,uint256))", {"marketParams": p.struct({"loanToken": p.address, "collateralToken": p.address, "oracle": p.address, "irm": p.address, "lltv": p.uint256})}, ),
    acceptGuardian: fun("0xa5f31d61", "acceptGuardian()", {}, ),
    acceptOwnership: fun("0x79ba5097", "acceptOwnership()", {}, ),
    acceptTimelock: fun("0x8a2c7b39", "acceptTimelock()", {}, ),
    allowance: viewFun("0xdd62ed3e", "allowance(address,address)", {"owner": p.address, "spender": p.address}, p.uint256),
    approve: fun("0x095ea7b3", "approve(address,uint256)", {"spender": p.address, "value": p.uint256}, p.bool),
    asset: viewFun("0x38d52e0f", "asset()", {}, p.address),
    balanceOf: viewFun("0x70a08231", "balanceOf(address)", {"account": p.address}, p.uint256),
    config: viewFun("0xcc718f76", "config(bytes32)", {"_0": p.bytes32}, {"cap": p.uint184, "enabled": p.bool, "removableAt": p.uint64}),
    convertToAssets: viewFun("0x07a2d13a", "convertToAssets(uint256)", {"shares": p.uint256}, p.uint256),
    convertToShares: viewFun("0xc6e6f592", "convertToShares(uint256)", {"assets": p.uint256}, p.uint256),
    curator: viewFun("0xe66f53b7", "curator()", {}, p.address),
    decimals: viewFun("0x313ce567", "decimals()", {}, p.uint8),
    deposit: fun("0x6e553f65", "deposit(uint256,address)", {"assets": p.uint256, "receiver": p.address}, p.uint256),
    eip712Domain: viewFun("0x84b0196e", "eip712Domain()", {}, {"fields": p.bytes1, "name": p.string, "version": p.string, "chainId": p.uint256, "verifyingContract": p.address, "salt": p.bytes32, "extensions": p.array(p.uint256)}),
    fee: viewFun("0xddca3f43", "fee()", {}, p.uint96),
    feeRecipient: viewFun("0x46904840", "feeRecipient()", {}, p.address),
    guardian: viewFun("0x452a9320", "guardian()", {}, p.address),
    isAllocator: viewFun("0x4dedf20e", "isAllocator(address)", {"_0": p.address}, p.bool),
    lastTotalAssets: viewFun("0x568efc07", "lastTotalAssets()", {}, p.uint256),
    lostAssets: viewFun("0x21cb4b14", "lostAssets()", {}, p.uint256),
    maxDeposit: viewFun("0x402d267d", "maxDeposit(address)", {"_0": p.address}, p.uint256),
    maxMint: viewFun("0xc63d75b6", "maxMint(address)", {"_0": p.address}, p.uint256),
    maxRedeem: viewFun("0xd905777e", "maxRedeem(address)", {"owner": p.address}, p.uint256),
    maxWithdraw: viewFun("0xce96cb77", "maxWithdraw(address)", {"owner": p.address}, p.uint256),
    mint: fun("0x94bf804d", "mint(uint256,address)", {"shares": p.uint256, "receiver": p.address}, p.uint256),
    multicall: fun("0xac9650d8", "multicall(bytes[])", {"data": p.array(p.bytes)}, p.array(p.bytes)),
    name: viewFun("0x06fdde03", "name()", {}, p.string),
    nonces: viewFun("0x7ecebe00", "nonces(address)", {"owner": p.address}, p.uint256),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    pendingCap: viewFun("0xa31be5d6", "pendingCap(bytes32)", {"_0": p.bytes32}, {"value": p.uint192, "validAt": p.uint64}),
    pendingGuardian: viewFun("0x762c31ba", "pendingGuardian()", {}, {"value": p.address, "validAt": p.uint64}),
    pendingOwner: viewFun("0xe30c3978", "pendingOwner()", {}, p.address),
    pendingTimelock: viewFun("0x7cc4d9a1", "pendingTimelock()", {}, {"value": p.uint192, "validAt": p.uint64}),
    permit: fun("0xd505accf", "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)", {"owner": p.address, "spender": p.address, "value": p.uint256, "deadline": p.uint256, "v": p.uint8, "r": p.bytes32, "s": p.bytes32}, ),
    previewDeposit: viewFun("0xef8b30f7", "previewDeposit(uint256)", {"assets": p.uint256}, p.uint256),
    previewMint: viewFun("0xb3d7f6b9", "previewMint(uint256)", {"shares": p.uint256}, p.uint256),
    previewRedeem: viewFun("0x4cdad506", "previewRedeem(uint256)", {"shares": p.uint256}, p.uint256),
    previewWithdraw: viewFun("0x0a28a477", "previewWithdraw(uint256)", {"assets": p.uint256}, p.uint256),
    reallocate: fun("0x7299aa31", "reallocate(((address,address,address,address,uint256),uint256)[])", {"allocations": p.array(p.struct({"marketParams": p.struct({"loanToken": p.address, "collateralToken": p.address, "oracle": p.address, "irm": p.address, "lltv": p.uint256}), "assets": p.uint256}))}, ),
    redeem: fun("0xba087652", "redeem(uint256,address,address)", {"shares": p.uint256, "receiver": p.address, "owner": p.address}, p.uint256),
    renounceOwnership: fun("0x715018a6", "renounceOwnership()", {}, ),
    revokePendingCap: fun("0x102f7b6c", "revokePendingCap(bytes32)", {"id": p.bytes32}, ),
    revokePendingGuardian: fun("0x1ecca77c", "revokePendingGuardian()", {}, ),
    revokePendingMarketRemoval: fun("0x4b998de5", "revokePendingMarketRemoval(bytes32)", {"id": p.bytes32}, ),
    revokePendingTimelock: fun("0xc9649aa9", "revokePendingTimelock()", {}, ),
    setCurator: fun("0xe90956cf", "setCurator(address)", {"newCurator": p.address}, ),
    setFee: fun("0x69fe0e2d", "setFee(uint256)", {"newFee": p.uint256}, ),
    setFeeRecipient: fun("0xe74b981b", "setFeeRecipient(address)", {"newFeeRecipient": p.address}, ),
    setIsAllocator: fun("0xb192a84a", "setIsAllocator(address,bool)", {"newAllocator": p.address, "newIsAllocator": p.bool}, ),
    setName: fun("0xc47f0027", "setName(string)", {"newName": p.string}, ),
    setSkimRecipient: fun("0x2b30997b", "setSkimRecipient(address)", {"newSkimRecipient": p.address}, ),
    setSupplyQueue: fun("0x2acc56f9", "setSupplyQueue(bytes32[])", {"newSupplyQueue": p.array(p.bytes32)}, ),
    setSymbol: fun("0xb84c8246", "setSymbol(string)", {"newSymbol": p.string}, ),
    skim: fun("0xbc25cf77", "skim(address)", {"token": p.address}, ),
    skimRecipient: viewFun("0x388af5b5", "skimRecipient()", {}, p.address),
    submitCap: fun("0x3b24c2bf", "submitCap((address,address,address,address,uint256),uint256)", {"marketParams": p.struct({"loanToken": p.address, "collateralToken": p.address, "oracle": p.address, "irm": p.address, "lltv": p.uint256}), "newSupplyCap": p.uint256}, ),
    submitGuardian: fun("0x9d6b4a45", "submitGuardian(address)", {"newGuardian": p.address}, ),
    submitMarketRemoval: fun("0x84755b5f", "submitMarketRemoval((address,address,address,address,uint256))", {"marketParams": p.struct({"loanToken": p.address, "collateralToken": p.address, "oracle": p.address, "irm": p.address, "lltv": p.uint256})}, ),
    submitTimelock: fun("0x7224a512", "submitTimelock(uint256)", {"newTimelock": p.uint256}, ),
    supplyQueue: viewFun("0xf7d18521", "supplyQueue(uint256)", {"_0": p.uint256}, p.bytes32),
    supplyQueueLength: viewFun("0xa17b3130", "supplyQueueLength()", {}, p.uint256),
    symbol: viewFun("0x95d89b41", "symbol()", {}, p.string),
    timelock: viewFun("0xd33219b4", "timelock()", {}, p.uint256),
    totalAssets: viewFun("0x01e1d114", "totalAssets()", {}, p.uint256),
    totalSupply: viewFun("0x18160ddd", "totalSupply()", {}, p.uint256),
    transfer: fun("0xa9059cbb", "transfer(address,uint256)", {"to": p.address, "value": p.uint256}, p.bool),
    transferFrom: fun("0x23b872dd", "transferFrom(address,address,uint256)", {"from": p.address, "to": p.address, "value": p.uint256}, p.bool),
    transferOwnership: fun("0xf2fde38b", "transferOwnership(address)", {"newOwner": p.address}, ),
    updateWithdrawQueue: fun("0x41b67833", "updateWithdrawQueue(uint256[])", {"indexes": p.array(p.uint256)}, ),
    withdraw: fun("0xb460af94", "withdraw(uint256,address,address)", {"assets": p.uint256, "receiver": p.address, "owner": p.address}, p.uint256),
    withdrawQueue: viewFun("0x62518ddf", "withdrawQueue(uint256)", {"_0": p.uint256}, p.bytes32),
    withdrawQueueLength: viewFun("0x33f91ebb", "withdrawQueueLength()", {}, p.uint256),
}

export class Contract extends ContractBase {

    DECIMALS_OFFSET() {
        return this.eth_call(functions.DECIMALS_OFFSET, {})
    }

    DOMAIN_SEPARATOR() {
        return this.eth_call(functions.DOMAIN_SEPARATOR, {})
    }

    MORPHO() {
        return this.eth_call(functions.MORPHO, {})
    }

    allowance(owner: AllowanceParams["owner"], spender: AllowanceParams["spender"]) {
        return this.eth_call(functions.allowance, {owner, spender})
    }

    asset() {
        return this.eth_call(functions.asset, {})
    }

    balanceOf(account: BalanceOfParams["account"]) {
        return this.eth_call(functions.balanceOf, {account})
    }

    config(_0: ConfigParams["_0"]) {
        return this.eth_call(functions.config, {_0})
    }

    convertToAssets(shares: ConvertToAssetsParams["shares"]) {
        return this.eth_call(functions.convertToAssets, {shares})
    }

    convertToShares(assets: ConvertToSharesParams["assets"]) {
        return this.eth_call(functions.convertToShares, {assets})
    }

    curator() {
        return this.eth_call(functions.curator, {})
    }

    decimals() {
        return this.eth_call(functions.decimals, {})
    }

    eip712Domain() {
        return this.eth_call(functions.eip712Domain, {})
    }

    fee() {
        return this.eth_call(functions.fee, {})
    }

    feeRecipient() {
        return this.eth_call(functions.feeRecipient, {})
    }

    guardian() {
        return this.eth_call(functions.guardian, {})
    }

    isAllocator(_0: IsAllocatorParams["_0"]) {
        return this.eth_call(functions.isAllocator, {_0})
    }

    lastTotalAssets() {
        return this.eth_call(functions.lastTotalAssets, {})
    }

    lostAssets() {
        return this.eth_call(functions.lostAssets, {})
    }

    maxDeposit(_0: MaxDepositParams["_0"]) {
        return this.eth_call(functions.maxDeposit, {_0})
    }

    maxMint(_0: MaxMintParams["_0"]) {
        return this.eth_call(functions.maxMint, {_0})
    }

    maxRedeem(owner: MaxRedeemParams["owner"]) {
        return this.eth_call(functions.maxRedeem, {owner})
    }

    maxWithdraw(owner: MaxWithdrawParams["owner"]) {
        return this.eth_call(functions.maxWithdraw, {owner})
    }

    name() {
        return this.eth_call(functions.name, {})
    }

    nonces(owner: NoncesParams["owner"]) {
        return this.eth_call(functions.nonces, {owner})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    pendingCap(_0: PendingCapParams["_0"]) {
        return this.eth_call(functions.pendingCap, {_0})
    }

    pendingGuardian() {
        return this.eth_call(functions.pendingGuardian, {})
    }

    pendingOwner() {
        return this.eth_call(functions.pendingOwner, {})
    }

    pendingTimelock() {
        return this.eth_call(functions.pendingTimelock, {})
    }

    previewDeposit(assets: PreviewDepositParams["assets"]) {
        return this.eth_call(functions.previewDeposit, {assets})
    }

    previewMint(shares: PreviewMintParams["shares"]) {
        return this.eth_call(functions.previewMint, {shares})
    }

    previewRedeem(shares: PreviewRedeemParams["shares"]) {
        return this.eth_call(functions.previewRedeem, {shares})
    }

    previewWithdraw(assets: PreviewWithdrawParams["assets"]) {
        return this.eth_call(functions.previewWithdraw, {assets})
    }

    skimRecipient() {
        return this.eth_call(functions.skimRecipient, {})
    }

    supplyQueue(_0: SupplyQueueParams["_0"]) {
        return this.eth_call(functions.supplyQueue, {_0})
    }

    supplyQueueLength() {
        return this.eth_call(functions.supplyQueueLength, {})
    }

    symbol() {
        return this.eth_call(functions.symbol, {})
    }

    timelock() {
        return this.eth_call(functions.timelock, {})
    }

    totalAssets() {
        return this.eth_call(functions.totalAssets, {})
    }

    totalSupply() {
        return this.eth_call(functions.totalSupply, {})
    }

    withdrawQueue(_0: WithdrawQueueParams["_0"]) {
        return this.eth_call(functions.withdrawQueue, {_0})
    }

    withdrawQueueLength() {
        return this.eth_call(functions.withdrawQueueLength, {})
    }
}

/// Event types
export type AccrueInterestEventArgs = EParams<typeof events.AccrueInterest>
export type ApprovalEventArgs = EParams<typeof events.Approval>
export type DepositEventArgs = EParams<typeof events.Deposit>
export type EIP712DomainChangedEventArgs = EParams<typeof events.EIP712DomainChanged>
export type OwnershipTransferStartedEventArgs = EParams<typeof events.OwnershipTransferStarted>
export type OwnershipTransferredEventArgs = EParams<typeof events.OwnershipTransferred>
export type ReallocateSupplyEventArgs = EParams<typeof events.ReallocateSupply>
export type ReallocateWithdrawEventArgs = EParams<typeof events.ReallocateWithdraw>
export type RevokePendingCapEventArgs = EParams<typeof events.RevokePendingCap>
export type RevokePendingGuardianEventArgs = EParams<typeof events.RevokePendingGuardian>
export type RevokePendingMarketRemovalEventArgs = EParams<typeof events.RevokePendingMarketRemoval>
export type RevokePendingTimelockEventArgs = EParams<typeof events.RevokePendingTimelock>
export type SetCapEventArgs = EParams<typeof events.SetCap>
export type SetCuratorEventArgs = EParams<typeof events.SetCurator>
export type SetFeeEventArgs = EParams<typeof events.SetFee>
export type SetFeeRecipientEventArgs = EParams<typeof events.SetFeeRecipient>
export type SetGuardianEventArgs = EParams<typeof events.SetGuardian>
export type SetIsAllocatorEventArgs = EParams<typeof events.SetIsAllocator>
export type SetNameEventArgs = EParams<typeof events.SetName>
export type SetSkimRecipientEventArgs = EParams<typeof events.SetSkimRecipient>
export type SetSupplyQueueEventArgs = EParams<typeof events.SetSupplyQueue>
export type SetSymbolEventArgs = EParams<typeof events.SetSymbol>
export type SetTimelockEventArgs = EParams<typeof events.SetTimelock>
export type SetWithdrawQueueEventArgs = EParams<typeof events.SetWithdrawQueue>
export type SkimEventArgs = EParams<typeof events.Skim>
export type SubmitCapEventArgs = EParams<typeof events.SubmitCap>
export type SubmitGuardianEventArgs = EParams<typeof events.SubmitGuardian>
export type SubmitMarketRemovalEventArgs = EParams<typeof events.SubmitMarketRemoval>
export type SubmitTimelockEventArgs = EParams<typeof events.SubmitTimelock>
export type TransferEventArgs = EParams<typeof events.Transfer>
export type UpdateLastTotalAssetsEventArgs = EParams<typeof events.UpdateLastTotalAssets>
export type UpdateLostAssetsEventArgs = EParams<typeof events.UpdateLostAssets>
export type WithdrawEventArgs = EParams<typeof events.Withdraw>

/// Function types
export type DECIMALS_OFFSETParams = FunctionArguments<typeof functions.DECIMALS_OFFSET>
export type DECIMALS_OFFSETReturn = FunctionReturn<typeof functions.DECIMALS_OFFSET>

export type DOMAIN_SEPARATORParams = FunctionArguments<typeof functions.DOMAIN_SEPARATOR>
export type DOMAIN_SEPARATORReturn = FunctionReturn<typeof functions.DOMAIN_SEPARATOR>

export type MORPHOParams = FunctionArguments<typeof functions.MORPHO>
export type MORPHOReturn = FunctionReturn<typeof functions.MORPHO>

export type AcceptCapParams = FunctionArguments<typeof functions.acceptCap>
export type AcceptCapReturn = FunctionReturn<typeof functions.acceptCap>

export type AcceptGuardianParams = FunctionArguments<typeof functions.acceptGuardian>
export type AcceptGuardianReturn = FunctionReturn<typeof functions.acceptGuardian>

export type AcceptOwnershipParams = FunctionArguments<typeof functions.acceptOwnership>
export type AcceptOwnershipReturn = FunctionReturn<typeof functions.acceptOwnership>

export type AcceptTimelockParams = FunctionArguments<typeof functions.acceptTimelock>
export type AcceptTimelockReturn = FunctionReturn<typeof functions.acceptTimelock>

export type AllowanceParams = FunctionArguments<typeof functions.allowance>
export type AllowanceReturn = FunctionReturn<typeof functions.allowance>

export type ApproveParams = FunctionArguments<typeof functions.approve>
export type ApproveReturn = FunctionReturn<typeof functions.approve>

export type AssetParams = FunctionArguments<typeof functions.asset>
export type AssetReturn = FunctionReturn<typeof functions.asset>

export type BalanceOfParams = FunctionArguments<typeof functions.balanceOf>
export type BalanceOfReturn = FunctionReturn<typeof functions.balanceOf>

export type ConfigParams = FunctionArguments<typeof functions.config>
export type ConfigReturn = FunctionReturn<typeof functions.config>

export type ConvertToAssetsParams = FunctionArguments<typeof functions.convertToAssets>
export type ConvertToAssetsReturn = FunctionReturn<typeof functions.convertToAssets>

export type ConvertToSharesParams = FunctionArguments<typeof functions.convertToShares>
export type ConvertToSharesReturn = FunctionReturn<typeof functions.convertToShares>

export type CuratorParams = FunctionArguments<typeof functions.curator>
export type CuratorReturn = FunctionReturn<typeof functions.curator>

export type DecimalsParams = FunctionArguments<typeof functions.decimals>
export type DecimalsReturn = FunctionReturn<typeof functions.decimals>

export type DepositParams = FunctionArguments<typeof functions.deposit>
export type DepositReturn = FunctionReturn<typeof functions.deposit>

export type Eip712DomainParams = FunctionArguments<typeof functions.eip712Domain>
export type Eip712DomainReturn = FunctionReturn<typeof functions.eip712Domain>

export type FeeParams = FunctionArguments<typeof functions.fee>
export type FeeReturn = FunctionReturn<typeof functions.fee>

export type FeeRecipientParams = FunctionArguments<typeof functions.feeRecipient>
export type FeeRecipientReturn = FunctionReturn<typeof functions.feeRecipient>

export type GuardianParams = FunctionArguments<typeof functions.guardian>
export type GuardianReturn = FunctionReturn<typeof functions.guardian>

export type IsAllocatorParams = FunctionArguments<typeof functions.isAllocator>
export type IsAllocatorReturn = FunctionReturn<typeof functions.isAllocator>

export type LastTotalAssetsParams = FunctionArguments<typeof functions.lastTotalAssets>
export type LastTotalAssetsReturn = FunctionReturn<typeof functions.lastTotalAssets>

export type LostAssetsParams = FunctionArguments<typeof functions.lostAssets>
export type LostAssetsReturn = FunctionReturn<typeof functions.lostAssets>

export type MaxDepositParams = FunctionArguments<typeof functions.maxDeposit>
export type MaxDepositReturn = FunctionReturn<typeof functions.maxDeposit>

export type MaxMintParams = FunctionArguments<typeof functions.maxMint>
export type MaxMintReturn = FunctionReturn<typeof functions.maxMint>

export type MaxRedeemParams = FunctionArguments<typeof functions.maxRedeem>
export type MaxRedeemReturn = FunctionReturn<typeof functions.maxRedeem>

export type MaxWithdrawParams = FunctionArguments<typeof functions.maxWithdraw>
export type MaxWithdrawReturn = FunctionReturn<typeof functions.maxWithdraw>

export type MintParams = FunctionArguments<typeof functions.mint>
export type MintReturn = FunctionReturn<typeof functions.mint>

export type MulticallParams = FunctionArguments<typeof functions.multicall>
export type MulticallReturn = FunctionReturn<typeof functions.multicall>

export type NameParams = FunctionArguments<typeof functions.name>
export type NameReturn = FunctionReturn<typeof functions.name>

export type NoncesParams = FunctionArguments<typeof functions.nonces>
export type NoncesReturn = FunctionReturn<typeof functions.nonces>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type PendingCapParams = FunctionArguments<typeof functions.pendingCap>
export type PendingCapReturn = FunctionReturn<typeof functions.pendingCap>

export type PendingGuardianParams = FunctionArguments<typeof functions.pendingGuardian>
export type PendingGuardianReturn = FunctionReturn<typeof functions.pendingGuardian>

export type PendingOwnerParams = FunctionArguments<typeof functions.pendingOwner>
export type PendingOwnerReturn = FunctionReturn<typeof functions.pendingOwner>

export type PendingTimelockParams = FunctionArguments<typeof functions.pendingTimelock>
export type PendingTimelockReturn = FunctionReturn<typeof functions.pendingTimelock>

export type PermitParams = FunctionArguments<typeof functions.permit>
export type PermitReturn = FunctionReturn<typeof functions.permit>

export type PreviewDepositParams = FunctionArguments<typeof functions.previewDeposit>
export type PreviewDepositReturn = FunctionReturn<typeof functions.previewDeposit>

export type PreviewMintParams = FunctionArguments<typeof functions.previewMint>
export type PreviewMintReturn = FunctionReturn<typeof functions.previewMint>

export type PreviewRedeemParams = FunctionArguments<typeof functions.previewRedeem>
export type PreviewRedeemReturn = FunctionReturn<typeof functions.previewRedeem>

export type PreviewWithdrawParams = FunctionArguments<typeof functions.previewWithdraw>
export type PreviewWithdrawReturn = FunctionReturn<typeof functions.previewWithdraw>

export type ReallocateParams = FunctionArguments<typeof functions.reallocate>
export type ReallocateReturn = FunctionReturn<typeof functions.reallocate>

export type RedeemParams = FunctionArguments<typeof functions.redeem>
export type RedeemReturn = FunctionReturn<typeof functions.redeem>

export type RenounceOwnershipParams = FunctionArguments<typeof functions.renounceOwnership>
export type RenounceOwnershipReturn = FunctionReturn<typeof functions.renounceOwnership>

export type RevokePendingCapParams = FunctionArguments<typeof functions.revokePendingCap>
export type RevokePendingCapReturn = FunctionReturn<typeof functions.revokePendingCap>

export type RevokePendingGuardianParams = FunctionArguments<typeof functions.revokePendingGuardian>
export type RevokePendingGuardianReturn = FunctionReturn<typeof functions.revokePendingGuardian>

export type RevokePendingMarketRemovalParams = FunctionArguments<typeof functions.revokePendingMarketRemoval>
export type RevokePendingMarketRemovalReturn = FunctionReturn<typeof functions.revokePendingMarketRemoval>

export type RevokePendingTimelockParams = FunctionArguments<typeof functions.revokePendingTimelock>
export type RevokePendingTimelockReturn = FunctionReturn<typeof functions.revokePendingTimelock>

export type SetCuratorParams = FunctionArguments<typeof functions.setCurator>
export type SetCuratorReturn = FunctionReturn<typeof functions.setCurator>

export type SetFeeParams = FunctionArguments<typeof functions.setFee>
export type SetFeeReturn = FunctionReturn<typeof functions.setFee>

export type SetFeeRecipientParams = FunctionArguments<typeof functions.setFeeRecipient>
export type SetFeeRecipientReturn = FunctionReturn<typeof functions.setFeeRecipient>

export type SetIsAllocatorParams = FunctionArguments<typeof functions.setIsAllocator>
export type SetIsAllocatorReturn = FunctionReturn<typeof functions.setIsAllocator>

export type SetNameParams = FunctionArguments<typeof functions.setName>
export type SetNameReturn = FunctionReturn<typeof functions.setName>

export type SetSkimRecipientParams = FunctionArguments<typeof functions.setSkimRecipient>
export type SetSkimRecipientReturn = FunctionReturn<typeof functions.setSkimRecipient>

export type SetSupplyQueueParams = FunctionArguments<typeof functions.setSupplyQueue>
export type SetSupplyQueueReturn = FunctionReturn<typeof functions.setSupplyQueue>

export type SetSymbolParams = FunctionArguments<typeof functions.setSymbol>
export type SetSymbolReturn = FunctionReturn<typeof functions.setSymbol>

export type SkimParams = FunctionArguments<typeof functions.skim>
export type SkimReturn = FunctionReturn<typeof functions.skim>

export type SkimRecipientParams = FunctionArguments<typeof functions.skimRecipient>
export type SkimRecipientReturn = FunctionReturn<typeof functions.skimRecipient>

export type SubmitCapParams = FunctionArguments<typeof functions.submitCap>
export type SubmitCapReturn = FunctionReturn<typeof functions.submitCap>

export type SubmitGuardianParams = FunctionArguments<typeof functions.submitGuardian>
export type SubmitGuardianReturn = FunctionReturn<typeof functions.submitGuardian>

export type SubmitMarketRemovalParams = FunctionArguments<typeof functions.submitMarketRemoval>
export type SubmitMarketRemovalReturn = FunctionReturn<typeof functions.submitMarketRemoval>

export type SubmitTimelockParams = FunctionArguments<typeof functions.submitTimelock>
export type SubmitTimelockReturn = FunctionReturn<typeof functions.submitTimelock>

export type SupplyQueueParams = FunctionArguments<typeof functions.supplyQueue>
export type SupplyQueueReturn = FunctionReturn<typeof functions.supplyQueue>

export type SupplyQueueLengthParams = FunctionArguments<typeof functions.supplyQueueLength>
export type SupplyQueueLengthReturn = FunctionReturn<typeof functions.supplyQueueLength>

export type SymbolParams = FunctionArguments<typeof functions.symbol>
export type SymbolReturn = FunctionReturn<typeof functions.symbol>

export type TimelockParams = FunctionArguments<typeof functions.timelock>
export type TimelockReturn = FunctionReturn<typeof functions.timelock>

export type TotalAssetsParams = FunctionArguments<typeof functions.totalAssets>
export type TotalAssetsReturn = FunctionReturn<typeof functions.totalAssets>

export type TotalSupplyParams = FunctionArguments<typeof functions.totalSupply>
export type TotalSupplyReturn = FunctionReturn<typeof functions.totalSupply>

export type TransferParams = FunctionArguments<typeof functions.transfer>
export type TransferReturn = FunctionReturn<typeof functions.transfer>

export type TransferFromParams = FunctionArguments<typeof functions.transferFrom>
export type TransferFromReturn = FunctionReturn<typeof functions.transferFrom>

export type TransferOwnershipParams = FunctionArguments<typeof functions.transferOwnership>
export type TransferOwnershipReturn = FunctionReturn<typeof functions.transferOwnership>

export type UpdateWithdrawQueueParams = FunctionArguments<typeof functions.updateWithdrawQueue>
export type UpdateWithdrawQueueReturn = FunctionReturn<typeof functions.updateWithdrawQueue>

export type WithdrawParams = FunctionArguments<typeof functions.withdraw>
export type WithdrawReturn = FunctionReturn<typeof functions.withdraw>

export type WithdrawQueueParams = FunctionArguments<typeof functions.withdrawQueue>
export type WithdrawQueueReturn = FunctionReturn<typeof functions.withdrawQueue>

export type WithdrawQueueLengthParams = FunctionArguments<typeof functions.withdrawQueueLength>
export type WithdrawQueueLengthReturn = FunctionReturn<typeof functions.withdrawQueueLength>

