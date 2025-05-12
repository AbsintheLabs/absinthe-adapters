import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    AccrueInterest: event("0x4dec04e750ca11537cabcd8a9eab06494de08da3735bc8871cd41250e190bc04", "AccrueInterest(uint256,uint256,uint256,uint256)", {"cashPrior": p.uint256, "interestAccumulated": p.uint256, "borrowIndex": p.uint256, "totalBorrows": p.uint256}),
    Approval: event("0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925", "Approval(address,address,uint256)", {"owner": indexed(p.address), "spender": indexed(p.address), "amount": p.uint256}),
    Borrow: event("0x13ed6866d4e1ee6da46f845c46d7e54120883d75c5ea9a2dacc1c4ca8984ab80", "Borrow(address,uint256,uint256,uint256)", {"borrower": p.address, "borrowAmount": p.uint256, "accountBorrows": p.uint256, "totalBorrows": p.uint256}),
    Failure: event("0x45b96fe442630264581b197e84bbada861235052c5a1aadfff9ea4e40a969aa0", "Failure(uint256,uint256,uint256)", {"error": p.uint256, "info": p.uint256, "detail": p.uint256}),
    LiquidateBorrow: event("0x298637f684da70674f26509b10f07ec2fbc77a335ab1e7d6215a4b2484d8bb52", "LiquidateBorrow(address,address,uint256,address,uint256)", {"liquidator": p.address, "borrower": p.address, "repayAmount": p.uint256, "cTokenCollateral": p.address, "seizeTokens": p.uint256}),
    Mint: event("0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f", "Mint(address,uint256,uint256)", {"minter": p.address, "mintAmount": p.uint256, "mintTokens": p.uint256}),
    NewAdmin: event("0xf9ffabca9c8276e99321725bcb43fb076a6c66a54b7f21c4e8146d8519b417dc", "NewAdmin(address,address)", {"oldAdmin": p.address, "newAdmin": p.address}),
    NewComptroller: event("0x7ac369dbd14fa5ea3f473ed67cc9d598964a77501540ba6751eb0b3decf5870d", "NewComptroller(address,address)", {"oldComptroller": p.address, "newComptroller": p.address}),
    NewImplementation: event("0xd604de94d45953f9138079ec1b82d533cb2160c906d1076d1f7ed54befbca97a", "NewImplementation(address,address)", {"oldImplementation": p.address, "newImplementation": p.address}),
    NewMarketInterestRateModel: event("0xedffc32e068c7c95dfd4bdfd5c4d939a084d6b11c4199eac8436ed234d72f926", "NewMarketInterestRateModel(address,address)", {"oldInterestRateModel": p.address, "newInterestRateModel": p.address}),
    NewPendingAdmin: event("0xca4f2f25d0898edd99413412fb94012f9e54ec8142f9b093e7720646a95b16a9", "NewPendingAdmin(address,address)", {"oldPendingAdmin": p.address, "newPendingAdmin": p.address}),
    NewReserveFactor: event("0xaaa68312e2ea9d50e16af5068410ab56e1a1fd06037b1a35664812c30f821460", "NewReserveFactor(uint256,uint256)", {"oldReserveFactorMantissa": p.uint256, "newReserveFactorMantissa": p.uint256}),
    Redeem: event("0xe5b754fb1abb7f01b499791d0b820ae3b6af3424ac1c59768edb53f4ec31a929", "Redeem(address,uint256,uint256)", {"redeemer": p.address, "redeemAmount": p.uint256, "redeemTokens": p.uint256}),
    RepayBorrow: event("0x1a2a22cb034d26d1854bdc6666a5b91fe25efbbb5dcad3b0355478d6f5c362a1", "RepayBorrow(address,address,uint256,uint256,uint256)", {"payer": p.address, "borrower": p.address, "repayAmount": p.uint256, "accountBorrows": p.uint256, "totalBorrows": p.uint256}),
    ReservesAdded: event("0xa91e67c5ea634cd43a12c5a482724b03de01e85ca68702a53d0c2f45cb7c1dc5", "ReservesAdded(address,uint256,uint256)", {"benefactor": p.address, "addAmount": p.uint256, "newTotalReserves": p.uint256}),
    ReservesReduced: event("0x3bad0c59cf2f06e7314077049f48a93578cd16f5ef92329f1dab1420a99c177e", "ReservesReduced(address,uint256,uint256)", {"admin": p.address, "reduceAmount": p.uint256, "newTotalReserves": p.uint256}),
    Transfer: event("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "Transfer(address,address,uint256)", {"from": indexed(p.address), "to": indexed(p.address), "amount": p.uint256}),
}

