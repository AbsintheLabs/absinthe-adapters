import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    CurveCreated: event("0xba476d0e4131eb62758cae024f971a6a6e5a5e21dfde233750bba5427901d2b3", "CurveCreated(address,address,bytes32)", {"creator": indexed(p.address), "token": indexed(p.address), "tokenId": indexed(p.bytes32)}),
    LiquidityDeployed: event("0x944842efc7ccc582eafec3351b838ed21e5aed8afabc94fb83a6b18b052697a4", "LiquidityDeployed(address,uint256,uint256)", {"token": indexed(p.address), "tokenAmount": p.uint256, "baseAmount": p.uint256}),
    LiquidityLocked: event("0x59d86badba9ed0836e2f7433321f97c74d9825a883e2315b54e1a86177795486", "LiquidityLocked(address,address,uint256,uint256)", {"token": indexed(p.address), "positionManager": indexed(p.address), "positionId": p.uint256, "lockId": p.uint256}),
    TokenDeployed: event("0x2e90ed431e23f7e363af7d2e69461e22b648cc99c034731f7f1fa247e74fcd64", "TokenDeployed(address,bytes32)", {"token": indexed(p.address), "tokenId": indexed(p.bytes32)}),
    TokenTrade: event("0x5c89aca078c4c42425a601eb984e720e9ea11723c9c40088f37fa5c68b0dddf6", "TokenTrade(address,address,bool,uint256,uint256,uint256,uint256,uint256)", {"token": indexed(p.address), "trader": indexed(p.address), "isBuy": p.bool, "amount": p.uint256, "cost": p.uint256, "effectivePrice": p.uint256, "mintedSupply": p.uint256, "reserve": p.uint256}),
}

export const functions = {
    DOMAIN_SEPARATOR: viewFun("0x3644e515", "DOMAIN_SEPARATOR()", {}, p.bytes32),
    REMOTE_SELL_TYPEHASH: viewFun("0xddfa4c89", "REMOTE_SELL_TYPEHASH()", {}, p.bytes32),
    SIGNED_CANCEL_SELL_TYPEHASH: viewFun("0x0ada50dd", "SIGNED_CANCEL_SELL_TYPEHASH()", {}, p.bytes32),
    SIGNED_REMOTE_SELL_TYPEHASH: viewFun("0x9c5b0ac7", "SIGNED_REMOTE_SELL_TYPEHASH()", {}, p.bytes32),
    buy: fun("0xa9d424e2", "buy(address,address,uint256,uint256)", {"token": p.address, "recipient": p.address, "amount": p.uint256, "maxPrice": p.uint256}, p.struct({"account": p.address, "recipient": p.address, "token": p.address, "amount": p.uint256, "priceLimit": p.uint256, "tradingFee": p.uint16})),
    cancelRemoteSell: fun("0x778716ce", "cancelRemoteSell((bytes32,address),bytes)", {"cancel": p.struct({"salt": p.bytes32, "owner": p.address}), "signature": p.bytes}, ),
    createToken: fun("0xcbf54d94", "createToken(uint256,(bytes32,bytes,bytes32,bytes32,bytes32,bytes32[],bytes32[],bytes))", {"initialSpending": p.uint256, "tokenParams": p.struct({"salt": p.bytes32, "creatorAddresses": p.bytes, "name": p.bytes32, "symbol": p.bytes32, "packedParams": p.bytes32, "chains": p.array(p.bytes32), "basePairs": p.array(p.bytes32), "basePrices": p.bytes})}, {"tokenAddress": p.address, "tokenId": p.bytes32}),
    currentChainHash: viewFun("0x3efb10ea", "currentChainHash()", {}, p.bytes32),
    estimateTokenCost: viewFun("0x8c509739", "estimateTokenCost(address,uint256)", {"token": p.address, "tokenAmount": p.uint256}, {"availableAmount": p.uint256, "cost": p.uint256, "fee": p.uint256, "effectivePrice": p.uint256, "mintedSupply": p.uint256}),
    estimateTokenRefund: viewFun("0x93b70d63", "estimateTokenRefund(address,uint256)", {"token": p.address, "tokenAmount": p.uint256}, {"refund": p.uint256, "fee": p.uint256, "effectivePrice": p.uint256, "mintedSupply": p.uint256}),
    its: viewFun("0x2224a234", "its()", {}, p.address),
    itsFactory: viewFun("0x1508da30", "itsFactory()", {}, p.address),
    liquidityModule: viewFun("0x400b6cdc", "liquidityModule()", {}, p.address),
    locker: viewFun("0xd7b96d4e", "locker()", {}, p.address),
    quoteTokenAmount: viewFun("0xf359b59d", "quoteTokenAmount(address,uint256)", {"token": p.address, "baseAmount": p.uint256}, {"tokenAmount": p.uint256, "cost": p.uint256, "fee": p.uint256, "effectivePrice": p.uint256, "mintedSupply": p.uint256}),
    sell: fun("0x31de7d15", "sell(address,address,uint256,uint256)", {"token": p.address, "recipient": p.address, "amount": p.uint256, "minPrice": p.uint256}, p.struct({"account": p.address, "recipient": p.address, "token": p.address, "amount": p.uint256, "priceLimit": p.uint256, "tradingFee": p.uint16})),
    sellRemotely: fun("0x61e20461", "sellRemotely((address,uint256,uint256),(bytes32,address,address,uint256,bytes32[]),bytes)", {"remoteSell": p.struct({"token": p.address, "amount": p.uint256, "minPrice": p.uint256}), "signed": p.struct({"salt": p.bytes32, "owner": p.address, "recipient": p.address, "deadline": p.uint256, "remoteSellHashes": p.array(p.bytes32)}), "signature": p.bytes}, p.struct({"account": p.address, "recipient": p.address, "token": p.address, "amount": p.uint256, "priceLimit": p.uint256, "tradingFee": p.uint16})),
    spend: fun("0x8b8e0671", "spend(address,address,uint256,uint256)", {"token": p.address, "recipient": p.address, "baseAmount": p.uint256, "maxPrice": p.uint256}, p.struct({"account": p.address, "recipient": p.address, "token": p.address, "amount": p.uint256, "priceLimit": p.uint256, "tradingFee": p.uint16})),
    spendRemotely: fun("0xb318ef07", "spendRemotely(address,address,uint256,uint256,string)", {"token": p.address, "recipient": p.address, "baseSpend": p.uint256, "maxPrice": p.uint256, "chain": p.string}, p.struct({"account": p.address, "recipient": p.address, "token": p.address, "amount": p.uint256, "priceLimit": p.uint256, "tradingFee": p.uint16})),
    tokenFactory: viewFun("0xe77772fe", "tokenFactory()", {}, p.address),
    wrappedNativeToken: viewFun("0x17fcb39b", "wrappedNativeToken()", {}, p.address),
}

