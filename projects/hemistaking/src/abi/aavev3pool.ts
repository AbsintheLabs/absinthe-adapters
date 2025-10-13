import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    Borrow: event("0xb3d084820fb1a9decffb176436bd02558d15fac9b0ddfed8c465bc7359d7dce0", "Borrow(address,address,address,uint256,uint8,uint256,uint16)", {"reserve": indexed(p.address), "user": p.address, "onBehalfOf": indexed(p.address), "amount": p.uint256, "interestRateMode": p.uint8, "borrowRate": p.uint256, "referralCode": indexed(p.uint16)}),
    DeficitCovered: event("0x84b203e49f1a4b553088061534231969a68ad1c81be192205e96d23a206cb26a", "DeficitCovered(address,address,uint256)", {"reserve": indexed(p.address), "caller": p.address, "amountCovered": p.uint256}),
    DeficitCreated: event("0x2bccfb3fad376d59d7accf970515eb77b2f27b082c90ed0fb15583dd5a942699", "DeficitCreated(address,address,uint256)", {"user": indexed(p.address), "debtAsset": indexed(p.address), "amountCreated": p.uint256}),
    FlashLoan: event("0xefefaba5e921573100900a3ad9cf29f222d995fb3b6045797eaea7521bd8d6f0", "FlashLoan(address,address,address,uint256,uint8,uint256,uint16)", {"target": indexed(p.address), "initiator": p.address, "asset": indexed(p.address), "amount": p.uint256, "interestRateMode": p.uint8, "premium": p.uint256, "referralCode": indexed(p.uint16)}),
    IsolationModeTotalDebtUpdated: event("0xaef84d3b40895fd58c561f3998000f0583abb992a52fbdc99ace8e8de4d676a5", "IsolationModeTotalDebtUpdated(address,uint256)", {"asset": indexed(p.address), "totalDebt": p.uint256}),
    LiquidationCall: event("0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286", "LiquidationCall(address,address,address,uint256,uint256,address,bool)", {"collateralAsset": indexed(p.address), "debtAsset": indexed(p.address), "user": indexed(p.address), "debtToCover": p.uint256, "liquidatedCollateralAmount": p.uint256, "liquidator": p.address, "receiveAToken": p.bool}),
    MintedToTreasury: event("0xbfa21aa5d5f9a1f0120a95e7c0749f389863cbdbfff531aa7339077a5bc919de", "MintedToTreasury(address,uint256)", {"reserve": indexed(p.address), "amountMinted": p.uint256}),
    PositionManagerApproved: event("0x540e692f36c2fa13e7583c4deeffd91ce6bc04f91e7d84f295d9d858372875fc", "PositionManagerApproved(address,address)", {"user": indexed(p.address), "positionManager": indexed(p.address)}),
    PositionManagerRevoked: event("0x08c92c3870d10c79e9673fecea8f4ff261f8e6b661067d9ca63fd777882bff15", "PositionManagerRevoked(address,address)", {"user": indexed(p.address), "positionManager": indexed(p.address)}),
    Repay: event("0xa534c8dbe71f871f9f3530e97a74601fea17b426cae02e1c5aee42c96c784051", "Repay(address,address,address,uint256,bool)", {"reserve": indexed(p.address), "user": indexed(p.address), "repayer": indexed(p.address), "amount": p.uint256, "useATokens": p.bool}),
    ReserveDataUpdated: event("0x804c9b842b2748a22bb64b345453a3de7ca54a6ca45ce00d415894979e22897a", "ReserveDataUpdated(address,uint256,uint256,uint256,uint256,uint256)", {"reserve": indexed(p.address), "liquidityRate": p.uint256, "stableBorrowRate": p.uint256, "variableBorrowRate": p.uint256, "liquidityIndex": p.uint256, "variableBorrowIndex": p.uint256}),
    ReserveUsedAsCollateralDisabled: event("0x44c58d81365b66dd4b1a7f36c25aa97b8c71c361ee4937adc1a00000227db5dd", "ReserveUsedAsCollateralDisabled(address,address)", {"reserve": indexed(p.address), "user": indexed(p.address)}),
    ReserveUsedAsCollateralEnabled: event("0x00058a56ea94653cdf4f152d227ace22d4c00ad99e2a43f58cb7d9e3feb295f2", "ReserveUsedAsCollateralEnabled(address,address)", {"reserve": indexed(p.address), "user": indexed(p.address)}),
    Supply: event("0x2b627736bca15cd5381dcf80b0bf11fd197d01a037c52b927a881a10fb73ba61", "Supply(address,address,address,uint256,uint16)", {"reserve": indexed(p.address), "user": p.address, "onBehalfOf": indexed(p.address), "amount": p.uint256, "referralCode": indexed(p.uint16)}),
    UserEModeSet: event("0xd728da875fc88944cbf17638bcbe4af0eedaef63becd1d1c57cc097eb4608d84", "UserEModeSet(address,uint8)", {"user": indexed(p.address), "categoryId": p.uint8}),
    Withdraw: event("0x3115d1449a7b732c986cba18244e897a450f61e1bb8d589cd2e69e6c8924f9f7", "Withdraw(address,address,address,uint256)", {"reserve": indexed(p.address), "user": indexed(p.address), "to": indexed(p.address), "amount": p.uint256}),
}

