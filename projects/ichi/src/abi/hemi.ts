import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    BlocklistChanged: event("0x939ba97d9885a19f5539df8bc7d0698b79b1361793009861943fdd9806048033", "BlocklistChanged(address,bool)", {"migrator": p.address, "blocked": p.bool}),
    Deposit: event("0x2c0f148b435140de488c1b34647f1511c646f7077e87007bacf22ef9977a16d8", "Deposit(uint256,address,address,uint256)", {"eventId": indexed(p.uint256), "depositor": indexed(p.address), "token": indexed(p.address), "amount": p.uint256}),
    EIP712DomainChanged: event("0x0a6387c9ea3628b88a633bb4f3b151770f70085117a15f9bf3787cda53f13d31", "EIP712DomainChanged()", {}),
    FunctionAdded: event("0xee43eda4dc4728f3b2c1a9b5dfdda27f5e3345bb35f639415984ffb909f1c953", "FunctionAdded(address,bytes4)", {"contractAddress": indexed(p.address), "functionSignature": p.bytes4}),
    FunctionRemoved: event("0x5abbfd8975596a613736baed6c3c864ee660459894ad98c7e6492b4c3c40f325", "FunctionRemoved(address,bytes4)", {"contractAddress": indexed(p.address), "functionSignature": p.bytes4}),
    MerkleRootSet: event("0xb04b7d6145a7588fdcf339a22877d5965f861c171204fc37688058c5f6c06d3b", "MerkleRootSet(uint256,bytes32)", {"index": p.uint256, "merkleRoot": p.bytes32}),
    MoveToDapp: event("0x3b08c979d85bb1c03af96786a09d3668c9b4654477d4c23b312fba3b41a55b21", "MoveToDapp(address,address,bytes4,bytes,address[],uint256[],uint256)", {"user": indexed(p.address), "contractAddress": indexed(p.address), "functionSignature": p.bytes4, "data": p.bytes, "tokens": p.array(p.address), "amountsSpent": p.array(p.uint256), "eventId": p.uint256}),
    MoveToDappMerkle: event("0xeb393942262bd94eac61d5e40eb6ca65affd69c7b567fb9dae4586b0b290ffcc", "MoveToDappMerkle(address,address,bytes4,bytes,address[],uint256[],uint256,uint256,uint256[],uint256[])", {"user": indexed(p.address), "contractAddress": indexed(p.address), "functionSignature": p.bytes4, "data": p.bytes, "tokens": p.array(p.address), "amountsSpent": p.array(p.uint256), "eventId": p.uint256, "rootIndex": indexed(p.uint256), "leafAmounts": p.array(p.uint256), "migrationEventIds": p.array(p.uint256)}),
    OwnershipTransferStarted: event("0x38d16b8cac22d99fc7c124b9cd0de2d3fa1faef420bfe791d8c362d765e22700", "OwnershipTransferStarted(address,address)", {"previousOwner": indexed(p.address), "newOwner": indexed(p.address)}),
    OwnershipTransferred: event("0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0", "OwnershipTransferred(address,address)", {"previousOwner": indexed(p.address), "newOwner": indexed(p.address)}),
    Paused: event("0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258", "Paused(address)", {"account": p.address}),
    RootStatusSet: event("0x12a7f2d79fe7df0aed768aeaad95b9b30c8526b6485aee80e1cf0e9d2a9a70af", "RootStatusSet(uint256,bool)", {"index": indexed(p.uint256), "disabled": p.bool}),
    SetLeafClaimed: event("0x256c64ba1f5e98ab3454f1faac31ef17f1654b16d259aec0bfaafc46a22ce201", "SetLeafClaimed(uint256,bytes32)", {"index": indexed(p.uint256), "leaf": p.bytes32}),
    TokenStakabilityChanged: event("0x303d37f32762627f23f474bb09535b3c1c7cb4f0f75c8960c42512b046ee24a8", "TokenStakabilityChanged(address,bool)", {"token": p.address, "enabled": p.bool}),
    Unpaused: event("0x5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa", "Unpaused(address)", {"account": p.address}),
    Withdraw: event("0xfeb2000dca3e617cd6f3a8bbb63014bb54a124aac6ccbf73ee7229b4cd01f120", "Withdraw(uint256,address,address,uint256)", {"eventId": indexed(p.uint256), "withdrawer": indexed(p.address), "token": indexed(p.address), "amount": p.uint256}),
    WithdrawMerkle: event("0x18b139e64edc15c8955bf891628e76e3a34191828067c4f61961e11911b369f9", "WithdrawMerkle(address,uint256,address[],uint256[],uint256[],uint256[],uint256)", {"user": indexed(p.address), "rootIndex": indexed(p.uint256), "tokens": p.array(p.address), "leafAmounts": p.array(p.uint256), "transferAmounts": p.array(p.uint256), "migrationEventIds": p.array(p.uint256), "eventId": p.uint256}),
}