export const functions = {
    _acceptAdmin: fun("0xe9c714f2", "_acceptAdmin()", {}, p.uint256),
    _addReserves: fun("0x3e941010", "_addReserves(uint256)", {"addAmount": p.uint256}, p.uint256),
    _reduceReserves: fun("0x601a0bf1", "_reduceReserves(uint256)", {"reduceAmount": p.uint256}, p.uint256),
    _setComptroller: fun("0x4576b5db", "_setComptroller(address)", {"newComptroller": p.address}, p.uint256),
    _setImplementation: fun("0x555bcc40", "_setImplementation(address,bool,bytes)", {"implementation_": p.address, "allowResign": p.bool, "becomeImplementationData": p.bytes}, ),
    _setInterestRateModel: fun("0xf2b3abbd", "_setInterestRateModel(address)", {"newInterestRateModel": p.address}, p.uint256),
    _setPendingAdmin: fun("0xb71d1a0c", "_setPendingAdmin(address)", {"newPendingAdmin": p.address}, p.uint256),
    _setReserveFactor: fun("0xfca7820b", "_setReserveFactor(uint256)", {"newReserveFactorMantissa": p.uint256}, p.uint256),
    accrualBlockNumber: viewFun("0x6c540baf", "accrualBlockNumber()", {}, p.uint256),
    accrueInterest: fun("0xa6afed95", "accrueInterest()", {}, p.uint256),
    admin: viewFun("0xf851a440", "admin()", {}, p.address),
    allowance: viewFun("0xdd62ed3e", "allowance(address,address)", {"owner": p.address, "spender": p.address}, p.uint256),
    approve: fun("0x095ea7b3", "approve(address,uint256)", {"spender": p.address, "amount": p.uint256}, p.bool),
    balanceOf: viewFun("0x70a08231", "balanceOf(address)", {"owner": p.address}, p.uint256),
    balanceOfUnderlying: fun("0x3af9e669", "balanceOfUnderlying(address)", {"owner": p.address}, p.uint256),
    borrow: fun("0xc5ebeaec", "borrow(uint256)", {"borrowAmount": p.uint256}, p.uint256),
    borrowBalanceCurrent: fun("0x17bfdfbc", "borrowBalanceCurrent(address)", {"account": p.address}, p.uint256),
    borrowBalanceStored: viewFun("0x95dd9193", "borrowBalanceStored(address)", {"account": p.address}, p.uint256),
    borrowIndex: viewFun("0xaa5af0fd", "borrowIndex()", {}, p.uint256),
    borrowRatePerBlock: viewFun("0xf8f9da28", "borrowRatePerBlock()", {}, p.uint256),
    comptroller: viewFun("0x5fe3b567", "comptroller()", {}, p.address),
    decimals: viewFun("0x313ce567", "decimals()", {}, p.uint8),
    delegateToImplementation: fun("0x0933c1ed", "delegateToImplementation(bytes)", {"data": p.bytes}, p.bytes),
    delegateToViewImplementation: viewFun("0x4487152f", "delegateToViewImplementation(bytes)", {"data": p.bytes}, p.bytes),
    exchangeRateCurrent: fun("0xbd6d894d", "exchangeRateCurrent()", {}, p.uint256),
    exchangeRateStored: viewFun("0x182df0f5", "exchangeRateStored()", {}, p.uint256),
    getAccountSnapshot: viewFun("0xc37f68e2", "getAccountSnapshot(address)", {"account": p.address}, {"_0": p.uint256, "_1": p.uint256, "_2": p.uint256, "_3": p.uint256}),
    getCash: viewFun("0x3b1d21a2", "getCash()", {}, p.uint256),
    implementation: viewFun("0x5c60da1b", "implementation()", {}, p.address),
    interestRateModel: viewFun("0xf3fdb15a", "interestRateModel()", {}, p.address),
    isCToken: viewFun("0xfe9c44ae", "isCToken()", {}, p.bool),
    liquidateBorrow: fun("0xf5e3c462", "liquidateBorrow(address,uint256,address)", {"borrower": p.address, "repayAmount": p.uint256, "cTokenCollateral": p.address}, p.uint256),
    mint: fun("0xa0712d68", "mint(uint256)", {"mintAmount": p.uint256}, p.uint256),
    name: viewFun("0x06fdde03", "name()", {}, p.string),
    pendingAdmin: viewFun("0x26782247", "pendingAdmin()", {}, p.address),
    protocolSeizeShareMantissa: viewFun("0x6752e702", "protocolSeizeShareMantissa()", {}, p.uint256),
    redeem: fun("0xdb006a75", "redeem(uint256)", {"redeemTokens": p.uint256}, p.uint256),
    redeemUnderlying: fun("0x852a12e3", "redeemUnderlying(uint256)", {"redeemAmount": p.uint256}, p.uint256),
    repayBorrow: fun("0x0e752702", "repayBorrow(uint256)", {"repayAmount": p.uint256}, p.uint256),
    repayBorrowBehalf: fun("0x2608f818", "repayBorrowBehalf(address,uint256)", {"borrower": p.address, "repayAmount": p.uint256}, p.uint256),
    reserveFactorMantissa: viewFun("0x173b9904", "reserveFactorMantissa()", {}, p.uint256),
    seize: fun("0xb2a02ff1", "seize(address,address,uint256)", {"liquidator": p.address, "borrower": p.address, "seizeTokens": p.uint256}, p.uint256),
    supplyRatePerBlock: viewFun("0xae9d70b0", "supplyRatePerBlock()", {}, p.uint256),
    sweepToken: fun("0x1be19560", "sweepToken(address)", {"token": p.address}, ),
    symbol: viewFun("0x95d89b41", "symbol()", {}, p.string),
    totalBorrows: viewFun("0x47bd3718", "totalBorrows()", {}, p.uint256),
    totalBorrowsCurrent: fun("0x73acee98", "totalBorrowsCurrent()", {}, p.uint256),
    totalReserves: viewFun("0x8f840ddd", "totalReserves()", {}, p.uint256),
    totalSupply: viewFun("0x18160ddd", "totalSupply()", {}, p.uint256),
    transfer: fun("0xa9059cbb", "transfer(address,uint256)", {"dst": p.address, "amount": p.uint256}, p.bool),
    transferFrom: fun("0x23b872dd", "transferFrom(address,address,uint256)", {"src": p.address, "dst": p.address, "amount": p.uint256}, p.bool),
    underlying: viewFun("0x6f307dc3", "underlying()", {}, p.address),
}

