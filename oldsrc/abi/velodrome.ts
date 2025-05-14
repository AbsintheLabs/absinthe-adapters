import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    Approval: event("0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925", "Approval(address,address,uint256)", {"owner": indexed(p.address), "spender": indexed(p.address), "value": p.uint256}),
    Burn: event("0x5d624aa9c148153ab3446c1b154f660ee7701e549fe9b62dab7171b1c80e6fa2", "Burn(address,address,uint256,uint256)", {"sender": indexed(p.address), "to": indexed(p.address), "amount0": p.uint256, "amount1": p.uint256}),
    Claim: event("0x865ca08d59f5cb456e85cd2f7ef63664ea4f73327414e9d8152c4158b0e94645", "Claim(address,address,uint256,uint256)", {"sender": indexed(p.address), "recipient": indexed(p.address), "amount0": p.uint256, "amount1": p.uint256}),
    EIP712DomainChanged: event("0x0a6387c9ea3628b88a633bb4f3b151770f70085117a15f9bf3787cda53f13d31", "EIP712DomainChanged()", {}),
    Fees: event("0x112c256902bf554b6ed882d2936687aaeb4225e8cd5b51303c90ca6cf43a8602", "Fees(address,uint256,uint256)", {"sender": indexed(p.address), "amount0": p.uint256, "amount1": p.uint256}),
    Mint: event("0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f", "Mint(address,uint256,uint256)", {"sender": indexed(p.address), "amount0": p.uint256, "amount1": p.uint256}),
    Swap: event("0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7bf7a05efeffaf75b", "Swap(address,address,uint256,uint256,uint256,uint256)", {"sender": indexed(p.address), "to": indexed(p.address), "amount0In": p.uint256, "amount1In": p.uint256, "amount0Out": p.uint256, "amount1Out": p.uint256}),
    Sync: event("0xcf2aa50876cdfbb541206f89af0ee78d44a2abf8d328e37fa4917f982149848a", "Sync(uint256,uint256)", {"reserve0": p.uint256, "reserve1": p.uint256}),
    Transfer: event("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "Transfer(address,address,uint256)", {"from": indexed(p.address), "to": indexed(p.address), "value": p.uint256}),
}