export const functions = {
    ADDRESSES_PROVIDER: viewFun("0x0542975c", "ADDRESSES_PROVIDER()", {}, p.address),
    FLASHLOAN_PREMIUM_TOTAL: viewFun("0x074b2e43", "FLASHLOAN_PREMIUM_TOTAL()", {}, p.uint128),
    FLASHLOAN_PREMIUM_TO_PROTOCOL: viewFun("0x6a99c036", "FLASHLOAN_PREMIUM_TO_PROTOCOL()", {}, p.uint128),
    MAX_NUMBER_RESERVES: viewFun("0xf8119d51", "MAX_NUMBER_RESERVES()", {}, p.uint16),
    POOL_REVISION: viewFun("0x0148170e", "POOL_REVISION()", {}, p.uint256),
    RESERVE_INTEREST_RATE_STRATEGY: viewFun("0x1b8feb0e", "RESERVE_INTEREST_RATE_STRATEGY()", {}, p.address),
    UMBRELLA: viewFun("0x71459c15", "UMBRELLA()", {}, p.bytes32),
    approvePositionManager: fun("0xb8caa7c5", "approvePositionManager(address,bool)", {"positionManager": p.address, "approve": p.bool}, ),
    'borrow(address,uint256,uint256,uint16,address)': fun("0xa415bcad", "borrow(address,uint256,uint256,uint16,address)", {"asset": p.address, "amount": p.uint256, "interestRateMode": p.uint256, "referralCode": p.uint16, "onBehalfOf": p.address}, ),
    'borrow(bytes32)': fun("0xd5eed868", "borrow(bytes32)", {"args": p.bytes32}, ),
    configureEModeCategory: fun("0x7b75d7f4", "configureEModeCategory(uint8,(uint16,uint16,uint16,string))", {"id": p.uint8, "category": p.struct({"ltv": p.uint16, "liquidationThreshold": p.uint16, "liquidationBonus": p.uint16, "label": p.string})}, ),
    configureEModeCategoryBorrowableBitmap: fun("0xff72158a", "configureEModeCategoryBorrowableBitmap(uint8,uint128)", {"id": p.uint8, "borrowableBitmap": p.uint128}, ),
    configureEModeCategoryCollateralBitmap: fun("0x92380ecb", "configureEModeCategoryCollateralBitmap(uint8,uint128)", {"id": p.uint8, "collateralBitmap": p.uint128}, ),
    deposit: fun("0xe8eda9df", "deposit(address,uint256,address,uint16)", {"asset": p.address, "amount": p.uint256, "onBehalfOf": p.address, "referralCode": p.uint16}, ),
    dropReserve: fun("0x63c9b860", "dropReserve(address)", {"asset": p.address}, ),
    eliminateReserveDeficit: fun("0xa1d2f3c4", "eliminateReserveDeficit(address,uint256)", {"asset": p.address, "amount": p.uint256}, p.uint256),
    finalizeTransfer: fun("0xd5ed3933", "finalizeTransfer(address,address,address,uint256,uint256,uint256)", {"asset": p.address, "from": p.address, "to": p.address, "scaledAmount": p.uint256, "scaledBalanceFromBefore": p.uint256, "scaledBalanceToBefore": p.uint256}, ),
    flashLoan: fun("0xab9c4b5d", "flashLoan(address,address[],uint256[],uint256[],address,bytes,uint16)", {"receiverAddress": p.address, "assets": p.array(p.address), "amounts": p.array(p.uint256), "interestRateModes": p.array(p.uint256), "onBehalfOf": p.address, "params": p.bytes, "referralCode": p.uint16}, ),
    flashLoanSimple: fun("0x42b0b77c", "flashLoanSimple(address,address,uint256,bytes,uint16)", {"receiverAddress": p.address, "asset": p.address, "amount": p.uint256, "params": p.bytes, "referralCode": p.uint16}, ),
    getBorrowLogic: viewFun("0x2be29fa7", "getBorrowLogic()", {}, p.address),
    getConfiguration: viewFun("0xc44b11f7", "getConfiguration(address)", {"asset": p.address}, p.struct({"data": p.uint256})),
    getEModeCategoryBorrowableBitmap: viewFun("0x903a2c71", "getEModeCategoryBorrowableBitmap(uint8)", {"id": p.uint8}, p.uint128),
    getEModeCategoryCollateralBitmap: viewFun("0xb0771dba", "getEModeCategoryCollateralBitmap(uint8)", {"id": p.uint8}, p.uint128),
    getEModeCategoryCollateralConfig: viewFun("0xb286f467", "getEModeCategoryCollateralConfig(uint8)", {"id": p.uint8}, p.struct({"ltv": p.uint16, "liquidationThreshold": p.uint16, "liquidationBonus": p.uint16})),
    getEModeCategoryData: viewFun("0x6c6f6ae1", "getEModeCategoryData(uint8)", {"id": p.uint8}, p.struct({"ltv": p.uint16, "liquidationThreshold": p.uint16, "liquidationBonus": p.uint16, "priceSource": p.address, "label": p.string})),
    getEModeCategoryLabel: viewFun("0x2083e183", "getEModeCategoryLabel(uint8)", {"id": p.uint8}, p.string),
    getEModeLogic: viewFun("0xf32b9a73", "getEModeLogic()", {}, p.address),
    getFlashLoanLogic: viewFun("0x348fde0f", "getFlashLoanLogic()", {}, p.address),
    getLiquidationGracePeriod: viewFun("0x5c9a8b18", "getLiquidationGracePeriod(address)", {"asset": p.address}, p.uint40),
    getLiquidationLogic: viewFun("0x911a3413", "getLiquidationLogic()", {}, p.address),
    getPoolLogic: viewFun("0xd3350155", "getPoolLogic()", {}, p.address),
    getReserveAToken: viewFun("0xcff027d9", "getReserveAToken(address)", {"asset": p.address}, p.address),
    getReserveAddressById: viewFun("0x52751797", "getReserveAddressById(uint16)", {"id": p.uint16}, p.address),
    getReserveData: viewFun("0x35ea6a75", "getReserveData(address)", {"asset": p.address}, p.struct({"configuration": p.struct({"data": p.uint256}), "liquidityIndex": p.uint128, "currentLiquidityRate": p.uint128, "variableBorrowIndex": p.uint128, "currentVariableBorrowRate": p.uint128, "currentStableBorrowRate": p.uint128, "lastUpdateTimestamp": p.uint40, "id": p.uint16, "aTokenAddress": p.address, "stableDebtTokenAddress": p.address, "variableDebtTokenAddress": p.address, "interestRateStrategyAddress": p.address, "accruedToTreasury": p.uint128, "unbacked": p.uint128, "isolationModeTotalDebt": p.uint128})),
    getReserveDeficit: viewFun("0xc952485d", "getReserveDeficit(address)", {"asset": p.address}, p.uint256),
    getReserveNormalizedIncome: viewFun("0xd15e0053", "getReserveNormalizedIncome(address)", {"asset": p.address}, p.uint256),
    getReserveNormalizedVariableDebt: viewFun("0x386497fd", "getReserveNormalizedVariableDebt(address)", {"asset": p.address}, p.uint256),
    getReserveVariableDebtToken: viewFun("0x365090a0", "getReserveVariableDebtToken(address)", {"asset": p.address}, p.address),
    getReservesCount: viewFun("0x72218d04", "getReservesCount()", {}, p.uint256),
    getReservesList: viewFun("0xd1946dbc", "getReservesList()", {}, p.array(p.address)),
    getSupplyLogic: viewFun("0x870e7744", "getSupplyLogic()", {}, p.address),
    getUserAccountData: viewFun("0xbf92857c", "getUserAccountData(address)", {"user": p.address}, {"totalCollateralBase": p.uint256, "totalDebtBase": p.uint256, "availableBorrowsBase": p.uint256, "currentLiquidationThreshold": p.uint256, "ltv": p.uint256, "healthFactor": p.uint256}),
    getUserConfiguration: viewFun("0x4417a583", "getUserConfiguration(address)", {"user": p.address}, p.struct({"data": p.uint256})),
    getUserEMode: viewFun("0xeddf1b79", "getUserEMode(address)", {"user": p.address}, p.uint256),
    getVirtualUnderlyingBalance: viewFun("0x6fb07f96", "getVirtualUnderlyingBalance(address)", {"asset": p.address}, p.uint128),
    initReserve: fun("0x932f12c8", "initReserve(address,address,address)", {"asset": p.address, "aTokenAddress": p.address, "variableDebtAddress": p.address}, ),
    initialize: fun("0xc4d66de8", "initialize(address)", {"provider": p.address}, ),
    isApprovedPositionManager: viewFun("0xf9c2bd87", "isApprovedPositionManager(address,address)", {"user": p.address, "positionManager": p.address}, p.bool),
    'liquidationCall(address,address,address,uint256,bool)': fun("0x00a718a9", "liquidationCall(address,address,address,uint256,bool)", {"collateralAsset": p.address, "debtAsset": p.address, "borrower": p.address, "debtToCover": p.uint256, "receiveAToken": p.bool}, ),
    'liquidationCall(bytes32,bytes32)': fun("0xfd21ecff", "liquidationCall(bytes32,bytes32)", {"args1": p.bytes32, "args2": p.bytes32}, ),
    mintToTreasury: fun("0x9cd19996", "mintToTreasury(address[])", {"assets": p.array(p.address)}, ),
    multicall: fun("0xac9650d8", "multicall(bytes[])", {"data": p.array(p.bytes)}, p.array(p.bytes)),
    renouncePositionManagerRole: fun("0xfea149a6", "renouncePositionManagerRole(address)", {"user": p.address}, ),
    'repay(bytes32)': fun("0x563dd613", "repay(bytes32)", {"args": p.bytes32}, p.uint256),
    'repay(address,uint256,uint256,address)': fun("0x573ade81", "repay(address,uint256,uint256,address)", {"asset": p.address, "amount": p.uint256, "interestRateMode": p.uint256, "onBehalfOf": p.address}, p.uint256),
    'repayWithATokens(address,uint256,uint256)': fun("0x2dad97d4", "repayWithATokens(address,uint256,uint256)", {"asset": p.address, "amount": p.uint256, "interestRateMode": p.uint256}, p.uint256),
    'repayWithATokens(bytes32)': fun("0xdc7c0bff", "repayWithATokens(bytes32)", {"args": p.bytes32}, p.uint256),
    'repayWithPermit(bytes32,bytes32,bytes32)': fun("0x94b576de", "repayWithPermit(bytes32,bytes32,bytes32)", {"args": p.bytes32, "r": p.bytes32, "s": p.bytes32}, p.uint256),
    'repayWithPermit(address,uint256,uint256,address,uint256,uint8,bytes32,bytes32)': fun("0xee3e210b", "repayWithPermit(address,uint256,uint256,address,uint256,uint8,bytes32,bytes32)", {"asset": p.address, "amount": p.uint256, "interestRateMode": p.uint256, "onBehalfOf": p.address, "deadline": p.uint256, "permitV": p.uint8, "permitR": p.bytes32, "permitS": p.bytes32}, p.uint256),
    rescueTokens: fun("0xcea9d26f", "rescueTokens(address,address,uint256)", {"token": p.address, "to": p.address, "amount": p.uint256}, ),
    resetIsolationModeTotalDebt: fun("0xe43e88a1", "resetIsolationModeTotalDebt(address)", {"asset": p.address}, ),
    setConfiguration: fun("0xf51e435b", "setConfiguration(address,(uint256))", {"asset": p.address, "configuration": p.struct({"data": p.uint256})}, ),
    setLiquidationGracePeriod: fun("0xb1a99e26", "setLiquidationGracePeriod(address,uint40)", {"asset": p.address, "until": p.uint40}, ),
    setUserEMode: fun("0x28530a47", "setUserEMode(uint8)", {"categoryId": p.uint8}, ),
    setUserEModeOnBehalfOf: fun("0x4ba06814", "setUserEModeOnBehalfOf(uint8,address)", {"categoryId": p.uint8, "onBehalfOf": p.address}, ),
    'setUserUseReserveAsCollateral(bytes32)': fun("0x4d013f03", "setUserUseReserveAsCollateral(bytes32)", {"args": p.bytes32}, ),
    'setUserUseReserveAsCollateral(address,bool)': fun("0x5a3b74b9", "setUserUseReserveAsCollateral(address,bool)", {"asset": p.address, "useAsCollateral": p.bool}, ),
    setUserUseReserveAsCollateralOnBehalfOf: fun("0x972b35fa", "setUserUseReserveAsCollateralOnBehalfOf(address,bool,address)", {"asset": p.address, "useAsCollateral": p.bool, "onBehalfOf": p.address}, ),
    'supply(address,uint256,address,uint16)': fun("0x617ba037", "supply(address,uint256,address,uint16)", {"asset": p.address, "amount": p.uint256, "onBehalfOf": p.address, "referralCode": p.uint16}, ),
    'supply(bytes32)': fun("0xf7a73840", "supply(bytes32)", {"args": p.bytes32}, ),
    'supplyWithPermit(address,uint256,address,uint16,uint256,uint8,bytes32,bytes32)': fun("0x02c205f0", "supplyWithPermit(address,uint256,address,uint16,uint256,uint8,bytes32,bytes32)", {"asset": p.address, "amount": p.uint256, "onBehalfOf": p.address, "referralCode": p.uint16, "deadline": p.uint256, "permitV": p.uint8, "permitR": p.bytes32, "permitS": p.bytes32}, ),
    'supplyWithPermit(bytes32,bytes32,bytes32)': fun("0x680dd47c", "supplyWithPermit(bytes32,bytes32,bytes32)", {"args": p.bytes32, "r": p.bytes32, "s": p.bytes32}, ),
    syncIndexesState: fun("0xab2b51f6", "syncIndexesState(address)", {"asset": p.address}, ),
    syncRatesState: fun("0x98c7da4e", "syncRatesState(address)", {"asset": p.address}, ),
    updateFlashloanPremium: fun("0x9c1d5f00", "updateFlashloanPremium(uint128)", {"flashLoanPremium": p.uint128}, ),
    'withdraw(address,uint256,address)': fun("0x69328dec", "withdraw(address,uint256,address)", {"asset": p.address, "amount": p.uint256, "to": p.address}, p.uint256),
    'withdraw(bytes32)': fun("0x8e19899e", "withdraw(bytes32)", {"args": p.bytes32}, p.uint256),
}