export class Contract extends ContractBase {

    DOMAIN_SEPARATOR() {
        return this.eth_call(functions.DOMAIN_SEPARATOR, {})
    }

    REMOTE_SELL_TYPEHASH() {
        return this.eth_call(functions.REMOTE_SELL_TYPEHASH, {})
    }

    SIGNED_CANCEL_SELL_TYPEHASH() {
        return this.eth_call(functions.SIGNED_CANCEL_SELL_TYPEHASH, {})
    }

    SIGNED_REMOTE_SELL_TYPEHASH() {
        return this.eth_call(functions.SIGNED_REMOTE_SELL_TYPEHASH, {})
    }

    currentChainHash() {
        return this.eth_call(functions.currentChainHash, {})
    }

    estimateTokenCost(token: EstimateTokenCostParams["token"], tokenAmount: EstimateTokenCostParams["tokenAmount"]) {
        return this.eth_call(functions.estimateTokenCost, {token, tokenAmount})
    }

    estimateTokenRefund(token: EstimateTokenRefundParams["token"], tokenAmount: EstimateTokenRefundParams["tokenAmount"]) {
        return this.eth_call(functions.estimateTokenRefund, {token, tokenAmount})
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

    quoteTokenAmount(token: QuoteTokenAmountParams["token"], baseAmount: QuoteTokenAmountParams["baseAmount"]) {
        return this.eth_call(functions.quoteTokenAmount, {token, baseAmount})
    }

    tokenFactory() {
        return this.eth_call(functions.tokenFactory, {})
    }

    wrappedNativeToken() {
        return this.eth_call(functions.wrappedNativeToken, {})
    }
}

/// Event types
export type CurveCreatedEventArgs = EParams<typeof events.CurveCreated>
export type LiquidityDeployedEventArgs = EParams<typeof events.LiquidityDeployed>
export type LiquidityLockedEventArgs = EParams<typeof events.LiquidityLocked>
export type TokenDeployedEventArgs = EParams<typeof events.TokenDeployed>
export type TokenTradeEventArgs = EParams<typeof events.TokenTrade>

/// Function types
export type DOMAIN_SEPARATORParams = FunctionArguments<typeof functions.DOMAIN_SEPARATOR>
export type DOMAIN_SEPARATORReturn = FunctionReturn<typeof functions.DOMAIN_SEPARATOR>

export type REMOTE_SELL_TYPEHASHParams = FunctionArguments<typeof functions.REMOTE_SELL_TYPEHASH>
export type REMOTE_SELL_TYPEHASHReturn = FunctionReturn<typeof functions.REMOTE_SELL_TYPEHASH>

export type SIGNED_CANCEL_SELL_TYPEHASHParams = FunctionArguments<typeof functions.SIGNED_CANCEL_SELL_TYPEHASH>
export type SIGNED_CANCEL_SELL_TYPEHASHReturn = FunctionReturn<typeof functions.SIGNED_CANCEL_SELL_TYPEHASH>

export type SIGNED_REMOTE_SELL_TYPEHASHParams = FunctionArguments<typeof functions.SIGNED_REMOTE_SELL_TYPEHASH>
export type SIGNED_REMOTE_SELL_TYPEHASHReturn = FunctionReturn<typeof functions.SIGNED_REMOTE_SELL_TYPEHASH>

export type BuyParams = FunctionArguments<typeof functions.buy>
export type BuyReturn = FunctionReturn<typeof functions.buy>

export type CancelRemoteSellParams = FunctionArguments<typeof functions.cancelRemoteSell>
export type CancelRemoteSellReturn = FunctionReturn<typeof functions.cancelRemoteSell>

export type CreateTokenParams = FunctionArguments<typeof functions.createToken>
export type CreateTokenReturn = FunctionReturn<typeof functions.createToken>

export type CurrentChainHashParams = FunctionArguments<typeof functions.currentChainHash>
export type CurrentChainHashReturn = FunctionReturn<typeof functions.currentChainHash>

export type EstimateTokenCostParams = FunctionArguments<typeof functions.estimateTokenCost>
export type EstimateTokenCostReturn = FunctionReturn<typeof functions.estimateTokenCost>

export type EstimateTokenRefundParams = FunctionArguments<typeof functions.estimateTokenRefund>
export type EstimateTokenRefundReturn = FunctionReturn<typeof functions.estimateTokenRefund>

export type ItsParams = FunctionArguments<typeof functions.its>
export type ItsReturn = FunctionReturn<typeof functions.its>

export type ItsFactoryParams = FunctionArguments<typeof functions.itsFactory>
export type ItsFactoryReturn = FunctionReturn<typeof functions.itsFactory>

export type LiquidityModuleParams = FunctionArguments<typeof functions.liquidityModule>
export type LiquidityModuleReturn = FunctionReturn<typeof functions.liquidityModule>

export type LockerParams = FunctionArguments<typeof functions.locker>
export type LockerReturn = FunctionReturn<typeof functions.locker>

export type QuoteTokenAmountParams = FunctionArguments<typeof functions.quoteTokenAmount>
export type QuoteTokenAmountReturn = FunctionReturn<typeof functions.quoteTokenAmount>

export type SellParams = FunctionArguments<typeof functions.sell>
export type SellReturn = FunctionReturn<typeof functions.sell>

export type SellRemotelyParams = FunctionArguments<typeof functions.sellRemotely>
export type SellRemotelyReturn = FunctionReturn<typeof functions.sellRemotely>

export type SpendParams = FunctionArguments<typeof functions.spend>
export type SpendReturn = FunctionReturn<typeof functions.spend>

export type SpendRemotelyParams = FunctionArguments<typeof functions.spendRemotely>
export type SpendRemotelyReturn = FunctionReturn<typeof functions.spendRemotely>

export type TokenFactoryParams = FunctionArguments<typeof functions.tokenFactory>
export type TokenFactoryReturn = FunctionReturn<typeof functions.tokenFactory>

export type WrappedNativeTokenParams = FunctionArguments<typeof functions.wrappedNativeToken>
export type WrappedNativeTokenReturn = FunctionReturn<typeof functions.wrappedNativeToken>