export const functions = {
    MOVE_TO_DAPP_MERKLE_TYPEHASH: viewFun("0x2abd2278", "MOVE_TO_DAPP_MERKLE_TYPEHASH()", {}, p.bytes32),
    MOVE_TO_DAPP_TYPEHASH: viewFun("0x6f76365a", "MOVE_TO_DAPP_TYPEHASH()", {}, p.bytes32),
    acceptOwnership: fun("0x79ba5097", "acceptOwnership()", {}, ),
    addFunction: fun("0x0c9a50b3", "addFunction(address,bytes4)", {"_contractAddress": p.address, "_functionSignature": p.bytes4}, ),
    balance: viewFun("0xb203bb99", "balance(address,address)", {"_0": p.address, "_1": p.address}, p.uint256),
    batchDepositFor: fun("0x8d7cdca1", "batchDepositFor(address[],address[],uint256[])", {"_tokens": p.array(p.address), "_for": p.array(p.address), "_amounts": p.array(p.uint256)}, ),
    claimed: viewFun("0xf70e4760", "claimed(uint256,bytes32)", {"_0": p.uint256, "_1": p.bytes32}, p.bool),
    depositETHFor: fun("0xf6203e35", "depositETHFor(address)", {"_for": p.address}, ),
    depositFor: fun("0xb3db428b", "depositFor(address,address,uint256)", {"_token": p.address, "_for": p.address, "_amount": p.uint256}, ),
    eip712Domain: viewFun("0x84b0196e", "eip712Domain()", {}, {"fields": p.bytes1, "name": p.string, "version": p.string, "chainId": p.uint256, "verifyingContract": p.address, "salt": p.bytes32, "extensions": p.array(p.uint256)}),
    eventId: viewFun("0x089cdd0c", "eventId()", {}, p.uint256),
    functionAllowlist: viewFun("0x17d68b87", "functionAllowlist(address,bytes4)", {"_0": p.address, "_1": p.bytes4}, p.bool),
    merkleRootDisabled: viewFun("0x081785aa", "merkleRootDisabled(uint256)", {"_0": p.uint256}, p.bool),
    merkleRoots: viewFun("0x71c5ecb1", "merkleRoots(uint256)", {"_0": p.uint256}, p.bytes32),
    moveToDapp: fun("0x0c7ac556", "moveToDapp((address,bytes4,bytes,address[],uint256[]))", {"_contractCall": p.struct({"contractAddress": p.address, "functionSignature": p.bytes4, "data": p.bytes, "tokens": p.array(p.address), "amounts": p.array(p.uint256)})}, p.struct({"tokens": p.array(p.address), "amounts": p.array(p.uint256), "result": p.bytes})),
    moveToDappMerkle: fun("0xeb92c573", "moveToDappMerkle((address,bytes4,bytes,(uint256,address[],uint256[],uint256[],bytes32[][],uint256[])))", {"_contractCall": p.struct({"contractAddress": p.address, "functionSignature": p.bytes4, "data": p.bytes, "claim": p.struct({"rootIndex": p.uint256, "tokens": p.array(p.address), "leafAmounts": p.array(p.uint256), "transferAmounts": p.array(p.uint256), "proofs": p.array(p.array(p.bytes32)), "migrationEventIds": p.array(p.uint256)})})}, p.struct({"tokens": p.array(p.address), "amounts": p.array(p.uint256), "result": p.bytes})),
    moveToDappMerkleWithSig: fun("0x4f5be126", "moveToDappMerkleWithSig(address[],(address,bytes4,bytes,(uint256,address[],uint256[],uint256[],bytes32[][],uint256[]))[],uint256[],bytes[])", {"_users": p.array(p.address), "_contractCalls": p.array(p.struct({"contractAddress": p.address, "functionSignature": p.bytes4, "data": p.bytes, "claim": p.struct({"rootIndex": p.uint256, "tokens": p.array(p.address), "leafAmounts": p.array(p.uint256), "transferAmounts": p.array(p.uint256), "proofs": p.array(p.array(p.bytes32)), "migrationEventIds": p.array(p.uint256)})})), "_signatureExpiries": p.array(p.uint256), "_signatures": p.array(p.bytes)}, p.array(p.struct({"tokens": p.array(p.address), "amounts": p.array(p.uint256), "result": p.bytes}))),
    moveToDappWithSig: fun("0x23c50c15", "moveToDappWithSig(address[],(address,bytes4,bytes,address[],uint256[])[],uint256[],bytes[])", {"_users": p.array(p.address), "_contractCalls": p.array(p.struct({"contractAddress": p.address, "functionSignature": p.bytes4, "data": p.bytes, "tokens": p.array(p.address), "amounts": p.array(p.uint256)})), "_signatureExpiries": p.array(p.uint256), "_signatures": p.array(p.bytes)}, p.array(p.struct({"tokens": p.array(p.address), "amounts": p.array(p.uint256), "result": p.bytes}))),
    nonces: viewFun("0x7ecebe00", "nonces(address)", {"owner": p.address}, p.uint256),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    pause: fun("0x8456cb59", "pause()", {}, ),
    paused: viewFun("0x5c975abb", "paused()", {}, p.bool),
    pendingOwner: viewFun("0xe30c3978", "pendingOwner()", {}, p.address),
    removeFunction: fun("0xb9495800", "removeFunction(address,bytes4)", {"_contractAddress": p.address, "_functionSignature": p.bytes4}, ),
    renounceOwnership: fun("0x715018a6", "renounceOwnership()", {}, ),
    setLeafClaimed: fun("0x04a82a3f", "setLeafClaimed(uint256,bytes32)", {"_index": p.uint256, "_leaf": p.bytes32}, ),
    setMerkleRoot: fun("0x18712c21", "setMerkleRoot(uint256,bytes32)", {"_index": p.uint256, "_merkleRoot": p.bytes32}, ),
    setRootStatus: fun("0x4aa852e6", "setRootStatus(uint256,bool)", {"_index": p.uint256, "_disabled": p.bool}, ),
    setStakable: fun("0xe63b81a6", "setStakable(address,bool)", {"_token": p.address, "_canStake": p.bool}, ),
    tokenAllowlist: viewFun("0x8135369a", "tokenAllowlist(address)", {"_0": p.address}, p.bool),
    totalBalance: viewFun("0x6eacd398", "totalBalance(address)", {"_0": p.address}, p.uint256),
    transferOwnership: fun("0xf2fde38b", "transferOwnership(address)", {"newOwner": p.address}, ),
    unpause: fun("0x3f4ba83a", "unpause()", {}, ),
    weth: viewFun("0x3fc8cef3", "weth()", {}, p.address),
    withdraw: fun("0xf3fef3a3", "withdraw(address,uint256)", {"_token": p.address, "_amount": p.uint256}, ),
    withdrawMerkle: fun("0x287d5623", "withdrawMerkle((uint256,address[],uint256[],uint256[],bytes32[][],uint256[]))", {"_claim": p.struct({"rootIndex": p.uint256, "tokens": p.array(p.address), "leafAmounts": p.array(p.uint256), "transferAmounts": p.array(p.uint256), "proofs": p.array(p.array(p.bytes32)), "migrationEventIds": p.array(p.uint256)})}, ),
}