export class Contract extends ContractBase {

    ADDRESSES_PROVIDER() {
        return this.eth_call(functions.ADDRESSES_PROVIDER, {})
    }

    FLASHLOAN_PREMIUM_TOTAL() {
        return this.eth_call(functions.FLASHLOAN_PREMIUM_TOTAL, {})
    }

    FLASHLOAN_PREMIUM_TO_PROTOCOL() {
        return this.eth_call(functions.FLASHLOAN_PREMIUM_TO_PROTOCOL, {})
    }

    MAX_NUMBER_RESERVES() {
        return this.eth_call(functions.MAX_NUMBER_RESERVES, {})
    }

    POOL_REVISION() {
        return this.eth_call(functions.POOL_REVISION, {})
    }

    RESERVE_INTEREST_RATE_STRATEGY() {
        return this.eth_call(functions.RESERVE_INTEREST_RATE_STRATEGY, {})
    }

    UMBRELLA() {
        return this.eth_call(functions.UMBRELLA, {})
    }

    getBorrowLogic() {
        return this.eth_call(functions.getBorrowLogic, {})
    }

    getConfiguration(asset: GetConfigurationParams["asset"]) {
        return this.eth_call(functions.getConfiguration, {asset})
    }

    getEModeCategoryBorrowableBitmap(id: GetEModeCategoryBorrowableBitmapParams["id"]) {
        return this.eth_call(functions.getEModeCategoryBorrowableBitmap, {id})
    }

