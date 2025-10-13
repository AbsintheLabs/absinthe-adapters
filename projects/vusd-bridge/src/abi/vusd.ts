import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    ERC20BridgeFinalized: event("0xd59c65b35445225835c83f50b6ede06a7be047d22e357073e250d9af537518cd", "ERC20BridgeFinalized(address,address,address,address,uint256,bytes)", {"localToken": indexed(p.address), "remoteToken": indexed(p.address), "from": indexed(p.address), "to": p.address, "amount": p.uint256, "extraData": p.bytes}),
    ERC20BridgeInitiated: event("0x7ff126db8024424bbfd9826e8ab82ff59136289ea440b04b39a0df1b03b9cabf", "ERC20BridgeInitiated(address,address,address,address,uint256,bytes)", {"localToken": indexed(p.address), "remoteToken": indexed(p.address), "from": indexed(p.address), "to": p.address, "amount": p.uint256, "extraData": p.bytes}),
    ERC20DepositInitiated: event("0x718594027abd4eaed59f95162563e0cc6d0e8d5b86b1c7be8b1b0ac3343d0396", "ERC20DepositInitiated(address,address,address,address,uint256,bytes)", {"l1Token": indexed(p.address), "l2Token": indexed(p.address), "from": indexed(p.address), "to": p.address, "amount": p.uint256, "extraData": p.bytes}),
    ERC20WithdrawalFinalized: event("0x3ceee06c1e37648fcbb6ed52e17b3e1f275a1f8c7b22a84b2b84732431e046b3", "ERC20WithdrawalFinalized(address,address,address,address,uint256,bytes)", {"l1Token": indexed(p.address), "l2Token": indexed(p.address), "from": indexed(p.address), "to": p.address, "amount": p.uint256, "extraData": p.bytes}),
    ETHBridgeFinalized: event("0x31b2166ff604fc5672ea5df08a78081d2bc6d746cadce880747f3643d819e83d", "ETHBridgeFinalized(address,address,uint256,bytes)", {"from": indexed(p.address), "to": indexed(p.address), "amount": p.uint256, "extraData": p.bytes}),
    ETHBridgeInitiated: event("0x2849b43074093a05396b6f2a937dee8565b15a48a7b3d4bffb732a5017380af5", "ETHBridgeInitiated(address,address,uint256,bytes)", {"from": indexed(p.address), "to": indexed(p.address), "amount": p.uint256, "extraData": p.bytes}),
    ETHDepositInitiated: event("0x35d79ab81f2b2017e19afb5c5571778877782d7a8786f5907f93b0f4702f4f23", "ETHDepositInitiated(address,address,uint256,bytes)", {"from": indexed(p.address), "to": indexed(p.address), "amount": p.uint256, "extraData": p.bytes}),
    ETHWithdrawalFinalized: event("0x2ac69ee804d9a7a0984249f508dfab7cb2534b465b6ce1580f99a38ba9c5e631", "ETHWithdrawalFinalized(address,address,uint256,bytes)", {"from": indexed(p.address), "to": indexed(p.address), "amount": p.uint256, "extraData": p.bytes}),
    Initialized: event("0x7f26b83ff96e1f2b6a682f133852f6798a09c465da95921460cefb3847402498", "Initialized(uint8)", {"version": p.uint8}),
}