export class Contract extends ContractBase {

    MOVE_TO_DAPP_MERKLE_TYPEHASH() {
        return this.eth_call(functions.MOVE_TO_DAPP_MERKLE_TYPEHASH, {})
    }

    MOVE_TO_DAPP_TYPEHASH() {
        return this.eth_call(functions.MOVE_TO_DAPP_TYPEHASH, {})
    }

    balance(_0: BalanceParams["_0"], _1: BalanceParams["_1"]) {
        return this.eth_call(functions.balance, {_0, _1})
    }

    claimed(_0: ClaimedParams["_0"], _1: ClaimedParams["_1"]) {
        return this.eth_call(functions.claimed, {_0, _1})
    }

    eip712Domain() {
        return this.eth_call(functions.eip712Domain, {})
    }

    eventId() {
        return this.eth_call(functions.eventId, {})
    }

    functionAllowlist(_0: FunctionAllowlistParams["_0"], _1: FunctionAllowlistParams["_1"]) {
        return this.eth_call(functions.functionAllowlist, {_0, _1})
    }

    merkleRootDisabled(_0: MerkleRootDisabledParams["_0"]) {
        return this.eth_call(functions.merkleRootDisabled, {_0})
    }

    merkleRoots(_0: MerkleRootsParams["_0"]) {
        return this.eth_call(functions.merkleRoots, {_0})
    }