    getEModeCategoryCollateralBitmap(id: GetEModeCategoryCollateralBitmapParams["id"]) {
        return this.eth_call(functions.getEModeCategoryCollateralBitmap, {id})
    }

    getEModeCategoryCollateralConfig(id: GetEModeCategoryCollateralConfigParams["id"]) {
        return this.eth_call(functions.getEModeCategoryCollateralConfig, {id})
    }

    getEModeCategoryData(id: GetEModeCategoryDataParams["id"]) {
        return this.eth_call(functions.getEModeCategoryData, {id})
    }

    getEModeCategoryLabel(id: GetEModeCategoryLabelParams["id"]) {
        return this.eth_call(functions.getEModeCategoryLabel, {id})
    }

    getEModeLogic() {
        return this.eth_call(functions.getEModeLogic, {})
    }

    getFlashLoanLogic() {
        return this.eth_call(functions.getFlashLoanLogic, {})
    }

    getLiquidationGracePeriod(asset: GetLiquidationGracePeriodParams["asset"]) {
        return this.eth_call(functions.getLiquidationGracePeriod, {asset})
    }

    getLiquidationLogic() {
        return this.eth_call(functions.getLiquidationLogic, {})
    }

    getPoolLogic() {
        return this.eth_call(functions.getPoolLogic, {})
    }