export class Contract extends ContractBase {

    accrualBlockNumber() {
        return this.eth_call(functions.accrualBlockNumber, {})
    }

    admin() {
        return this.eth_call(functions.admin, {})
    }

    allowance(owner: AllowanceParams["owner"], spender: AllowanceParams["spender"]) {
        return this.eth_call(functions.allowance, {owner, spender})
    }

    balanceOf(owner: BalanceOfParams["owner"]) {
        return this.eth_call(functions.balanceOf, {owner})
    }

    borrowBalanceStored(account: BorrowBalanceStoredParams["account"]) {
        return this.eth_call(functions.borrowBalanceStored, {account})
    }

    borrowIndex() {
        return this.eth_call(functions.borrowIndex, {})
    }

    borrowRatePerBlock() {
        return this.eth_call(functions.borrowRatePerBlock, {})
    }

    comptroller() {
        return this.eth_call(functions.comptroller, {})
    }

    decimals() {
        return this.eth_call(functions.decimals, {})
    }

    delegateToViewImplementation(data: DelegateToViewImplementationParams["data"]) {
        return this.eth_call(functions.delegateToViewImplementation, {data})
    }

    exchangeRateStored() {
        return this.eth_call(functions.exchangeRateStored, {})
    }

    getAccountSnapshot(account: GetAccountSnapshotParams["account"]) {
        return this.eth_call(functions.getAccountSnapshot, {account})
    }