export const functions = {
    DOMAIN_SEPARATOR: viewFun("0x3644e515", "DOMAIN_SEPARATOR()", {}, p.bytes32),
    allowance: viewFun("0xdd62ed3e", "allowance(address,address)", {"owner": p.address, "spender": p.address}, p.uint256),
    approve: fun("0x095ea7b3", "approve(address,uint256)", {"spender": p.address, "amount": p.uint256}, p.bool),
    balanceOf: viewFun("0x70a08231", "balanceOf(address)", {"account": p.address}, p.uint256),
    blockTimestampLast: viewFun("0xc5700a02", "blockTimestampLast()", {}, p.uint256),
    burn: fun("0x89afcb44", "burn(address)", {"to": p.address}, {"amount0": p.uint256, "amount1": p.uint256}),
    claimFees: fun("0xd294f093", "claimFees()", {}, {"claimed0": p.uint256, "claimed1": p.uint256}),
    claimable0: viewFun("0x4d5a9f8a", "claimable0(address)", {"_0": p.address}, p.uint256),
    claimable1: viewFun("0xa1ac4d13", "claimable1(address)", {"_0": p.address}, p.uint256),
    currentCumulativePrices: viewFun("0x1df8c717", "currentCumulativePrices()", {}, {"reserve0Cumulative": p.uint256, "reserve1Cumulative": p.uint256, "blockTimestamp": p.uint256}),
    decimals: viewFun("0x313ce567", "decimals()", {}, p.uint8),
    decreaseAllowance: fun("0xa457c2d7", "decreaseAllowance(address,uint256)", {"spender": p.address, "subtractedValue": p.uint256}, p.bool),
    eip712Domain: viewFun("0x84b0196e", "eip712Domain()", {}, {"fields": p.bytes1, "name": p.string, "version": p.string, "chainId": p.uint256, "verifyingContract": p.address, "salt": p.bytes32, "extensions": p.array(p.uint256)}),
    factory: viewFun("0xc45a0155", "factory()", {}, p.address),
    getAmountOut: viewFun("0xf140a35a", "getAmountOut(uint256,address)", {"amountIn": p.uint256, "tokenIn": p.address}, p.uint256),
    getReserves: viewFun("0x0902f1ac", "getReserves()", {}, {"_reserve0": p.uint256, "_reserve1": p.uint256, "_blockTimestampLast": p.uint256}),
    increaseAllowance: fun("0x39509351", "increaseAllowance(address,uint256)", {"spender": p.address, "addedValue": p.uint256}, p.bool),
    index0: viewFun("0x32c0defd", "index0()", {}, p.uint256),
    index1: viewFun("0xbda39cad", "index1()", {}, p.uint256),
    initialize: fun("0xe4bbb5a8", "initialize(address,address,bool)", {"_token0": p.address, "_token1": p.address, "_stable": p.bool}, ),
    lastObservation: viewFun("0x8a7b8cf2", "lastObservation()", {}, p.struct({"timestamp": p.uint256, "reserve0Cumulative": p.uint256, "reserve1Cumulative": p.uint256})),
    metadata: viewFun("0x392f37e9", "metadata()", {}, {"dec0": p.uint256, "dec1": p.uint256, "r0": p.uint256, "r1": p.uint256, "st": p.bool, "t0": p.address, "t1": p.address}),
    mint: fun("0x6a627842", "mint(address)", {"to": p.address}, p.uint256),
    name: viewFun("0x06fdde03", "name()", {}, p.string),
    nonces: viewFun("0x7ecebe00", "nonces(address)", {"owner": p.address}, p.uint256),
    observationLength: viewFun("0xebeb31db", "observationLength()", {}, p.uint256),
    observations: viewFun("0x252c09d7", "observations(uint256)", {"_0": p.uint256}, {"timestamp": p.uint256, "reserve0Cumulative": p.uint256, "reserve1Cumulative": p.uint256}),
    permit: fun("0xd505accf", "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)", {"owner": p.address, "spender": p.address, "value": p.uint256, "deadline": p.uint256, "v": p.uint8, "r": p.bytes32, "s": p.bytes32}, ),
    poolFees: viewFun("0x33580959", "poolFees()", {}, p.address),
    prices: viewFun("0x5881c475", "prices(address,uint256,uint256)", {"tokenIn": p.address, "amountIn": p.uint256, "points": p.uint256}, p.array(p.uint256)),
    quote: viewFun("0x9e8cc04b", "quote(address,uint256,uint256)", {"tokenIn": p.address, "amountIn": p.uint256, "granularity": p.uint256}, p.uint256),
    reserve0: viewFun("0x443cb4bc", "reserve0()", {}, p.uint256),
    reserve0CumulativeLast: viewFun("0xbf944dbc", "reserve0CumulativeLast()", {}, p.uint256),
    reserve1: viewFun("0x5a76f25e", "reserve1()", {}, p.uint256),
    reserve1CumulativeLast: viewFun("0xc245febc", "reserve1CumulativeLast()", {}, p.uint256),
    sample: viewFun("0x13345fe1", "sample(address,uint256,uint256,uint256)", {"tokenIn": p.address, "amountIn": p.uint256, "points": p.uint256, "window": p.uint256}, p.array(p.uint256)),
    setName: fun("0xc47f0027", "setName(string)", {"__name": p.string}, ),
    setSymbol: fun("0xb84c8246", "setSymbol(string)", {"__symbol": p.string}, ),
    skim: fun("0xbc25cf77", "skim(address)", {"to": p.address}, ),
    stable: viewFun("0x22be3de1", "stable()", {}, p.bool),
    supplyIndex0: viewFun("0x9f767c88", "supplyIndex0(address)", {"_0": p.address}, p.uint256),
    supplyIndex1: viewFun("0x205aabf1", "supplyIndex1(address)", {"_0": p.address}, p.uint256),
    swap: fun("0x022c0d9f", "swap(uint256,uint256,address,bytes)", {"amount0Out": p.uint256, "amount1Out": p.uint256, "to": p.address, "data": p.bytes}, ),
    symbol: viewFun("0x95d89b41", "symbol()", {}, p.string),
    sync: fun("0xfff6cae9", "sync()", {}, ),
    token0: viewFun("0x0dfe1681", "token0()", {}, p.address),
    token1: viewFun("0xd21220a7", "token1()", {}, p.address),
    tokens: viewFun("0x9d63848a", "tokens()", {}, {"_0": p.address, "_1": p.address}),
    totalSupply: viewFun("0x18160ddd", "totalSupply()", {}, p.uint256),
    transfer: fun("0xa9059cbb", "transfer(address,uint256)", {"to": p.address, "amount": p.uint256}, p.bool),
    transferFrom: fun("0x23b872dd", "transferFrom(address,address,uint256)", {"from": p.address, "to": p.address, "amount": p.uint256}, p.bool),
}