    getReserveAToken(asset: GetReserveATokenParams["asset"]) {
        return this.eth_call(functions.getReserveAToken, {asset})
    }

    getReserveAddressById(id: GetReserveAddressByIdParams["id"]) {
        return this.eth_call(functions.getReserveAddressById, {id})
    }

    getReserveData(asset: GetReserveDataParams["asset"]) {
        return this.eth_call(functions.getReserveData, {asset})
    }

    getReserveDeficit(asset: GetReserveDeficitParams["asset"]) {
        return this.eth_call(functions.getReserveDeficit, {asset})
    }

    getReserveNormalizedIncome(asset: GetReserveNormalizedIncomeParams["asset"]) {
        return this.eth_call(functions.getReserveNormalizedIncome, {asset})
    }

    getReserveNormalizedVariableDebt(asset: GetReserveNormalizedVariableDebtParams["asset"]) {
        return this.eth_call(functions.getReserveNormalizedVariableDebt, {asset})
    }

    getReserveVariableDebtToken(asset: GetReserveVariableDebtTokenParams["asset"]) {
        return this.eth_call(functions.getReserveVariableDebtToken, {asset})
    }

    getReservesCount() {
        return this.eth_call(functions.getReservesCount, {})
    }

    getReservesList() {
        return this.eth_call(functions.getReservesList, {})
    }

    getSupplyLogic() {
        return this.eth_call(functions.getSupplyLogic, {})
    }

    getUserAccountData(user: GetUserAccountDataParams["user"]) {
        return this.eth_call(functions.getUserAccountData, {user})
    }

    getUserConfiguration(user: GetUserConfigurationParams["user"]) {
        return this.eth_call(functions.getUserConfiguration, {user})
    }

    getUserEMode(user: GetUserEModeParams["user"]) {
        return this.eth_call(functions.getUserEMode, {user})
    }

    getVirtualUnderlyingBalance(asset: GetVirtualUnderlyingBalanceParams["asset"]) {
        return this.eth_call(functions.getVirtualUnderlyingBalance, {asset})
    }

    isApprovedPositionManager(user: IsApprovedPositionManagerParams["user"], positionManager: IsApprovedPositionManagerParams["positionManager"]) {
        return this.eth_call(functions.isApprovedPositionManager, {user, positionManager})
    }
}

/// Event types
export type BorrowEventArgs = EParams<typeof events.Borrow>
export type DeficitCoveredEventArgs = EParams<typeof events.DeficitCovered>
export type DeficitCreatedEventArgs = EParams<typeof events.DeficitCreated>
export type FlashLoanEventArgs = EParams<typeof events.FlashLoan>
export type IsolationModeTotalDebtUpdatedEventArgs = EParams<typeof events.IsolationModeTotalDebtUpdated>
export type LiquidationCallEventArgs = EParams<typeof events.LiquidationCall>
export type MintedToTreasuryEventArgs = EParams<typeof events.MintedToTreasury>
export type PositionManagerApprovedEventArgs = EParams<typeof events.PositionManagerApproved>
export type PositionManagerRevokedEventArgs = EParams<typeof events.PositionManagerRevoked>
export type RepayEventArgs = EParams<typeof events.Repay>
export type ReserveDataUpdatedEventArgs = EParams<typeof events.ReserveDataUpdated>
export type ReserveUsedAsCollateralDisabledEventArgs = EParams<typeof events.ReserveUsedAsCollateralDisabled>
export type ReserveUsedAsCollateralEnabledEventArgs = EParams<typeof events.ReserveUsedAsCollateralEnabled>
export type SupplyEventArgs = EParams<typeof events.Supply>
export type UserEModeSetEventArgs = EParams<typeof events.UserEModeSet>
export type WithdrawEventArgs = EParams<typeof events.Withdraw>

/// Function types
export type ADDRESSES_PROVIDERParams = FunctionArguments<typeof functions.ADDRESSES_PROVIDER>
export type ADDRESSES_PROVIDERReturn = FunctionReturn<typeof functions.ADDRESSES_PROVIDER>

export type FLASHLOAN_PREMIUM_TOTALParams = FunctionArguments<typeof functions.FLASHLOAN_PREMIUM_TOTAL>
export type FLASHLOAN_PREMIUM_TOTALReturn = FunctionReturn<typeof functions.FLASHLOAN_PREMIUM_TOTAL>

export type FLASHLOAN_PREMIUM_TO_PROTOCOLParams = FunctionArguments<typeof functions.FLASHLOAN_PREMIUM_TO_PROTOCOL>
export type FLASHLOAN_PREMIUM_TO_PROTOCOLReturn = FunctionReturn<typeof functions.FLASHLOAN_PREMIUM_TO_PROTOCOL>