    getCash() {
        return this.eth_call(functions.getCash, {})
    }

    implementation() {
        return this.eth_call(functions.implementation, {})
    }

    interestRateModel() {
        return this.eth_call(functions.interestRateModel, {})
    }

    isCToken() {
        return this.eth_call(functions.isCToken, {})
    }

    name() {
        return this.eth_call(functions.name, {})
    }

    pendingAdmin() {
        return this.eth_call(functions.pendingAdmin, {})
    }

    protocolSeizeShareMantissa() {
        return this.eth_call(functions.protocolSeizeShareMantissa, {})
    }

    reserveFactorMantissa() {
        return this.eth_call(functions.reserveFactorMantissa, {})
    }

    supplyRatePerBlock() {
        return this.eth_call(functions.supplyRatePerBlock, {})
    }

    symbol() {
        return this.eth_call(functions.symbol, {})
    }

    totalBorrows() {
        return this.eth_call(functions.totalBorrows, {})
    }

    totalReserves() {
        return this.eth_call(functions.totalReserves, {})
    }

    totalSupply() {
        return this.eth_call(functions.totalSupply, {})
    }

    underlying() {
        return this.eth_call(functions.underlying, {})
    }
}

/// Event types
export type AccrueInterestEventArgs = EParams<typeof events.AccrueInterest>
export type ApprovalEventArgs = EParams<typeof events.Approval>
export type BorrowEventArgs = EParams<typeof events.Borrow>
export type FailureEventArgs = EParams<typeof events.Failure>
export type LiquidateBorrowEventArgs = EParams<typeof events.LiquidateBorrow>
export type MintEventArgs = EParams<typeof events.Mint>
export type NewAdminEventArgs = EParams<typeof events.NewAdmin>
export type NewComptrollerEventArgs = EParams<typeof events.NewComptroller>
export type NewImplementationEventArgs = EParams<typeof events.NewImplementation>
export type NewMarketInterestRateModelEventArgs = EParams<typeof events.NewMarketInterestRateModel>
export type NewPendingAdminEventArgs = EParams<typeof events.NewPendingAdmin>
export type NewReserveFactorEventArgs = EParams<typeof events.NewReserveFactor>
export type RedeemEventArgs = EParams<typeof events.Redeem>
export type RepayBorrowEventArgs = EParams<typeof events.RepayBorrow>
export type ReservesAddedEventArgs = EParams<typeof events.ReservesAdded>
export type ReservesReducedEventArgs = EParams<typeof events.ReservesReduced>
export type TransferEventArgs = EParams<typeof events.Transfer>

/// Function types
export type _acceptAdminParams = FunctionArguments<typeof functions._acceptAdmin>
export type _acceptAdminReturn = FunctionReturn<typeof functions._acceptAdmin>

export type _addReservesParams = FunctionArguments<typeof functions._addReserves>
export type _addReservesReturn = FunctionReturn<typeof functions._addReserves>

export type _reduceReservesParams = FunctionArguments<typeof functions._reduceReserves>
export type _reduceReservesReturn = FunctionReturn<typeof functions._reduceReserves>

export type _setComptrollerParams = FunctionArguments<typeof functions._setComptroller>
export type _setComptrollerReturn = FunctionReturn<typeof functions._setComptroller>

export type _setImplementationParams = FunctionArguments<typeof functions._setImplementation>
export type _setImplementationReturn = FunctionReturn<typeof functions._setImplementation>

export type _setInterestRateModelParams = FunctionArguments<typeof functions._setInterestRateModel>
export type _setInterestRateModelReturn = FunctionReturn<typeof functions._setInterestRateModel>

