import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    InterchainTransfer: event("0x493ac40086ceccfdc54d94ef1294f8aa5e237e8dd2b5bbe5cedebec69da5d93e", "InterchainTransfer(bytes32,address,address,string,bytes,uint256)", {"tokenId": indexed(p.bytes32), "tokenAddress": indexed(p.address), "sourceAddress": indexed(p.address), "destinationChain": p.string, "destinationAddress": p.bytes, "amount": p.uint256}),
    TradingFeeUpdated: event("0x7825572dbd74695e701a97bba698c94aa15a9d198c335c92d5abc2b9b81bbc7d", "TradingFeeUpdated(uint16)", {"fee": p.uint16}),
}

export const functions = {
    broadcastInterchainTransfer: fun("0x5b9a77e4", "broadcastInterchainTransfer(bytes32,address,string,bytes,uint256)", {"tokenId": p.bytes32, "sourceAddress": p.address, "destinationChain": p.string, "destinationAddress": p.bytes, "amount": p.uint256}, ),
    currentChainHash: viewFun("0x3efb10ea", "currentChainHash()", {}, p.bytes32),
    getCurve: viewFun("0x61f029fb", "getCurve(address)", {"token": p.address}, p.struct({"basePair": p.address, "totalCurves": p.uint16, "maxTokenSupply": p.uint256, "virtualReserve": p.uint256, "reserve": p.uint256, "completionThreshold": p.uint256})),
    getInterchainTokenId: viewFun("0x6a4a3d54", "getInterchainTokenId((bytes32,bytes,bytes32,bytes32,bytes32,bytes32[],bytes32[],bytes))", {"tokenParams": p.struct({"salt": p.bytes32, "creatorAddresses": p.bytes, "name": p.bytes32, "symbol": p.bytes32, "packedParams": p.bytes32, "chains": p.array(p.bytes32), "basePairs": p.array(p.bytes32), "basePrices": p.bytes})}, p.bytes32),
    getLiquidityLocks: viewFun("0x0479668b", "getLiquidityLocks(address)", {"token": p.address}, p.fixedSizeArray(p.uint256, 2)),
    getProtocolFees: viewFun("0xf27dd8ab", "getProtocolFees(address)", {"token": p.address}, p.uint256),
    getTokenAddress: viewFun("0xd4074932", "getTokenAddress((bytes32,bytes,bytes32,bytes32,bytes32,bytes32[],bytes32[],bytes))", {"tokenParams": p.struct({"salt": p.bytes32, "creatorAddresses": p.bytes, "name": p.bytes32, "symbol": p.bytes32, "packedParams": p.bytes32, "chains": p.array(p.bytes32), "basePairs": p.array(p.bytes32), "basePrices": p.bytes})}, p.address),
    getTradingFee: viewFun("0x1bd8db03", "getTradingFee()", {}, p.uint16),
    getTreasury: viewFun("0x3b19e84a", "getTreasury()", {}, p.address),
    its: viewFun("0x2224a234", "its()", {}, p.address),
    itsFactory: viewFun("0x1508da30", "itsFactory()", {}, p.address),
    linkEvmInterchainToken: fun("0x71fc68b3", "linkEvmInterchainToken((bytes32,bytes,bytes32,bytes32,bytes32,bytes32[],bytes32[],bytes),string)", {"tokenParams": p.struct({"salt": p.bytes32, "creatorAddresses": p.bytes, "name": p.bytes32, "symbol": p.bytes32, "packedParams": p.bytes32, "chains": p.array(p.bytes32), "basePairs": p.array(p.bytes32), "basePrices": p.bytes}), "destinationChain": p.string}, ),
    liquidityModule: viewFun("0x400b6cdc", "liquidityModule()", {}, p.address),
    locker: viewFun("0xd7b96d4e", "locker()", {}, p.address),
    pause: fun("0x8456cb59", "pause()", {}, ),
    registerInterchainToken: fun("0x76a64187", "registerInterchainToken((bytes32,bytes,bytes32,bytes32,bytes32,bytes32[],bytes32[],bytes))", {"tokenParams": p.struct({"salt": p.bytes32, "creatorAddresses": p.bytes, "name": p.bytes32, "symbol": p.bytes32, "packedParams": p.bytes32, "chains": p.array(p.bytes32), "basePairs": p.array(p.bytes32), "basePrices": p.bytes})}, ),
    setTradingFee: fun("0x60b778f5", "setTradingFee(uint16)", {"fee": p.uint16}, ),
    tokenFactory: viewFun("0xe77772fe", "tokenFactory()", {}, p.address),
    unpause: fun("0x3f4ba83a", "unpause()", {}, ),
    wrappedNativeToken: viewFun("0x17fcb39b", "wrappedNativeToken()", {}, p.address),
}

export class Contract extends ContractBase {

    currentChainHash() {
        return this.eth_call(functions.currentChainHash, {})
    }

    getCurve(token: GetCurveParams["token"]) {
        return this.eth_call(functions.getCurve, {token})
    }

