import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    AccrueInterest: event("0x9d9bd501d0657d7dfe415f779a620a62b78bc508ddc0891fbbd8b7ac0f8fce87", "AccrueInterest(bytes32,uint256,uint256,uint256)", {"id": indexed(p.bytes32), "prevBorrowRate": p.uint256, "interest": p.uint256, "feeShares": p.uint256}),
    Borrow: event("0x570954540bed6b1304a87dfe815a5eda4a648f7097a16240dcd85c9b5fd42a43", "Borrow(bytes32,address,address,address,uint256,uint256)", {"id": indexed(p.bytes32), "caller": p.address, "onBehalf": indexed(p.address), "receiver": indexed(p.address), "assets": p.uint256, "shares": p.uint256}),
    CreateMarket: event("0xac4b2400f169220b0c0afdde7a0b32e775ba727ea1cb30b35f935cdaab8683ac", "CreateMarket(bytes32,(address,address,address,address,uint256))", {"id": indexed(p.bytes32), "marketParams": p.struct({"loanToken": p.address, "collateralToken": p.address, "oracle": p.address, "irm": p.address, "lltv": p.uint256})}),
    EnableIrm: event("0x590e04cdebeccba40f566186b9746ad295a4cd358ea4fefaaea6ce79630d96c0", "EnableIrm(address)", {"irm": indexed(p.address)}),
    EnableLltv: event("0x297b80e7a896fad470c630f6575072d609bde997260ff3db851939405ec29139", "EnableLltv(uint256)", {"lltv": p.uint256}),
    FlashLoan: event("0xc76f1b4fe4396ac07a9fa55a415d4ca430e72651d37d3401f3bed7cb13fc4f12", "FlashLoan(address,address,uint256)", {"caller": indexed(p.address), "token": indexed(p.address), "assets": p.uint256}),
    IncrementNonce: event("0xa58af1a0c70dba0c7aa60d1a1a147ebd61000d1690a968828ac718bca927f2c7", "IncrementNonce(address,address,uint256)", {"caller": indexed(p.address), "authorizer": indexed(p.address), "usedNonce": p.uint256}),
    Liquidate: event("0xa4946ede45d0c6f06a0f5ce92c9ad3b4751452d2fe0e25010783bcab57a67e41", "Liquidate(bytes32,address,address,uint256,uint256,uint256,uint256,uint256)", {"id": indexed(p.bytes32), "caller": indexed(p.address), "borrower": indexed(p.address), "repaidAssets": p.uint256, "repaidShares": p.uint256, "seizedAssets": p.uint256, "badDebtAssets": p.uint256, "badDebtShares": p.uint256}),
    Repay: event("0x52acb05cebbd3cd39715469f22afbf5a17496295ef3bc9bb5944056c63ccaa09", "Repay(bytes32,address,address,uint256,uint256)", {"id": indexed(p.bytes32), "caller": indexed(p.address), "onBehalf": indexed(p.address), "assets": p.uint256, "shares": p.uint256}),
    SetAuthorization: event("0xd5e969f01efe921d3f766bdebad25f0a05e3f237311f56482bf132d0326309c0", "SetAuthorization(address,address,address,bool)", {"caller": indexed(p.address), "authorizer": indexed(p.address), "authorized": indexed(p.address), "newIsAuthorized": p.bool}),
    SetFee: event("0x139d6f58e9a127229667c8e3b36e88890a66cfc8ab1024ddc513e189e125b75b", "SetFee(bytes32,uint256)", {"id": indexed(p.bytes32), "newFee": p.uint256}),
    SetFeeRecipient: event("0x2e979f80fe4d43055c584cf4a8467c55875ea36728fc37176c05acd784eb7a73", "SetFeeRecipient(address)", {"newFeeRecipient": indexed(p.address)}),
    SetOwner: event("0x167d3e9c1016ab80e58802ca9da10ce5c6a0f4debc46a2e7a2cd9e56899a4fb5", "SetOwner(address)", {"newOwner": indexed(p.address)}),
    Supply: event("0xedf8870433c83823eb071d3df1caa8d008f12f6440918c20d75a3602cda30fe0", "Supply(bytes32,address,address,uint256,uint256)", {"id": indexed(p.bytes32), "caller": indexed(p.address), "onBehalf": indexed(p.address), "assets": p.uint256, "shares": p.uint256}),
    SupplyCollateral: event("0xa3b9472a1399e17e123f3c2e6586c23e504184d504de59cdaa2b375e880c6184", "SupplyCollateral(bytes32,address,address,uint256)", {"id": indexed(p.bytes32), "caller": indexed(p.address), "onBehalf": indexed(p.address), "assets": p.uint256}),
    Withdraw: event("0xa56fc0ad5702ec05ce63666221f796fb62437c32db1aa1aa075fc6484cf58fbf", "Withdraw(bytes32,address,address,address,uint256,uint256)", {"id": indexed(p.bytes32), "caller": p.address, "onBehalf": indexed(p.address), "receiver": indexed(p.address), "assets": p.uint256, "shares": p.uint256}),
    WithdrawCollateral: event("0xe80ebd7cc9223d7382aab2e0d1d6155c65651f83d53c8b9b06901d167e321142", "WithdrawCollateral(bytes32,address,address,address,uint256)", {"id": indexed(p.bytes32), "caller": p.address, "onBehalf": indexed(p.address), "receiver": indexed(p.address), "assets": p.uint256}),
}