export const functions = {
    MESSENGER: viewFun("0x927ede2d", "MESSENGER()", {}, p.address),
    OTHER_BRIDGE: viewFun("0x7f46ddb2", "OTHER_BRIDGE()", {}, p.address),
    bridgeERC20: fun("0x87087623", "bridgeERC20(address,address,uint256,uint32,bytes)", {"_localToken": p.address, "_remoteToken": p.address, "_amount": p.uint256, "_minGasLimit": p.uint32, "_extraData": p.bytes}, ),
    bridgeERC20To: fun("0x540abf73", "bridgeERC20To(address,address,address,uint256,uint32,bytes)", {"_localToken": p.address, "_remoteToken": p.address, "_to": p.address, "_amount": p.uint256, "_minGasLimit": p.uint32, "_extraData": p.bytes}, ),
    bridgeETH: fun("0x09fc8843", "bridgeETH(uint32,bytes)", {"_minGasLimit": p.uint32, "_extraData": p.bytes}, ),
    bridgeETHTo: fun("0xe11013dd", "bridgeETHTo(address,uint32,bytes)", {"_to": p.address, "_minGasLimit": p.uint32, "_extraData": p.bytes}, ),
    depositERC20: fun("0x58a997f6", "depositERC20(address,address,uint256,uint32,bytes)", {"_l1Token": p.address, "_l2Token": p.address, "_amount": p.uint256, "_minGasLimit": p.uint32, "_extraData": p.bytes}, ),
    depositERC20To: fun("0x838b2520", "depositERC20To(address,address,address,uint256,uint32,bytes)", {"_l1Token": p.address, "_l2Token": p.address, "_to": p.address, "_amount": p.uint256, "_minGasLimit": p.uint32, "_extraData": p.bytes}, ),
    depositETH: fun("0xb1a1a882", "depositETH(uint32,bytes)", {"_minGasLimit": p.uint32, "_extraData": p.bytes}, ),
    depositETHTo: fun("0x9a2ac6d5", "depositETHTo(address,uint32,bytes)", {"_to": p.address, "_minGasLimit": p.uint32, "_extraData": p.bytes}, ),
    deposits: viewFun("0x8f601f66", "deposits(address,address)", {"_0": p.address, "_1": p.address}, p.uint256),
    finalizeBridgeERC20: fun("0x0166a07a", "finalizeBridgeERC20(address,address,address,address,uint256,bytes)", {"_localToken": p.address, "_remoteToken": p.address, "_from": p.address, "_to": p.address, "_amount": p.uint256, "_extraData": p.bytes}, ),
    finalizeBridgeETH: fun("0x1635f5fd", "finalizeBridgeETH(address,address,uint256,bytes)", {"_from": p.address, "_to": p.address, "_amount": p.uint256, "_extraData": p.bytes}, ),
    finalizeERC20Withdrawal: fun("0xa9f9e675", "finalizeERC20Withdrawal(address,address,address,address,uint256,bytes)", {"_l1Token": p.address, "_l2Token": p.address, "_from": p.address, "_to": p.address, "_amount": p.uint256, "_extraData": p.bytes}, ),
    finalizeETHWithdrawal: fun("0x1532ec34", "finalizeETHWithdrawal(address,address,uint256,bytes)", {"_from": p.address, "_to": p.address, "_amount": p.uint256, "_extraData": p.bytes}, ),
    initialize: fun("0x485cc955", "initialize(address,address)", {"_messenger": p.address, "_superchainConfig": p.address}, ),
    l2TokenBridge: viewFun("0x91c49bf8", "l2TokenBridge()", {}, p.address),
    messenger: viewFun("0x3cb747bf", "messenger()", {}, p.address),
    otherBridge: viewFun("0xc89701a2", "otherBridge()", {}, p.address),
    paused: viewFun("0x5c975abb", "paused()", {}, p.bool),
    superchainConfig: viewFun("0x35e80ab3", "superchainConfig()", {}, p.address),
    version: viewFun("0x54fd4d50", "version()", {}, p.string),
}

export class Contract extends ContractBase {

    MESSENGER() {
        return this.eth_call(functions.MESSENGER, {})
    }

    OTHER_BRIDGE() {
        return this.eth_call(functions.OTHER_BRIDGE, {})
    }

    deposits(_0: DepositsParams["_0"], _1: DepositsParams["_1"]) {
        return this.eth_call(functions.deposits, {_0, _1})
    }

    l2TokenBridge() {
        return this.eth_call(functions.l2TokenBridge, {})
    }

    messenger() {
        return this.eth_call(functions.messenger, {})
    }

    otherBridge() {
        return this.eth_call(functions.otherBridge, {})
    }

    paused() {
        return this.eth_call(functions.paused, {})
    }

    superchainConfig() {
        return this.eth_call(functions.superchainConfig, {})
    }

    version() {
        return this.eth_call(functions.version, {})
    }
}

/// Event types
export type ERC20BridgeFinalizedEventArgs = EParams<typeof events.ERC20BridgeFinalized>
export type ERC20BridgeInitiatedEventArgs = EParams<typeof events.ERC20BridgeInitiated>
export type ERC20DepositInitiatedEventArgs = EParams<typeof events.ERC20DepositInitiated>
export type ERC20WithdrawalFinalizedEventArgs = EParams<typeof events.ERC20WithdrawalFinalized>
export type ETHBridgeFinalizedEventArgs = EParams<typeof events.ETHBridgeFinalized>
export type ETHBridgeInitiatedEventArgs = EParams<typeof events.ETHBridgeInitiated>
export type ETHDepositInitiatedEventArgs = EParams<typeof events.ETHDepositInitiated>
export type ETHWithdrawalFinalizedEventArgs = EParams<typeof events.ETHWithdrawalFinalized>
export type InitializedEventArgs = EParams<typeof events.Initialized>