export type _setPendingAdminParams = FunctionArguments<typeof functions._setPendingAdmin>
export type _setPendingAdminReturn = FunctionReturn<typeof functions._setPendingAdmin>

export type _setReserveFactorParams = FunctionArguments<typeof functions._setReserveFactor>
export type _setReserveFactorReturn = FunctionReturn<typeof functions._setReserveFactor>

export type AccrualBlockNumberParams = FunctionArguments<typeof functions.accrualBlockNumber>
export type AccrualBlockNumberReturn = FunctionReturn<typeof functions.accrualBlockNumber>

export type AccrueInterestParams = FunctionArguments<typeof functions.accrueInterest>
export type AccrueInterestReturn = FunctionReturn<typeof functions.accrueInterest>

export type AdminParams = FunctionArguments<typeof functions.admin>
export type AdminReturn = FunctionReturn<typeof functions.admin>

export type AllowanceParams = FunctionArguments<typeof functions.allowance>
export type AllowanceReturn = FunctionReturn<typeof functions.allowance>

export type ApproveParams = FunctionArguments<typeof functions.approve>
export type ApproveReturn = FunctionReturn<typeof functions.approve>

export type BalanceOfParams = FunctionArguments<typeof functions.balanceOf>
export type BalanceOfReturn = FunctionReturn<typeof functions.balanceOf>

export type BalanceOfUnderlyingParams = FunctionArguments<typeof functions.balanceOfUnderlying>
export type BalanceOfUnderlyingReturn = FunctionReturn<typeof functions.balanceOfUnderlying>

export type BorrowParams = FunctionArguments<typeof functions.borrow>
export type BorrowReturn = FunctionReturn<typeof functions.borrow>

export type BorrowBalanceCurrentParams = FunctionArguments<typeof functions.borrowBalanceCurrent>
export type BorrowBalanceCurrentReturn = FunctionReturn<typeof functions.borrowBalanceCurrent>

export type BorrowBalanceStoredParams = FunctionArguments<typeof functions.borrowBalanceStored>
export type BorrowBalanceStoredReturn = FunctionReturn<typeof functions.borrowBalanceStored>

export type BorrowIndexParams = FunctionArguments<typeof functions.borrowIndex>
export type BorrowIndexReturn = FunctionReturn<typeof functions.borrowIndex>

export type BorrowRatePerBlockParams = FunctionArguments<typeof functions.borrowRatePerBlock>
export type BorrowRatePerBlockReturn = FunctionReturn<typeof functions.borrowRatePerBlock>

export type ComptrollerParams = FunctionArguments<typeof functions.comptroller>
export type ComptrollerReturn = FunctionReturn<typeof functions.comptroller>

export type DecimalsParams = FunctionArguments<typeof functions.decimals>
export type DecimalsReturn = FunctionReturn<typeof functions.decimals>

export type DelegateToImplementationParams = FunctionArguments<typeof functions.delegateToImplementation>
export type DelegateToImplementationReturn = FunctionReturn<typeof functions.delegateToImplementation>

export type DelegateToViewImplementationParams = FunctionArguments<typeof functions.delegateToViewImplementation>
export type DelegateToViewImplementationReturn = FunctionReturn<typeof functions.delegateToViewImplementation>

export type ExchangeRateCurrentParams = FunctionArguments<typeof functions.exchangeRateCurrent>
export type ExchangeRateCurrentReturn = FunctionReturn<typeof functions.exchangeRateCurrent>

export type ExchangeRateStoredParams = FunctionArguments<typeof functions.exchangeRateStored>
export type ExchangeRateStoredReturn = FunctionReturn<typeof functions.exchangeRateStored>

export type GetAccountSnapshotParams = FunctionArguments<typeof functions.getAccountSnapshot>
export type GetAccountSnapshotReturn = FunctionReturn<typeof functions.getAccountSnapshot>

export type GetCashParams = FunctionArguments<typeof functions.getCash>
export type GetCashReturn = FunctionReturn<typeof functions.getCash>

export type ImplementationParams = FunctionArguments<typeof functions.implementation>
export type ImplementationReturn = FunctionReturn<typeof functions.implementation>