    nonces(owner: NoncesParams["owner"]) {
        return this.eth_call(functions.nonces, {owner})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    paused() {
        return this.eth_call(functions.paused, {})
    }

    pendingOwner() {
        return this.eth_call(functions.pendingOwner, {})
    }

    tokenAllowlist(_0: TokenAllowlistParams["_0"]) {
        return this.eth_call(functions.tokenAllowlist, {_0})
    }

    totalBalance(_0: TotalBalanceParams["_0"]) {
        return this.eth_call(functions.totalBalance, {_0})
    }

    weth() {
        return this.eth_call(functions.weth, {})
    }
}

/// Event types
export type BlocklistChangedEventArgs = EParams<typeof events.BlocklistChanged>
export type DepositEventArgs = EParams<typeof events.Deposit>
export type EIP712DomainChangedEventArgs = EParams<typeof events.EIP712DomainChanged>
export type FunctionAddedEventArgs = EParams<typeof events.FunctionAdded>
export type FunctionRemovedEventArgs = EParams<typeof events.FunctionRemoved>
export type MerkleRootSetEventArgs = EParams<typeof events.MerkleRootSet>
export type MoveToDappEventArgs = EParams<typeof events.MoveToDapp>
export type MoveToDappMerkleEventArgs = EParams<typeof events.MoveToDappMerkle>
export type OwnershipTransferStartedEventArgs = EParams<typeof events.OwnershipTransferStarted>
export type OwnershipTransferredEventArgs = EParams<typeof events.OwnershipTransferred>
export type PausedEventArgs = EParams<typeof events.Paused>
export type RootStatusSetEventArgs = EParams<typeof events.RootStatusSet>
export type SetLeafClaimedEventArgs = EParams<typeof events.SetLeafClaimed>
export type TokenStakabilityChangedEventArgs = EParams<typeof events.TokenStakabilityChanged>
export type UnpausedEventArgs = EParams<typeof events.Unpaused>
export type WithdrawEventArgs = EParams<typeof events.Withdraw>
export type WithdrawMerkleEventArgs = EParams<typeof events.WithdrawMerkle>

/// Function types
export type MOVE_TO_DAPP_MERKLE_TYPEHASHParams = FunctionArguments<typeof functions.MOVE_TO_DAPP_MERKLE_TYPEHASH>
export type MOVE_TO_DAPP_MERKLE_TYPEHASHReturn = FunctionReturn<typeof functions.MOVE_TO_DAPP_MERKLE_TYPEHASH>

export type MOVE_TO_DAPP_TYPEHASHParams = FunctionArguments<typeof functions.MOVE_TO_DAPP_TYPEHASH>
export type MOVE_TO_DAPP_TYPEHASHReturn = FunctionReturn<typeof functions.MOVE_TO_DAPP_TYPEHASH>

export type AcceptOwnershipParams = FunctionArguments<typeof functions.acceptOwnership>
export type AcceptOwnershipReturn = FunctionReturn<typeof functions.acceptOwnership>

export type AddFunctionParams = FunctionArguments<typeof functions.addFunction>
export type AddFunctionReturn = FunctionReturn<typeof functions.addFunction>

export type BalanceParams = FunctionArguments<typeof functions.balance>
export type BalanceReturn = FunctionReturn<typeof functions.balance>

export type BatchDepositForParams = FunctionArguments<typeof functions.batchDepositFor>
export type BatchDepositForReturn = FunctionReturn<typeof functions.batchDepositFor>

export type ClaimedParams = FunctionArguments<typeof functions.claimed>
export type ClaimedReturn = FunctionReturn<typeof functions.claimed>

export type DepositETHForParams = FunctionArguments<typeof functions.depositETHFor>
export type DepositETHForReturn = FunctionReturn<typeof functions.depositETHFor>

export type DepositForParams = FunctionArguments<typeof functions.depositFor>
export type DepositForReturn = FunctionReturn<typeof functions.depositFor>

export type Eip712DomainParams = FunctionArguments<typeof functions.eip712Domain>
export type Eip712DomainReturn = FunctionReturn<typeof functions.eip712Domain>

export type EventIdParams = FunctionArguments<typeof functions.eventId>
export type EventIdReturn = FunctionReturn<typeof functions.eventId>

export type FunctionAllowlistParams = FunctionArguments<typeof functions.functionAllowlist>
export type FunctionAllowlistReturn = FunctionReturn<typeof functions.functionAllowlist>

export type MerkleRootDisabledParams = FunctionArguments<typeof functions.merkleRootDisabled>
export type MerkleRootDisabledReturn = FunctionReturn<typeof functions.merkleRootDisabled>

export type MerkleRootsParams = FunctionArguments<typeof functions.merkleRoots>
export type MerkleRootsReturn = FunctionReturn<typeof functions.merkleRoots>

export type MoveToDappParams = FunctionArguments<typeof functions.moveToDapp>
export type MoveToDappReturn = FunctionReturn<typeof functions.moveToDapp>

export type MoveToDappMerkleParams = FunctionArguments<typeof functions.moveToDappMerkle>
export type MoveToDappMerkleReturn = FunctionReturn<typeof functions.moveToDappMerkle>

export type MoveToDappMerkleWithSigParams = FunctionArguments<typeof functions.moveToDappMerkleWithSig>
export type MoveToDappMerkleWithSigReturn = FunctionReturn<typeof functions.moveToDappMerkleWithSig>

export type MoveToDappWithSigParams = FunctionArguments<typeof functions.moveToDappWithSig>
export type MoveToDappWithSigReturn = FunctionReturn<typeof functions.moveToDappWithSig>

export type NoncesParams = FunctionArguments<typeof functions.nonces>
export type NoncesReturn = FunctionReturn<typeof functions.nonces>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type PauseParams = FunctionArguments<typeof functions.pause>
export type PauseReturn = FunctionReturn<typeof functions.pause>

export type PausedParams = FunctionArguments<typeof functions.paused>
export type PausedReturn = FunctionReturn<typeof functions.paused>

export type PendingOwnerParams = FunctionArguments<typeof functions.pendingOwner>
export type PendingOwnerReturn = FunctionReturn<typeof functions.pendingOwner>

export type RemoveFunctionParams = FunctionArguments<typeof functions.removeFunction>
export type RemoveFunctionReturn = FunctionReturn<typeof functions.removeFunction>

export type RenounceOwnershipParams = FunctionArguments<typeof functions.renounceOwnership>
export type RenounceOwnershipReturn = FunctionReturn<typeof functions.renounceOwnership>

export type SetLeafClaimedParams = FunctionArguments<typeof functions.setLeafClaimed>
export type SetLeafClaimedReturn = FunctionReturn<typeof functions.setLeafClaimed>

export type SetMerkleRootParams = FunctionArguments<typeof functions.setMerkleRoot>
export type SetMerkleRootReturn = FunctionReturn<typeof functions.setMerkleRoot>

export type SetRootStatusParams = FunctionArguments<typeof functions.setRootStatus>
export type SetRootStatusReturn = FunctionReturn<typeof functions.setRootStatus>

export type SetStakableParams = FunctionArguments<typeof functions.setStakable>
export type SetStakableReturn = FunctionReturn<typeof functions.setStakable>

export type TokenAllowlistParams = FunctionArguments<typeof functions.tokenAllowlist>
export type TokenAllowlistReturn = FunctionReturn<typeof functions.tokenAllowlist>

export type TotalBalanceParams = FunctionArguments<typeof functions.totalBalance>
export type TotalBalanceReturn = FunctionReturn<typeof functions.totalBalance>

export type TransferOwnershipParams = FunctionArguments<typeof functions.transferOwnership>
export type TransferOwnershipReturn = FunctionReturn<typeof functions.transferOwnership>

export type UnpauseParams = FunctionArguments<typeof functions.unpause>
export type UnpauseReturn = FunctionReturn<typeof functions.unpause>

export type WethParams = FunctionArguments<typeof functions.weth>
export type WethReturn = FunctionReturn<typeof functions.weth>

export type WithdrawParams = FunctionArguments<typeof functions.withdraw>
export type WithdrawReturn = FunctionReturn<typeof functions.withdraw>

export type WithdrawMerkleParams = FunctionArguments<typeof functions.withdrawMerkle>
export type WithdrawMerkleReturn = FunctionReturn<typeof functions.withdrawMerkle>