export class Contract extends ContractBase {

    DOMAIN_SEPARATOR() {
        return this.eth_call(functions.DOMAIN_SEPARATOR, {})
    }

    allowance(owner: AllowanceParams["owner"], spender: AllowanceParams["spender"]) {
        return this.eth_call(functions.allowance, {owner, spender})
    }

    balanceOf(account: BalanceOfParams["account"]) {
        return this.eth_call(functions.balanceOf, {account})
    }

    blockTimestampLast() {
        return this.eth_call(functions.blockTimestampLast, {})
    }

    claimable0(_0: Claimable0Params["_0"]) {
        return this.eth_call(functions.claimable0, {_0})
    }

    claimable1(_0: Claimable1Params["_0"]) {
        return this.eth_call(functions.claimable1, {_0})
    }

    currentCumulativePrices() {
        return this.eth_call(functions.currentCumulativePrices, {})
    }

    decimals() {
        return this.eth_call(functions.decimals, {})
    }

    eip712Domain() {
        return this.eth_call(functions.eip712Domain, {})
    }

    factory() {
        return this.eth_call(functions.factory, {})
    }

    getAmountOut(amountIn: GetAmountOutParams["amountIn"], tokenIn: GetAmountOutParams["tokenIn"]) {
        return this.eth_call(functions.getAmountOut, {amountIn, tokenIn})
    }

    getReserves() {
        return this.eth_call(functions.getReserves, {})
    }

    index0() {
        return this.eth_call(functions.index0, {})
    }

    index1() {
        return this.eth_call(functions.index1, {})
    }

    lastObservation() {
        return this.eth_call(functions.lastObservation, {})
    }

    metadata() {
        return this.eth_call(functions.metadata, {})
    }

    name() {
        return this.eth_call(functions.name, {})
    }

    nonces(owner: NoncesParams["owner"]) {
        return this.eth_call(functions.nonces, {owner})
    }

    observationLength() {
        return this.eth_call(functions.observationLength, {})
    }

    observations(_0: ObservationsParams["_0"]) {
        return this.eth_call(functions.observations, {_0})
    }

    poolFees() {
        return this.eth_call(functions.poolFees, {})
    }

    prices(tokenIn: PricesParams["tokenIn"], amountIn: PricesParams["amountIn"], points: PricesParams["points"]) {
        return this.eth_call(functions.prices, {tokenIn, amountIn, points})
    }

    quote(tokenIn: QuoteParams["tokenIn"], amountIn: QuoteParams["amountIn"], granularity: QuoteParams["granularity"]) {
        return this.eth_call(functions.quote, {tokenIn, amountIn, granularity})
    }

    reserve0() {
        return this.eth_call(functions.reserve0, {})
    }

    reserve0CumulativeLast() {
        return this.eth_call(functions.reserve0CumulativeLast, {})
    }

    reserve1() {
        return this.eth_call(functions.reserve1, {})
    }

    reserve1CumulativeLast() {
        return this.eth_call(functions.reserve1CumulativeLast, {})
    }

    sample(tokenIn: SampleParams["tokenIn"], amountIn: SampleParams["amountIn"], points: SampleParams["points"], window: SampleParams["window"]) {
        return this.eth_call(functions.sample, {tokenIn, amountIn, points, window})
    }

    stable() {
        return this.eth_call(functions.stable, {})
    }

    supplyIndex0(_0: SupplyIndex0Params["_0"]) {
        return this.eth_call(functions.supplyIndex0, {_0})
    }

    supplyIndex1(_0: SupplyIndex1Params["_0"]) {
        return this.eth_call(functions.supplyIndex1, {_0})
    }

    symbol() {
        return this.eth_call(functions.symbol, {})
    }

    token0() {
        return this.eth_call(functions.token0, {})
    }

    token1() {
        return this.eth_call(functions.token1, {})
    }

    tokens() {
        return this.eth_call(functions.tokens, {})
    }