export const functions = {
    DOMAIN_SEPARATOR: viewFun("0x3644e515", "DOMAIN_SEPARATOR()", {}, p.bytes32),
    accrueInterest: fun("0x151c1ade", "accrueInterest((address,address,address,address,uint256))", {"marketParams": p.struct({"loanToken": p.address, "collateralToken": p.address, "oracle": p.address, "irm": p.address, "lltv": p.uint256})}, ),
    borrow: fun("0x50d8cd4b", "borrow((address,address,address,address,uint256),uint256,uint256,address,address)", {"marketParams": p.struct({"loanToken": p.address, "collateralToken": p.address, "oracle": p.address, "irm": p.address, "lltv": p.uint256}), "assets": p.uint256, "shares": p.uint256, "onBehalf": p.address, "receiver": p.address}, {"_0": p.uint256, "_1": p.uint256}),
    createMarket: fun("0x8c1358a2", "createMarket((address,address,address,address,uint256))", {"marketParams": p.struct({"loanToken": p.address, "collateralToken": p.address, "oracle": p.address, "irm": p.address, "lltv": p.uint256})}, ),
    enableIrm: fun("0x5a64f51e", "enableIrm(address)", {"irm": p.address}, ),
    enableLltv: fun("0x4d98a93b", "enableLltv(uint256)", {"lltv": p.uint256}, ),
    extSloads: viewFun("0x7784c685", "extSloads(bytes32[])", {"slots": p.array(p.bytes32)}, p.array(p.bytes32)),
    feeRecipient: viewFun("0x46904840", "feeRecipient()", {}, p.address),
    flashLoan: fun("0xe0232b42", "flashLoan(address,uint256,bytes)", {"token": p.address, "assets": p.uint256, "data": p.bytes}, ),
    idToMarketParams: viewFun("0x2c3c9157", "idToMarketParams(bytes32)", {"_0": p.bytes32}, {"loanToken": p.address, "collateralToken": p.address, "oracle": p.address, "irm": p.address, "lltv": p.uint256}),
    isAuthorized: viewFun("0x65e4ad9e", "isAuthorized(address,address)", {"_0": p.address, "_1": p.address}, p.bool),
    isIrmEnabled: viewFun("0xf2b863ce", "isIrmEnabled(address)", {"_0": p.address}, p.bool),
    isLltvEnabled: viewFun("0xb485f3b8", "isLltvEnabled(uint256)", {"_0": p.uint256}, p.bool),
    liquidate: fun("0xd8eabcb8", "liquidate((address,address,address,address,uint256),address,uint256,uint256,bytes)", {"marketParams": p.struct({"loanToken": p.address, "collateralToken": p.address, "oracle": p.address, "irm": p.address, "lltv": p.uint256}), "borrower": p.address, "seizedAssets": p.uint256, "repaidShares": p.uint256, "data": p.bytes}, {"_0": p.uint256, "_1": p.uint256}),
    market: viewFun("0x5c60e39a", "market(bytes32)", {"_0": p.bytes32}, {"totalSupplyAssets": p.uint128, "totalSupplyShares": p.uint128, "totalBorrowAssets": p.uint128, "totalBorrowShares": p.uint128, "lastUpdate": p.uint128, "fee": p.uint128}),
    nonce: viewFun("0x70ae92d2", "nonce(address)", {"_0": p.address}, p.uint256),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    position: viewFun("0x93c52062", "position(bytes32,address)", {"_0": p.bytes32, "_1": p.address}, {"supplyShares": p.uint256, "borrowShares": p.uint128, "collateral": p.uint128}),
    repay: fun("0x20b76e81", "repay((address,address,address,address,uint256),uint256,uint256,address,bytes)", {"marketParams": p.struct({"loanToken": p.address, "collateralToken": p.address, "oracle": p.address, "irm": p.address, "lltv": p.uint256}), "assets": p.uint256, "shares": p.uint256, "onBehalf": p.address, "data": p.bytes}, {"_0": p.uint256, "_1": p.uint256}),
    setAuthorization: fun("0xeecea000", "setAuthorization(address,bool)", {"authorized": p.address, "newIsAuthorized": p.bool}, ),
    setAuthorizationWithSig: fun("0x8069218f", "setAuthorizationWithSig((address,address,bool,uint256,uint256),(uint8,bytes32,bytes32))", {"authorization": p.struct({"authorizer": p.address, "authorized": p.address, "isAuthorized": p.bool, "nonce": p.uint256, "deadline": p.uint256}), "signature": p.struct({"v": p.uint8, "r": p.bytes32, "s": p.bytes32})}, ),
    setFee: fun("0x2b4f013c", "setFee((address,address,address,address,uint256),uint256)", {"marketParams": p.struct({"loanToken": p.address, "collateralToken": p.address, "oracle": p.address, "irm": p.address, "lltv": p.uint256}), "newFee": p.uint256}, ),
    setFeeRecipient: fun("0xe74b981b", "setFeeRecipient(address)", {"newFeeRecipient": p.address}, ),
    setOwner: fun("0x13af4035", "setOwner(address)", {"newOwner": p.address}, ),
    supply: fun("0xa99aad89", "supply((address,address,address,address,uint256),uint256,uint256,address,bytes)", {"marketParams": p.struct({"loanToken": p.address, "collateralToken": p.address, "oracle": p.address, "irm": p.address, "lltv": p.uint256}), "assets": p.uint256, "shares": p.uint256, "onBehalf": p.address, "data": p.bytes}, {"_0": p.uint256, "_1": p.uint256}),
    supplyCollateral: fun("0x238d6579", "supplyCollateral((address,address,address,address,uint256),uint256,address,bytes)", {"marketParams": p.struct({"loanToken": p.address, "collateralToken": p.address, "oracle": p.address, "irm": p.address, "lltv": p.uint256}), "assets": p.uint256, "onBehalf": p.address, "data": p.bytes}, ),
    withdraw: fun("0x5c2bea49", "withdraw((address,address,address,address,uint256),uint256,uint256,address,address)", {"marketParams": p.struct({"loanToken": p.address, "collateralToken": p.address, "oracle": p.address, "irm": p.address, "lltv": p.uint256}), "assets": p.uint256, "shares": p.uint256, "onBehalf": p.address, "receiver": p.address}, {"_0": p.uint256, "_1": p.uint256}),
    withdrawCollateral: fun("0x8720316d", "withdrawCollateral((address,address,address,address,uint256),uint256,address,address)", {"marketParams": p.struct({"loanToken": p.address, "collateralToken": p.address, "oracle": p.address, "irm": p.address, "lltv": p.uint256}), "assets": p.uint256, "onBehalf": p.address, "receiver": p.address}, ),
}