export type MAX_NUMBER_RESERVESParams = FunctionArguments<typeof functions.MAX_NUMBER_RESERVES>
export type MAX_NUMBER_RESERVESReturn = FunctionReturn<typeof functions.MAX_NUMBER_RESERVES>

export type POOL_REVISIONParams = FunctionArguments<typeof functions.POOL_REVISION>
export type POOL_REVISIONReturn = FunctionReturn<typeof functions.POOL_REVISION>

export type RESERVE_INTEREST_RATE_STRATEGYParams = FunctionArguments<typeof functions.RESERVE_INTEREST_RATE_STRATEGY>
export type RESERVE_INTEREST_RATE_STRATEGYReturn = FunctionReturn<typeof functions.RESERVE_INTEREST_RATE_STRATEGY>

export type UMBRELLAParams = FunctionArguments<typeof functions.UMBRELLA>
export type UMBRELLAReturn = FunctionReturn<typeof functions.UMBRELLA>

export type ApprovePositionManagerParams = FunctionArguments<typeof functions.approvePositionManager>
export type ApprovePositionManagerReturn = FunctionReturn<typeof functions.approvePositionManager>

export type BorrowParams_0 = FunctionArguments<typeof functions['borrow(address,uint256,uint256,uint16,address)']>
export type BorrowReturn_0 = FunctionReturn<typeof functions['borrow(address,uint256,uint256,uint16,address)']>

export type BorrowParams_1 = FunctionArguments<typeof functions['borrow(bytes32)']>
export type BorrowReturn_1 = FunctionReturn<typeof functions['borrow(bytes32)']>

export type ConfigureEModeCategoryParams = FunctionArguments<typeof functions.configureEModeCategory>
export type ConfigureEModeCategoryReturn = FunctionReturn<typeof functions.configureEModeCategory>

export type ConfigureEModeCategoryBorrowableBitmapParams = FunctionArguments<typeof functions.configureEModeCategoryBorrowableBitmap>
export type ConfigureEModeCategoryBorrowableBitmapReturn = FunctionReturn<typeof functions.configureEModeCategoryBorrowableBitmap>

export type ConfigureEModeCategoryCollateralBitmapParams = FunctionArguments<typeof functions.configureEModeCategoryCollateralBitmap>
export type ConfigureEModeCategoryCollateralBitmapReturn = FunctionReturn<typeof functions.configureEModeCategoryCollateralBitmap>

export type DepositParams = FunctionArguments<typeof functions.deposit>
export type DepositReturn = FunctionReturn<typeof functions.deposit>

export type DropReserveParams = FunctionArguments<typeof functions.dropReserve>
export type DropReserveReturn = FunctionReturn<typeof functions.dropReserve>

export type EliminateReserveDeficitParams = FunctionArguments<typeof functions.eliminateReserveDeficit>
export type EliminateReserveDeficitReturn = FunctionReturn<typeof functions.eliminateReserveDeficit>

export type FinalizeTransferParams = FunctionArguments<typeof functions.finalizeTransfer>
export type FinalizeTransferReturn = FunctionReturn<typeof functions.finalizeTransfer>

export type FlashLoanParams = FunctionArguments<typeof functions.flashLoan>
export type FlashLoanReturn = FunctionReturn<typeof functions.flashLoan>

export type FlashLoanSimpleParams = FunctionArguments<typeof functions.flashLoanSimple>
export type FlashLoanSimpleReturn = FunctionReturn<typeof functions.flashLoanSimple>

export type GetBorrowLogicParams = FunctionArguments<typeof functions.getBorrowLogic>
export type GetBorrowLogicReturn = FunctionReturn<typeof functions.getBorrowLogic>

export type GetConfigurationParams = FunctionArguments<typeof functions.getConfiguration>
export type GetConfigurationReturn = FunctionReturn<typeof functions.getConfiguration>

export type GetEModeCategoryBorrowableBitmapParams = FunctionArguments<typeof functions.getEModeCategoryBorrowableBitmap>
export type GetEModeCategoryBorrowableBitmapReturn = FunctionReturn<typeof functions.getEModeCategoryBorrowableBitmap>

export type GetEModeCategoryCollateralBitmapParams = FunctionArguments<typeof functions.getEModeCategoryCollateralBitmap>
export type GetEModeCategoryCollateralBitmapReturn = FunctionReturn<typeof functions.getEModeCategoryCollateralBitmap>

export type GetEModeCategoryCollateralConfigParams = FunctionArguments<typeof functions.getEModeCategoryCollateralConfig>
export type GetEModeCategoryCollateralConfigReturn = FunctionReturn<typeof functions.getEModeCategoryCollateralConfig>

export type GetEModeCategoryDataParams = FunctionArguments<typeof functions.getEModeCategoryData>
export type GetEModeCategoryDataReturn = FunctionReturn<typeof functions.getEModeCategoryData>

export type GetEModeCategoryLabelParams = FunctionArguments<typeof functions.getEModeCategoryLabel>
export type GetEModeCategoryLabelReturn = FunctionReturn<typeof functions.getEModeCategoryLabel>

export type GetEModeLogicParams = FunctionArguments<typeof functions.getEModeLogic>
export type GetEModeLogicReturn = FunctionReturn<typeof functions.getEModeLogic>