    getInterchainTokenId(tokenParams: GetInterchainTokenIdParams["tokenParams"]) {
        return this.eth_call(functions.getInterchainTokenId, {tokenParams})
    }

    getLiquidityLocks(token: GetLiquidityLocksParams["token"]) {
        return this.eth_call(functions.getLiquidityLocks, {token})
    }

    getProtocolFees(token: GetProtocolFeesParams["token"]) {
        return this.eth_call(functions.getProtocolFees, {token})
    }

    getTokenAddress(tokenParams: GetTokenAddressParams["tokenParams"]) {
        return this.eth_call(functions.getTokenAddress, {tokenParams})
    }

    getTradingFee() {
        return this.eth_call(functions.getTradingFee, {})
    }

    getTreasury() {
        return this.eth_call(functions.getTreasury, {})
    }

    its() {
        return this.eth_call(functions.its, {})
    }

    itsFactory() {
        return this.eth_call(functions.itsFactory, {})
    }

    liquidityModule() {
        return this.eth_call(functions.liquidityModule, {})
    }

    locker() {
        return this.eth_call(functions.locker, {})
    }

    tokenFactory() {
        return this.eth_call(functions.tokenFactory, {})
    }

    wrappedNativeToken() {
        return this.eth_call(functions.wrappedNativeToken, {})
    }
}

/// Event types
export type InterchainTransferEventArgs = EParams<typeof events.InterchainTransfer>
export type TradingFeeUpdatedEventArgs = EParams<typeof events.TradingFeeUpdated>

/// Function types
export type BroadcastInterchainTransferParams = FunctionArguments<typeof functions.broadcastInterchainTransfer>
export type BroadcastInterchainTransferReturn = FunctionReturn<typeof functions.broadcastInterchainTransfer>

export type CurrentChainHashParams = FunctionArguments<typeof functions.currentChainHash>
export type CurrentChainHashReturn = FunctionReturn<typeof functions.currentChainHash>

export type GetCurveParams = FunctionArguments<typeof functions.getCurve>
export type GetCurveReturn = FunctionReturn<typeof functions.getCurve>

export type GetInterchainTokenIdParams = FunctionArguments<typeof functions.getInterchainTokenId>
export type GetInterchainTokenIdReturn = FunctionReturn<typeof functions.getInterchainTokenId>

export type GetLiquidityLocksParams = FunctionArguments<typeof functions.getLiquidityLocks>
export type GetLiquidityLocksReturn = FunctionReturn<typeof functions.getLiquidityLocks>

export type GetProtocolFeesParams = FunctionArguments<typeof functions.getProtocolFees>
export type GetProtocolFeesReturn = FunctionReturn<typeof functions.getProtocolFees>

export type GetTokenAddressParams = FunctionArguments<typeof functions.getTokenAddress>
export type GetTokenAddressReturn = FunctionReturn<typeof functions.getTokenAddress>

export type GetTradingFeeParams = FunctionArguments<typeof functions.getTradingFee>
export type GetTradingFeeReturn = FunctionReturn<typeof functions.getTradingFee>

export type GetTreasuryParams = FunctionArguments<typeof functions.getTreasury>
export type GetTreasuryReturn = FunctionReturn<typeof functions.getTreasury>

export type ItsParams = FunctionArguments<typeof functions.its>
export type ItsReturn = FunctionReturn<typeof functions.its>

export type ItsFactoryParams = FunctionArguments<typeof functions.itsFactory>
export type ItsFactoryReturn = FunctionReturn<typeof functions.itsFactory>

export type LinkEvmInterchainTokenParams = FunctionArguments<typeof functions.linkEvmInterchainToken>
export type LinkEvmInterchainTokenReturn = FunctionReturn<typeof functions.linkEvmInterchainToken>

export type LiquidityModuleParams = FunctionArguments<typeof functions.liquidityModule>
export type LiquidityModuleReturn = FunctionReturn<typeof functions.liquidityModule>

export type LockerParams = FunctionArguments<typeof functions.locker>
export type LockerReturn = FunctionReturn<typeof functions.locker>

export type PauseParams = FunctionArguments<typeof functions.pause>
export type PauseReturn = FunctionReturn<typeof functions.pause>

export type RegisterInterchainTokenParams = FunctionArguments<typeof functions.registerInterchainToken>
export type RegisterInterchainTokenReturn = FunctionReturn<typeof functions.registerInterchainToken>

export type SetTradingFeeParams = FunctionArguments<typeof functions.setTradingFee>
export type SetTradingFeeReturn = FunctionReturn<typeof functions.setTradingFee>

export type TokenFactoryParams = FunctionArguments<typeof functions.tokenFactory>
export type TokenFactoryReturn = FunctionReturn<typeof functions.tokenFactory>

export type UnpauseParams = FunctionArguments<typeof functions.unpause>
export type UnpauseReturn = FunctionReturn<typeof functions.unpause>

export type WrappedNativeTokenParams = FunctionArguments<typeof functions.wrappedNativeToken>
export type WrappedNativeTokenReturn = FunctionReturn<typeof functions.wrappedNativeToken>