export class Contract extends ContractBase {

    DOMAIN_SEPARATOR() {
        return this.eth_call(functions.DOMAIN_SEPARATOR, {})
    }

    extSloads(slots: ExtSloadsParams["slots"]) {
        return this.eth_call(functions.extSloads, {slots})
    }

    feeRecipient() {
        return this.eth_call(functions.feeRecipient, {})
    }

    idToMarketParams(_0: IdToMarketParamsParams["_0"]) {
        return this.eth_call(functions.idToMarketParams, {_0})
    }

    isAuthorized(_0: IsAuthorizedParams["_0"], _1: IsAuthorizedParams["_1"]) {
        return this.eth_call(functions.isAuthorized, {_0, _1})
    }

    isIrmEnabled(_0: IsIrmEnabledParams["_0"]) {
        return this.eth_call(functions.isIrmEnabled, {_0})
    }

    isLltvEnabled(_0: IsLltvEnabledParams["_0"]) {
        return this.eth_call(functions.isLltvEnabled, {_0})
    }

    market(_0: MarketParams["_0"]) {
        return this.eth_call(functions.market, {_0})
    }

    nonce(_0: NonceParams["_0"]) {
        return this.eth_call(functions.nonce, {_0})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    position(_0: PositionParams["_0"], _1: PositionParams["_1"]) {
        return this.eth_call(functions.position, {_0, _1})
    }
}

/// Event types
export type AccrueInterestEventArgs = EParams<typeof events.AccrueInterest>
export type BorrowEventArgs = EParams<typeof events.Borrow>
export type CreateMarketEventArgs = EParams<typeof events.CreateMarket>
export type EnableIrmEventArgs = EParams<typeof events.EnableIrm>
export type EnableLltvEventArgs = EParams<typeof events.EnableLltv>
export type FlashLoanEventArgs = EParams<typeof events.FlashLoan>
export type IncrementNonceEventArgs = EParams<typeof events.IncrementNonce>
export type LiquidateEventArgs = EParams<typeof events.Liquidate>
export type RepayEventArgs = EParams<typeof events.Repay>
export type SetAuthorizationEventArgs = EParams<typeof events.SetAuthorization>
export type SetFeeEventArgs = EParams<typeof events.SetFee>
export type SetFeeRecipientEventArgs = EParams<typeof events.SetFeeRecipient>
export type SetOwnerEventArgs = EParams<typeof events.SetOwner>
export type SupplyEventArgs = EParams<typeof events.Supply>
export type SupplyCollateralEventArgs = EParams<typeof events.SupplyCollateral>
export type WithdrawEventArgs = EParams<typeof events.Withdraw>
export type WithdrawCollateralEventArgs = EParams<typeof events.WithdrawCollateral>

/// Function types
export type DOMAIN_SEPARATORParams = FunctionArguments<typeof functions.DOMAIN_SEPARATOR>
export type DOMAIN_SEPARATORReturn = FunctionReturn<typeof functions.DOMAIN_SEPARATOR>

export type AccrueInterestParams = FunctionArguments<typeof functions.accrueInterest>
export type AccrueInterestReturn = FunctionReturn<typeof functions.accrueInterest>

export type BorrowParams = FunctionArguments<typeof functions.borrow>
export type BorrowReturn = FunctionReturn<typeof functions.borrow>

export type CreateMarketParams = FunctionArguments<typeof functions.createMarket>
export type CreateMarketReturn = FunctionReturn<typeof functions.createMarket>

export type EnableIrmParams = FunctionArguments<typeof functions.enableIrm>
export type EnableIrmReturn = FunctionReturn<typeof functions.enableIrm>

export type EnableLltvParams = FunctionArguments<typeof functions.enableLltv>
export type EnableLltvReturn = FunctionReturn<typeof functions.enableLltv>

export type ExtSloadsParams = FunctionArguments<typeof functions.extSloads>
export type ExtSloadsReturn = FunctionReturn<typeof functions.extSloads>

export type FeeRecipientParams = FunctionArguments<typeof functions.feeRecipient>
export type FeeRecipientReturn = FunctionReturn<typeof functions.feeRecipient>

export type FlashLoanParams = FunctionArguments<typeof functions.flashLoan>
export type FlashLoanReturn = FunctionReturn<typeof functions.flashLoan>

export type IdToMarketParamsParams = FunctionArguments<typeof functions.idToMarketParams>
export type IdToMarketParamsReturn = FunctionReturn<typeof functions.idToMarketParams>

export type IsAuthorizedParams = FunctionArguments<typeof functions.isAuthorized>
export type IsAuthorizedReturn = FunctionReturn<typeof functions.isAuthorized>

export type IsIrmEnabledParams = FunctionArguments<typeof functions.isIrmEnabled>
export type IsIrmEnabledReturn = FunctionReturn<typeof functions.isIrmEnabled>

export type IsLltvEnabledParams = FunctionArguments<typeof functions.isLltvEnabled>
export type IsLltvEnabledReturn = FunctionReturn<typeof functions.isLltvEnabled>

export type LiquidateParams = FunctionArguments<typeof functions.liquidate>
export type LiquidateReturn = FunctionReturn<typeof functions.liquidate>

export type MarketParams = FunctionArguments<typeof functions.market>
export type MarketReturn = FunctionReturn<typeof functions.market>

export type NonceParams = FunctionArguments<typeof functions.nonce>
export type NonceReturn = FunctionReturn<typeof functions.nonce>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type PositionParams = FunctionArguments<typeof functions.position>
export type PositionReturn = FunctionReturn<typeof functions.position>

export type RepayParams = FunctionArguments<typeof functions.repay>
export type RepayReturn = FunctionReturn<typeof functions.repay>

export type SetAuthorizationParams = FunctionArguments<typeof functions.setAuthorization>
export type SetAuthorizationReturn = FunctionReturn<typeof functions.setAuthorization>

export type SetAuthorizationWithSigParams = FunctionArguments<typeof functions.setAuthorizationWithSig>
export type SetAuthorizationWithSigReturn = FunctionReturn<typeof functions.setAuthorizationWithSig>

export type SetFeeParams = FunctionArguments<typeof functions.setFee>
export type SetFeeReturn = FunctionReturn<typeof functions.setFee>

export type SetFeeRecipientParams = FunctionArguments<typeof functions.setFeeRecipient>
export type SetFeeRecipientReturn = FunctionReturn<typeof functions.setFeeRecipient>

export type SetOwnerParams = FunctionArguments<typeof functions.setOwner>
export type SetOwnerReturn = FunctionReturn<typeof functions.setOwner>

export type SupplyParams = FunctionArguments<typeof functions.supply>
export type SupplyReturn = FunctionReturn<typeof functions.supply>

export type SupplyCollateralParams = FunctionArguments<typeof functions.supplyCollateral>
export type SupplyCollateralReturn = FunctionReturn<typeof functions.supplyCollateral>

export type WithdrawParams = FunctionArguments<typeof functions.withdraw>
export type WithdrawReturn = FunctionReturn<typeof functions.withdraw>

export type WithdrawCollateralParams = FunctionArguments<typeof functions.withdrawCollateral>
export type WithdrawCollateralReturn = FunctionReturn<typeof functions.withdrawCollateral>