    totalSupply() {
        return this.eth_call(functions.totalSupply, {})
    }
}

/// Event types
export type ApprovalEventArgs = EParams<typeof events.Approval>
export type BurnEventArgs = EParams<typeof events.Burn>
export type ClaimEventArgs = EParams<typeof events.Claim>
export type EIP712DomainChangedEventArgs = EParams<typeof events.EIP712DomainChanged>
export type FeesEventArgs = EParams<typeof events.Fees>
export type MintEventArgs = EParams<typeof events.Mint>
export type SwapEventArgs = EParams<typeof events.Swap>
export type SyncEventArgs = EParams<typeof events.Sync>
export type TransferEventArgs = EParams<typeof events.Transfer>

/// Function types
export type DOMAIN_SEPARATORParams = FunctionArguments<typeof functions.DOMAIN_SEPARATOR>
export type DOMAIN_SEPARATORReturn = FunctionReturn<typeof functions.DOMAIN_SEPARATOR>

export type AllowanceParams = FunctionArguments<typeof functions.allowance>
export type AllowanceReturn = FunctionReturn<typeof functions.allowance>

export type ApproveParams = FunctionArguments<typeof functions.approve>
export type ApproveReturn = FunctionReturn<typeof functions.approve>

export type BalanceOfParams = FunctionArguments<typeof functions.balanceOf>
export type BalanceOfReturn = FunctionReturn<typeof functions.balanceOf>

export type BlockTimestampLastParams = FunctionArguments<typeof functions.blockTimestampLast>
export type BlockTimestampLastReturn = FunctionReturn<typeof functions.blockTimestampLast>

export type BurnParams = FunctionArguments<typeof functions.burn>
export type BurnReturn = FunctionReturn<typeof functions.burn>

export type ClaimFeesParams = FunctionArguments<typeof functions.claimFees>
export type ClaimFeesReturn = FunctionReturn<typeof functions.claimFees>

export type Claimable0Params = FunctionArguments<typeof functions.claimable0>
export type Claimable0Return = FunctionReturn<typeof functions.claimable0>

export type Claimable1Params = FunctionArguments<typeof functions.claimable1>
export type Claimable1Return = FunctionReturn<typeof functions.claimable1>

export type CurrentCumulativePricesParams = FunctionArguments<typeof functions.currentCumulativePrices>
export type CurrentCumulativePricesReturn = FunctionReturn<typeof functions.currentCumulativePrices>

export type DecimalsParams = FunctionArguments<typeof functions.decimals>
export type DecimalsReturn = FunctionReturn<typeof functions.decimals>

export type DecreaseAllowanceParams = FunctionArguments<typeof functions.decreaseAllowance>
export type DecreaseAllowanceReturn = FunctionReturn<typeof functions.decreaseAllowance>

export type Eip712DomainParams = FunctionArguments<typeof functions.eip712Domain>
export type Eip712DomainReturn = FunctionReturn<typeof functions.eip712Domain>

export type FactoryParams = FunctionArguments<typeof functions.factory>
export type FactoryReturn = FunctionReturn<typeof functions.factory>

export type GetAmountOutParams = FunctionArguments<typeof functions.getAmountOut>
export type GetAmountOutReturn = FunctionReturn<typeof functions.getAmountOut>

export type GetReservesParams = FunctionArguments<typeof functions.getReserves>
export type GetReservesReturn = FunctionReturn<typeof functions.getReserves>

export type IncreaseAllowanceParams = FunctionArguments<typeof functions.increaseAllowance>
export type IncreaseAllowanceReturn = FunctionReturn<typeof functions.increaseAllowance>

export type Index0Params = FunctionArguments<typeof functions.index0>
export type Index0Return = FunctionReturn<typeof functions.index0>

export type Index1Params = FunctionArguments<typeof functions.index1>
export type Index1Return = FunctionReturn<typeof functions.index1>

export type InitializeParams = FunctionArguments<typeof functions.initialize>
export type InitializeReturn = FunctionReturn<typeof functions.initialize>

export type LastObservationParams = FunctionArguments<typeof functions.lastObservation>
export type LastObservationReturn = FunctionReturn<typeof functions.lastObservation>

export type MetadataParams = FunctionArguments<typeof functions.metadata>
export type MetadataReturn = FunctionReturn<typeof functions.metadata>