export type GetFlashLoanLogicParams = FunctionArguments<typeof functions.getFlashLoanLogic>
export type GetFlashLoanLogicReturn = FunctionReturn<typeof functions.getFlashLoanLogic>

export type GetLiquidationGracePeriodParams = FunctionArguments<typeof functions.getLiquidationGracePeriod>
export type GetLiquidationGracePeriodReturn = FunctionReturn<typeof functions.getLiquidationGracePeriod>

export type GetLiquidationLogicParams = FunctionArguments<typeof functions.getLiquidationLogic>
export type GetLiquidationLogicReturn = FunctionReturn<typeof functions.getLiquidationLogic>

export type GetPoolLogicParams = FunctionArguments<typeof functions.getPoolLogic>
export type GetPoolLogicReturn = FunctionReturn<typeof functions.getPoolLogic>

export type GetReserveATokenParams = FunctionArguments<typeof functions.getReserveAToken>
export type GetReserveATokenReturn = FunctionReturn<typeof functions.getReserveAToken>

export type GetReserveAddressByIdParams = FunctionArguments<typeof functions.getReserveAddressById>
export type GetReserveAddressByIdReturn = FunctionReturn<typeof functions.getReserveAddressById>

export type GetReserveDataParams = FunctionArguments<typeof functions.getReserveData>
export type GetReserveDataReturn = FunctionReturn<typeof functions.getReserveData>

export type GetReserveDeficitParams = FunctionArguments<typeof functions.getReserveDeficit>
export type GetReserveDeficitReturn = FunctionReturn<typeof functions.getReserveDeficit>

export type GetReserveNormalizedIncomeParams = FunctionArguments<typeof functions.getReserveNormalizedIncome>
export type GetReserveNormalizedIncomeReturn = FunctionReturn<typeof functions.getReserveNormalizedIncome>

export type GetReserveNormalizedVariableDebtParams = FunctionArguments<typeof functions.getReserveNormalizedVariableDebt>
export type GetReserveNormalizedVariableDebtReturn = FunctionReturn<typeof functions.getReserveNormalizedVariableDebt>

export type GetReserveVariableDebtTokenParams = FunctionArguments<typeof functions.getReserveVariableDebtToken>
export type GetReserveVariableDebtTokenReturn = FunctionReturn<typeof functions.getReserveVariableDebtToken>

export type GetReservesCountParams = FunctionArguments<typeof functions.getReservesCount>
export type GetReservesCountReturn = FunctionReturn<typeof functions.getReservesCount>

export type GetReservesListParams = FunctionArguments<typeof functions.getReservesList>
export type GetReservesListReturn = FunctionReturn<typeof functions.getReservesList>

export type GetSupplyLogicParams = FunctionArguments<typeof functions.getSupplyLogic>
export type GetSupplyLogicReturn = FunctionReturn<typeof functions.getSupplyLogic>

export type GetUserAccountDataParams = FunctionArguments<typeof functions.getUserAccountData>
export type GetUserAccountDataReturn = FunctionReturn<typeof functions.getUserAccountData>

export type GetUserConfigurationParams = FunctionArguments<typeof functions.getUserConfiguration>
export type GetUserConfigurationReturn = FunctionReturn<typeof functions.getUserConfiguration>

export type GetUserEModeParams = FunctionArguments<typeof functions.getUserEMode>
export type GetUserEModeReturn = FunctionReturn<typeof functions.getUserEMode>

export type GetVirtualUnderlyingBalanceParams = FunctionArguments<typeof functions.getVirtualUnderlyingBalance>
export type GetVirtualUnderlyingBalanceReturn = FunctionReturn<typeof functions.getVirtualUnderlyingBalance>

export type InitReserveParams = FunctionArguments<typeof functions.initReserve>
export type InitReserveReturn = FunctionReturn<typeof functions.initReserve>

export type InitializeParams = FunctionArguments<typeof functions.initialize>
export type InitializeReturn = FunctionReturn<typeof functions.initialize>

export type IsApprovedPositionManagerParams = FunctionArguments<typeof functions.isApprovedPositionManager>
export type IsApprovedPositionManagerReturn = FunctionReturn<typeof functions.isApprovedPositionManager>

export type LiquidationCallParams_0 = FunctionArguments<typeof functions['liquidationCall(address,address,address,uint256,bool)']>
export type LiquidationCallReturn_0 = FunctionReturn<typeof functions['liquidationCall(address,address,address,uint256,bool)']>

export type LiquidationCallParams_1 = FunctionArguments<typeof functions['liquidationCall(bytes32,bytes32)']>
export type LiquidationCallReturn_1 = FunctionReturn<typeof functions['liquidationCall(bytes32,bytes32)']>

export type MintToTreasuryParams = FunctionArguments<typeof functions.mintToTreasury>
export type MintToTreasuryReturn = FunctionReturn<typeof functions.mintToTreasury>

export type MulticallParams = FunctionArguments<typeof functions.multicall>
export type MulticallReturn = FunctionReturn<typeof functions.multicall>

export type RenouncePositionManagerRoleParams = FunctionArguments<typeof functions.renouncePositionManagerRole>
export type RenouncePositionManagerRoleReturn = FunctionReturn<typeof functions.renouncePositionManagerRole>

export type RepayParams_0 = FunctionArguments<typeof functions['repay(bytes32)']>
export type RepayReturn_0 = FunctionReturn<typeof functions['repay(bytes32)']>

export type RepayParams_1 = FunctionArguments<typeof functions['repay(address,uint256,uint256,address)']>
export type RepayReturn_1 = FunctionReturn<typeof functions['repay(address,uint256,uint256,address)']>