export type InterestRateModelParams = FunctionArguments<typeof functions.interestRateModel>
export type InterestRateModelReturn = FunctionReturn<typeof functions.interestRateModel>

export type IsCTokenParams = FunctionArguments<typeof functions.isCToken>
export type IsCTokenReturn = FunctionReturn<typeof functions.isCToken>

export type LiquidateBorrowParams = FunctionArguments<typeof functions.liquidateBorrow>
export type LiquidateBorrowReturn = FunctionReturn<typeof functions.liquidateBorrow>

export type MintParams = FunctionArguments<typeof functions.mint>
export type MintReturn = FunctionReturn<typeof functions.mint>

export type NameParams = FunctionArguments<typeof functions.name>
export type NameReturn = FunctionReturn<typeof functions.name>

export type PendingAdminParams = FunctionArguments<typeof functions.pendingAdmin>
export type PendingAdminReturn = FunctionReturn<typeof functions.pendingAdmin>

export type ProtocolSeizeShareMantissaParams = FunctionArguments<typeof functions.protocolSeizeShareMantissa>
export type ProtocolSeizeShareMantissaReturn = FunctionReturn<typeof functions.protocolSeizeShareMantissa>

export type RedeemParams = FunctionArguments<typeof functions.redeem>
export type RedeemReturn = FunctionReturn<typeof functions.redeem>

export type RedeemUnderlyingParams = FunctionArguments<typeof functions.redeemUnderlying>
export type RedeemUnderlyingReturn = FunctionReturn<typeof functions.redeemUnderlying>

export type RepayBorrowParams = FunctionArguments<typeof functions.repayBorrow>
export type RepayBorrowReturn = FunctionReturn<typeof functions.repayBorrow>

export type RepayBorrowBehalfParams = FunctionArguments<typeof functions.repayBorrowBehalf>
export type RepayBorrowBehalfReturn = FunctionReturn<typeof functions.repayBorrowBehalf>

export type ReserveFactorMantissaParams = FunctionArguments<typeof functions.reserveFactorMantissa>
export type ReserveFactorMantissaReturn = FunctionReturn<typeof functions.reserveFactorMantissa>

export type SeizeParams = FunctionArguments<typeof functions.seize>
export type SeizeReturn = FunctionReturn<typeof functions.seize>

export type SupplyRatePerBlockParams = FunctionArguments<typeof functions.supplyRatePerBlock>
export type SupplyRatePerBlockReturn = FunctionReturn<typeof functions.supplyRatePerBlock>

export type SweepTokenParams = FunctionArguments<typeof functions.sweepToken>
export type SweepTokenReturn = FunctionReturn<typeof functions.sweepToken>

export type SymbolParams = FunctionArguments<typeof functions.symbol>
export type SymbolReturn = FunctionReturn<typeof functions.symbol>

export type TotalBorrowsParams = FunctionArguments<typeof functions.totalBorrows>
export type TotalBorrowsReturn = FunctionReturn<typeof functions.totalBorrows>

export type TotalBorrowsCurrentParams = FunctionArguments<typeof functions.totalBorrowsCurrent>
export type TotalBorrowsCurrentReturn = FunctionReturn<typeof functions.totalBorrowsCurrent>

export type TotalReservesParams = FunctionArguments<typeof functions.totalReserves>
export type TotalReservesReturn = FunctionReturn<typeof functions.totalReserves>

export type TotalSupplyParams = FunctionArguments<typeof functions.totalSupply>
export type TotalSupplyReturn = FunctionReturn<typeof functions.totalSupply>

export type TransferParams = FunctionArguments<typeof functions.transfer>
export type TransferReturn = FunctionReturn<typeof functions.transfer>

export type TransferFromParams = FunctionArguments<typeof functions.transferFrom>
export type TransferFromReturn = FunctionReturn<typeof functions.transferFrom>

export type UnderlyingParams = FunctionArguments<typeof functions.underlying>
export type UnderlyingReturn = FunctionReturn<typeof functions.underlying>