/// Function types
export type MESSENGERParams = FunctionArguments<typeof functions.MESSENGER>
export type MESSENGERReturn = FunctionReturn<typeof functions.MESSENGER>

export type OTHER_BRIDGEParams = FunctionArguments<typeof functions.OTHER_BRIDGE>
export type OTHER_BRIDGEReturn = FunctionReturn<typeof functions.OTHER_BRIDGE>

export type BridgeERC20Params = FunctionArguments<typeof functions.bridgeERC20>
export type BridgeERC20Return = FunctionReturn<typeof functions.bridgeERC20>

export type BridgeERC20ToParams = FunctionArguments<typeof functions.bridgeERC20To>
export type BridgeERC20ToReturn = FunctionReturn<typeof functions.bridgeERC20To>

export type BridgeETHParams = FunctionArguments<typeof functions.bridgeETH>
export type BridgeETHReturn = FunctionReturn<typeof functions.bridgeETH>

export type BridgeETHToParams = FunctionArguments<typeof functions.bridgeETHTo>
export type BridgeETHToReturn = FunctionReturn<typeof functions.bridgeETHTo>

export type DepositERC20Params = FunctionArguments<typeof functions.depositERC20>
export type DepositERC20Return = FunctionReturn<typeof functions.depositERC20>

export type DepositERC20ToParams = FunctionArguments<typeof functions.depositERC20To>
export type DepositERC20ToReturn = FunctionReturn<typeof functions.depositERC20To>

export type DepositETHParams = FunctionArguments<typeof functions.depositETH>
export type DepositETHReturn = FunctionReturn<typeof functions.depositETH>

export type DepositETHToParams = FunctionArguments<typeof functions.depositETHTo>
export type DepositETHToReturn = FunctionReturn<typeof functions.depositETHTo>

export type DepositsParams = FunctionArguments<typeof functions.deposits>
export type DepositsReturn = FunctionReturn<typeof functions.deposits>

export type FinalizeBridgeERC20Params = FunctionArguments<typeof functions.finalizeBridgeERC20>
export type FinalizeBridgeERC20Return = FunctionReturn<typeof functions.finalizeBridgeERC20>

export type FinalizeBridgeETHParams = FunctionArguments<typeof functions.finalizeBridgeETH>
export type FinalizeBridgeETHReturn = FunctionReturn<typeof functions.finalizeBridgeETH>

export type FinalizeERC20WithdrawalParams = FunctionArguments<typeof functions.finalizeERC20Withdrawal>
export type FinalizeERC20WithdrawalReturn = FunctionReturn<typeof functions.finalizeERC20Withdrawal>

export type FinalizeETHWithdrawalParams = FunctionArguments<typeof functions.finalizeETHWithdrawal>
export type FinalizeETHWithdrawalReturn = FunctionReturn<typeof functions.finalizeETHWithdrawal>

export type InitializeParams = FunctionArguments<typeof functions.initialize>
export type InitializeReturn = FunctionReturn<typeof functions.initialize>

export type L2TokenBridgeParams = FunctionArguments<typeof functions.l2TokenBridge>
export type L2TokenBridgeReturn = FunctionReturn<typeof functions.l2TokenBridge>

export type MessengerParams = FunctionArguments<typeof functions.messenger>
export type MessengerReturn = FunctionReturn<typeof functions.messenger>

export type OtherBridgeParams = FunctionArguments<typeof functions.otherBridge>
export type OtherBridgeReturn = FunctionReturn<typeof functions.otherBridge>

export type PausedParams = FunctionArguments<typeof functions.paused>
export type PausedReturn = FunctionReturn<typeof functions.paused>

export type SuperchainConfigParams = FunctionArguments<typeof functions.superchainConfig>
export type SuperchainConfigReturn = FunctionReturn<typeof functions.superchainConfig>

export type VersionParams = FunctionArguments<typeof functions.version>
export type VersionReturn = FunctionReturn<typeof functions.version>