export type RepayWithATokensParams_0 = FunctionArguments<typeof functions['repayWithATokens(address,uint256,uint256)']>
export type RepayWithATokensReturn_0 = FunctionReturn<typeof functions['repayWithATokens(address,uint256,uint256)']>

export type RepayWithATokensParams_1 = FunctionArguments<typeof functions['repayWithATokens(bytes32)']>
export type RepayWithATokensReturn_1 = FunctionReturn<typeof functions['repayWithATokens(bytes32)']>

export type RepayWithPermitParams_0 = FunctionArguments<typeof functions['repayWithPermit(bytes32,bytes32,bytes32)']>
export type RepayWithPermitReturn_0 = FunctionReturn<typeof functions['repayWithPermit(bytes32,bytes32,bytes32)']>

export type RepayWithPermitParams_1 = FunctionArguments<typeof functions['repayWithPermit(address,uint256,uint256,address,uint256,uint8,bytes32,bytes32)']>
export type RepayWithPermitReturn_1 = FunctionReturn<typeof functions['repayWithPermit(address,uint256,uint256,address,uint256,uint8,bytes32,bytes32)']>

export type RescueTokensParams = FunctionArguments<typeof functions.rescueTokens>
export type RescueTokensReturn = FunctionReturn<typeof functions.rescueTokens>

export type ResetIsolationModeTotalDebtParams = FunctionArguments<typeof functions.resetIsolationModeTotalDebt>
export type ResetIsolationModeTotalDebtReturn = FunctionReturn<typeof functions.resetIsolationModeTotalDebt>

export type SetConfigurationParams = FunctionArguments<typeof functions.setConfiguration>
export type SetConfigurationReturn = FunctionReturn<typeof functions.setConfiguration>

export type SetLiquidationGracePeriodParams = FunctionArguments<typeof functions.setLiquidationGracePeriod>
export type SetLiquidationGracePeriodReturn = FunctionReturn<typeof functions.setLiquidationGracePeriod>

export type SetUserEModeParams = FunctionArguments<typeof functions.setUserEMode>
export type SetUserEModeReturn = FunctionReturn<typeof functions.setUserEMode>

export type SetUserEModeOnBehalfOfParams = FunctionArguments<typeof functions.setUserEModeOnBehalfOf>
export type SetUserEModeOnBehalfOfReturn = FunctionReturn<typeof functions.setUserEModeOnBehalfOf>

export type SetUserUseReserveAsCollateralParams_0 = FunctionArguments<typeof functions['setUserUseReserveAsCollateral(bytes32)']>
export type SetUserUseReserveAsCollateralReturn_0 = FunctionReturn<typeof functions['setUserUseReserveAsCollateral(bytes32)']>

export type SetUserUseReserveAsCollateralParams_1 = FunctionArguments<typeof functions['setUserUseReserveAsCollateral(address,bool)']>
export type SetUserUseReserveAsCollateralReturn_1 = FunctionReturn<typeof functions['setUserUseReserveAsCollateral(address,bool)']>

export type SetUserUseReserveAsCollateralOnBehalfOfParams = FunctionArguments<typeof functions.setUserUseReserveAsCollateralOnBehalfOf>
export type SetUserUseReserveAsCollateralOnBehalfOfReturn = FunctionReturn<typeof functions.setUserUseReserveAsCollateralOnBehalfOf>

export type SupplyParams_0 = FunctionArguments<typeof functions['supply(address,uint256,address,uint16)']>
export type SupplyReturn_0 = FunctionReturn<typeof functions['supply(address,uint256,address,uint16)']>

export type SupplyParams_1 = FunctionArguments<typeof functions['supply(bytes32)']>
export type SupplyReturn_1 = FunctionReturn<typeof functions['supply(bytes32)']>

export type SupplyWithPermitParams_0 = FunctionArguments<typeof functions['supplyWithPermit(address,uint256,address,uint16,uint256,uint8,bytes32,bytes32)']>
export type SupplyWithPermitReturn_0 = FunctionReturn<typeof functions['supplyWithPermit(address,uint256,address,uint16,uint256,uint8,bytes32,bytes32)']>

export type SupplyWithPermitParams_1 = FunctionArguments<typeof functions['supplyWithPermit(bytes32,bytes32,bytes32)']>
export type SupplyWithPermitReturn_1 = FunctionReturn<typeof functions['supplyWithPermit(bytes32,bytes32,bytes32)']>

export type SyncIndexesStateParams = FunctionArguments<typeof functions.syncIndexesState>
export type SyncIndexesStateReturn = FunctionReturn<typeof functions.syncIndexesState>

export type SyncRatesStateParams = FunctionArguments<typeof functions.syncRatesState>
export type SyncRatesStateReturn = FunctionReturn<typeof functions.syncRatesState>

export type UpdateFlashloanPremiumParams = FunctionArguments<typeof functions.updateFlashloanPremium>
export type UpdateFlashloanPremiumReturn = FunctionReturn<typeof functions.updateFlashloanPremium>

export type WithdrawParams_0 = FunctionArguments<typeof functions['withdraw(address,uint256,address)']>
export type WithdrawReturn_0 = FunctionReturn<typeof functions['withdraw(address,uint256,address)']>

export type WithdrawParams_1 = FunctionArguments<typeof functions['withdraw(bytes32)']>
export type WithdrawReturn_1 = FunctionReturn<typeof functions['withdraw(bytes32)']>