export type MintParams = FunctionArguments<typeof functions.mint>
export type MintReturn = FunctionReturn<typeof functions.mint>

export type NameParams = FunctionArguments<typeof functions.name>
export type NameReturn = FunctionReturn<typeof functions.name>

export type NoncesParams = FunctionArguments<typeof functions.nonces>
export type NoncesReturn = FunctionReturn<typeof functions.nonces>

export type ObservationLengthParams = FunctionArguments<typeof functions.observationLength>
export type ObservationLengthReturn = FunctionReturn<typeof functions.observationLength>

export type ObservationsParams = FunctionArguments<typeof functions.observations>
export type ObservationsReturn = FunctionReturn<typeof functions.observations>

export type PermitParams = FunctionArguments<typeof functions.permit>
export type PermitReturn = FunctionReturn<typeof functions.permit>

export type PoolFeesParams = FunctionArguments<typeof functions.poolFees>
export type PoolFeesReturn = FunctionReturn<typeof functions.poolFees>

export type PricesParams = FunctionArguments<typeof functions.prices>
export type PricesReturn = FunctionReturn<typeof functions.prices>

export type QuoteParams = FunctionArguments<typeof functions.quote>
export type QuoteReturn = FunctionReturn<typeof functions.quote>

export type Reserve0Params = FunctionArguments<typeof functions.reserve0>
export type Reserve0Return = FunctionReturn<typeof functions.reserve0>

export type Reserve0CumulativeLastParams = FunctionArguments<typeof functions.reserve0CumulativeLast>
export type Reserve0CumulativeLastReturn = FunctionReturn<typeof functions.reserve0CumulativeLast>

export type Reserve1Params = FunctionArguments<typeof functions.reserve1>
export type Reserve1Return = FunctionReturn<typeof functions.reserve1>

export type Reserve1CumulativeLastParams = FunctionArguments<typeof functions.reserve1CumulativeLast>
export type Reserve1CumulativeLastReturn = FunctionReturn<typeof functions.reserve1CumulativeLast>

export type SampleParams = FunctionArguments<typeof functions.sample>
export type SampleReturn = FunctionReturn<typeof functions.sample>

export type SetNameParams = FunctionArguments<typeof functions.setName>
export type SetNameReturn = FunctionReturn<typeof functions.setName>

export type SetSymbolParams = FunctionArguments<typeof functions.setSymbol>
export type SetSymbolReturn = FunctionReturn<typeof functions.setSymbol>

export type SkimParams = FunctionArguments<typeof functions.skim>
export type SkimReturn = FunctionReturn<typeof functions.skim>

export type StableParams = FunctionArguments<typeof functions.stable>
export type StableReturn = FunctionReturn<typeof functions.stable>

export type SupplyIndex0Params = FunctionArguments<typeof functions.supplyIndex0>
export type SupplyIndex0Return = FunctionReturn<typeof functions.supplyIndex0>

export type SupplyIndex1Params = FunctionArguments<typeof functions.supplyIndex1>
export type SupplyIndex1Return = FunctionReturn<typeof functions.supplyIndex1>

export type SwapParams = FunctionArguments<typeof functions.swap>
export type SwapReturn = FunctionReturn<typeof functions.swap>

export type SymbolParams = FunctionArguments<typeof functions.symbol>
export type SymbolReturn = FunctionReturn<typeof functions.symbol>

export type SyncParams = FunctionArguments<typeof functions.sync>
export type SyncReturn = FunctionReturn<typeof functions.sync>

export type Token0Params = FunctionArguments<typeof functions.token0>
export type Token0Return = FunctionReturn<typeof functions.token0>

export type Token1Params = FunctionArguments<typeof functions.token1>
export type Token1Return = FunctionReturn<typeof functions.token1>

export type TokensParams = FunctionArguments<typeof functions.tokens>
export type TokensReturn = FunctionReturn<typeof functions.tokens>

export type TotalSupplyParams = FunctionArguments<typeof functions.totalSupply>
export type TotalSupplyReturn = FunctionReturn<typeof functions.totalSupply>

export type TransferParams = FunctionArguments<typeof functions.transfer>
export type TransferReturn = FunctionReturn<typeof functions.transfer>

export type TransferFromParams = FunctionArguments<typeof functions.transferFrom>
export type TransferFromReturn = FunctionReturn<typeof functions.transferFrom>

