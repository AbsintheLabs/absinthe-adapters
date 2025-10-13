import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    Affiliate: event("0x3066ef5dd340e8b2ea28d62f5a8391eb7a82d3ee87532724a1ca4386d34f7523", "Affiliate(address,address)", {"sender": indexed(p.address), "affiliate": p.address}),
    AmmFeeRecipient: event("0xbb78b7c13893a913fa8c9ecb9fdaf97597aa412a39c778bf976790555f0942f7", "AmmFeeRecipient(address,address)", {"sender": indexed(p.address), "ammFeeRecipient": p.address}),
    Approval: event("0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925", "Approval(address,address,uint256)", {"owner": indexed(p.address), "spender": indexed(p.address), "value": p.uint256}),
    CollectFees: event("0xec8208dd791fa8ffdc0d7427f3ba9c0ed06f1bce9a86254e6940c10cc1802fef", "CollectFees(address,uint256,uint256)", {"sender": indexed(p.address), "feeAmount0": p.uint256, "feeAmount1": p.uint256}),
    DeployICHIVault: event("0x3e708ccf7d0e6de8558e020ea36189511cb3435bbfec54e721a48ee4df0d4f8c", "DeployICHIVault(address,address,bool,bool,address,uint256)", {"sender": indexed(p.address), "pool": indexed(p.address), "allowToken0": p.bool, "allowToken1": p.bool, "owner": p.address, "twapPeriod": p.uint256}),
    Deposit: event("0x4e2ca0515ed1aef1395f66b5303bb5d6f1bf9d61a353fa53f73f8ac9973fa9f6", "Deposit(address,address,uint256,uint256,uint256)", {"sender": indexed(p.address), "to": indexed(p.address), "shares": p.uint256, "amount0": p.uint256, "amount1": p.uint256}),
    DepositMax: event("0xafd3b05a4086b378b6f291200a528d8aed8c5e0317af77436b001f1bec28821a", "DepositMax(address,uint256,uint256)", {"sender": indexed(p.address), "deposit0Max": p.uint256, "deposit1Max": p.uint256}),
    Hysteresis: event("0x529698f34660760dcb172def5c99d62e1b5b74b444df322e8f7da31f2bd0a86b", "Hysteresis(address,uint256)", {"sender": indexed(p.address), "hysteresis": p.uint256}),
    OwnershipTransferred: event("0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0", "OwnershipTransferred(address,address)", {"previousOwner": indexed(p.address), "newOwner": indexed(p.address)}),
    Rebalance: event("0xbc4c20ad04f161d631d9ce94d27659391196415aa3c42f6a71c62e905ece782d", "Rebalance(int24,uint256,uint256,uint256,uint256,uint256)", {"tick": p.int24, "totalAmount0": p.uint256, "totalAmount1": p.uint256, "feeAmount0": p.uint256, "feeAmount1": p.uint256, "totalSupply": p.uint256}),
    SetAuxTwapPeriod: event("0x39da19f5960a3f182ced1ff1853b7be54f37150799b3003a40bf4e0d4c740c85", "SetAuxTwapPeriod(address,uint32)", {"sender": p.address, "newAuxTwapPeriod": p.uint32}),
    SetTwapPeriod: event("0xe4c60f4984caeb7f45b0cfe6d4233c115601ab11d141bc2cbf68b48346cdef38", "SetTwapPeriod(address,uint32)", {"sender": p.address, "newTwapPeriod": p.uint32}),
    Transfer: event("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "Transfer(address,address,uint256)", {"from": indexed(p.address), "to": indexed(p.address), "value": p.uint256}),
    Withdraw: event("0xebff2602b3f468259e1e99f613fed6691f3a6526effe6ef3e768ba7ae7a36c4f", "Withdraw(address,address,uint256,uint256,uint256)", {"sender": indexed(p.address), "to": indexed(p.address), "shares": p.uint256, "amount0": p.uint256, "amount1": p.uint256}),
}

export const functions = {
    PRECISION: viewFun("0xaaf5eb68", "PRECISION()", {}, p.uint256),
    affiliate: viewFun("0x45e05f43", "affiliate()", {}, p.address),
    allowToken0: viewFun("0x7f7a1eec", "allowToken0()", {}, p.bool),
    allowToken1: viewFun("0x37e41b40", "allowToken1()", {}, p.bool),
    allowance: viewFun("0xdd62ed3e", "allowance(address,address)", {"owner": p.address, "spender": p.address}, p.uint256),
    ammFeeRecipient: viewFun("0x897f078c", "ammFeeRecipient()", {}, p.address),
    approve: fun("0x095ea7b3", "approve(address,uint256)", {"spender": p.address, "amount": p.uint256}, p.bool),
    auxTwapPeriod: viewFun("0x91563d32", "auxTwapPeriod()", {}, p.uint32),
    balanceOf: viewFun("0x70a08231", "balanceOf(address)", {"account": p.address}, p.uint256),
    baseLower: viewFun("0xfa082743", "baseLower()", {}, p.int24),
    baseUpper: viewFun("0x888a9134", "baseUpper()", {}, p.int24),
    collectFees: fun("0xc8796572", "collectFees()", {}, {"fees0": p.uint256, "fees1": p.uint256}),
    currentTick: viewFun("0x065e5360", "currentTick()", {}, p.int24),
    decimals: viewFun("0x313ce567", "decimals()", {}, p.uint8),
    decreaseAllowance: fun("0xa457c2d7", "decreaseAllowance(address,uint256)", {"spender": p.address, "subtractedValue": p.uint256}, p.bool),
    deposit: fun("0x8dbdbe6d", "deposit(uint256,uint256,address)", {"deposit0": p.uint256, "deposit1": p.uint256, "to": p.address}, p.uint256),
    deposit0Max: viewFun("0x648cab85", "deposit0Max()", {}, p.uint256),
    deposit1Max: viewFun("0x4d461fbb", "deposit1Max()", {}, p.uint256),
    fee: viewFun("0xddca3f43", "fee()", {}, p.uint24),
    getBasePosition: viewFun("0xd2eabcfc", "getBasePosition()", {}, {"liquidity": p.uint128, "amount0": p.uint256, "amount1": p.uint256}),
    getLimitPosition: viewFun("0xa049de6b", "getLimitPosition()", {}, {"liquidity": p.uint128, "amount0": p.uint256, "amount1": p.uint256}),
    getTotalAmounts: viewFun("0xc4a7761e", "getTotalAmounts()", {}, {"total0": p.uint256, "total1": p.uint256}),
    hysteresis: viewFun("0x7aea5309", "hysteresis()", {}, p.uint256),
    ichiVaultFactory: viewFun("0xdd81fa63", "ichiVaultFactory()", {}, p.address),
    increaseAllowance: fun("0x39509351", "increaseAllowance(address,uint256)", {"spender": p.address, "addedValue": p.uint256}, p.bool),
    limitLower: viewFun("0x51e87af7", "limitLower()", {}, p.int24),
    limitUpper: viewFun("0x0f35bcac", "limitUpper()", {}, p.int24),
    name: viewFun("0x06fdde03", "name()", {}, p.string),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    pool: viewFun("0x16f0115b", "pool()", {}, p.address),
    rebalance: fun("0xd87346aa", "rebalance(int24,int24,int24,int24,int256)", {"_baseLower": p.int24, "_baseUpper": p.int24, "_limitLower": p.int24, "_limitUpper": p.int24, "swapQuantity": p.int256}, ),
    renounceOwnership: fun("0x715018a6", "renounceOwnership()", {}, ),
    setAffiliate: fun("0x2bbb56d9", "setAffiliate(address)", {"_affiliate": p.address}, ),
    setAmmFeeRecipient: fun("0x81de128b", "setAmmFeeRecipient(address)", {"_ammFeeRecipient": p.address}, ),
    setAuxTwapPeriod: fun("0x400f0ceb", "setAuxTwapPeriod(uint32)", {"newAuxTwapPeriod": p.uint32}, ),
    setDepositMax: fun("0x3e091ee9", "setDepositMax(uint256,uint256)", {"_deposit0Max": p.uint256, "_deposit1Max": p.uint256}, ),
    setHysteresis: fun("0x5ffc1ff7", "setHysteresis(uint256)", {"_hysteresis": p.uint256}, ),
    setTwapPeriod: fun("0xf9c95d46", "setTwapPeriod(uint32)", {"newTwapPeriod": p.uint32}, ),
    symbol: viewFun("0x95d89b41", "symbol()", {}, p.string),
    tickSpacing: viewFun("0xd0c93a7c", "tickSpacing()", {}, p.int24),
    token0: viewFun("0x0dfe1681", "token0()", {}, p.address),
    token1: viewFun("0xd21220a7", "token1()", {}, p.address),
    totalSupply: viewFun("0x18160ddd", "totalSupply()", {}, p.uint256),
    transfer: fun("0xa9059cbb", "transfer(address,uint256)", {"recipient": p.address, "amount": p.uint256}, p.bool),
    transferFrom: fun("0x23b872dd", "transferFrom(address,address,uint256)", {"sender": p.address, "recipient": p.address, "amount": p.uint256}, p.bool),
    transferOwnership: fun("0xf2fde38b", "transferOwnership(address)", {"newOwner": p.address}, ),
    twapPeriod: viewFun("0xf6207326", "twapPeriod()", {}, p.uint32),
    uniswapV3MintCallback: fun("0xd3487997", "uniswapV3MintCallback(uint256,uint256,bytes)", {"amount0": p.uint256, "amount1": p.uint256, "data": p.bytes}, ),
    uniswapV3SwapCallback: fun("0xfa461e33", "uniswapV3SwapCallback(int256,int256,bytes)", {"amount0Delta": p.int256, "amount1Delta": p.int256, "data": p.bytes}, ),
    withdraw: fun("0x00f714ce", "withdraw(uint256,address)", {"shares": p.uint256, "to": p.address}, {"amount0": p.uint256, "amount1": p.uint256}),
}

export class Contract extends ContractBase {

    PRECISION() {
        return this.eth_call(functions.PRECISION, {})
    }

    affiliate() {
        return this.eth_call(functions.affiliate, {})
    }

    allowToken0() {
        return this.eth_call(functions.allowToken0, {})
    }

    allowToken1() {
        return this.eth_call(functions.allowToken1, {})
    }

    allowance(owner: AllowanceParams["owner"], spender: AllowanceParams["spender"]) {
        return this.eth_call(functions.allowance, {owner, spender})
    }

    ammFeeRecipient() {
        return this.eth_call(functions.ammFeeRecipient, {})
    }

    auxTwapPeriod() {
        return this.eth_call(functions.auxTwapPeriod, {})
    }

    balanceOf(account: BalanceOfParams["account"]) {
        return this.eth_call(functions.balanceOf, {account})
    }

    baseLower() {
        return this.eth_call(functions.baseLower, {})
    }

    baseUpper() {
        return this.eth_call(functions.baseUpper, {})
    }

    currentTick() {
        return this.eth_call(functions.currentTick, {})
    }

    decimals() {
        return this.eth_call(functions.decimals, {})
    }

    deposit0Max() {
        return this.eth_call(functions.deposit0Max, {})
    }

    deposit1Max() {
        return this.eth_call(functions.deposit1Max, {})
    }

    fee() {
        return this.eth_call(functions.fee, {})
    }

    getBasePosition() {
        return this.eth_call(functions.getBasePosition, {})
    }

    getLimitPosition() {
        return this.eth_call(functions.getLimitPosition, {})
    }

    getTotalAmounts() {
        return this.eth_call(functions.getTotalAmounts, {})
    }

    hysteresis() {
        return this.eth_call(functions.hysteresis, {})
    }

    ichiVaultFactory() {
        return this.eth_call(functions.ichiVaultFactory, {})
    }

    limitLower() {
        return this.eth_call(functions.limitLower, {})
    }

    limitUpper() {
        return this.eth_call(functions.limitUpper, {})
    }

    name() {
        return this.eth_call(functions.name, {})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    pool() {
        return this.eth_call(functions.pool, {})
    }

    symbol() {
        return this.eth_call(functions.symbol, {})
    }

    tickSpacing() {
        return this.eth_call(functions.tickSpacing, {})
    }

    token0() {
        return this.eth_call(functions.token0, {})
    }

    token1() {
        return this.eth_call(functions.token1, {})
    }

    totalSupply() {
        return this.eth_call(functions.totalSupply, {})
    }

    twapPeriod() {
        return this.eth_call(functions.twapPeriod, {})
    }
}

/// Event types
export type AffiliateEventArgs = EParams<typeof events.Affiliate>
export type AmmFeeRecipientEventArgs = EParams<typeof events.AmmFeeRecipient>
export type ApprovalEventArgs = EParams<typeof events.Approval>
export type CollectFeesEventArgs = EParams<typeof events.CollectFees>
export type DeployICHIVaultEventArgs = EParams<typeof events.DeployICHIVault>
export type DepositEventArgs = EParams<typeof events.Deposit>
export type DepositMaxEventArgs = EParams<typeof events.DepositMax>
export type HysteresisEventArgs = EParams<typeof events.Hysteresis>
export type OwnershipTransferredEventArgs = EParams<typeof events.OwnershipTransferred>
export type RebalanceEventArgs = EParams<typeof events.Rebalance>
export type SetAuxTwapPeriodEventArgs = EParams<typeof events.SetAuxTwapPeriod>
export type SetTwapPeriodEventArgs = EParams<typeof events.SetTwapPeriod>
export type TransferEventArgs = EParams<typeof events.Transfer>
export type WithdrawEventArgs = EParams<typeof events.Withdraw>

/// Function types
export type PRECISIONParams = FunctionArguments<typeof functions.PRECISION>
export type PRECISIONReturn = FunctionReturn<typeof functions.PRECISION>

export type AffiliateParams = FunctionArguments<typeof functions.affiliate>
export type AffiliateReturn = FunctionReturn<typeof functions.affiliate>

export type AllowToken0Params = FunctionArguments<typeof functions.allowToken0>
export type AllowToken0Return = FunctionReturn<typeof functions.allowToken0>

export type AllowToken1Params = FunctionArguments<typeof functions.allowToken1>
export type AllowToken1Return = FunctionReturn<typeof functions.allowToken1>

export type AllowanceParams = FunctionArguments<typeof functions.allowance>
export type AllowanceReturn = FunctionReturn<typeof functions.allowance>

export type AmmFeeRecipientParams = FunctionArguments<typeof functions.ammFeeRecipient>
export type AmmFeeRecipientReturn = FunctionReturn<typeof functions.ammFeeRecipient>

export type ApproveParams = FunctionArguments<typeof functions.approve>
export type ApproveReturn = FunctionReturn<typeof functions.approve>

export type AuxTwapPeriodParams = FunctionArguments<typeof functions.auxTwapPeriod>
export type AuxTwapPeriodReturn = FunctionReturn<typeof functions.auxTwapPeriod>

export type BalanceOfParams = FunctionArguments<typeof functions.balanceOf>
export type BalanceOfReturn = FunctionReturn<typeof functions.balanceOf>

export type BaseLowerParams = FunctionArguments<typeof functions.baseLower>
export type BaseLowerReturn = FunctionReturn<typeof functions.baseLower>

export type BaseUpperParams = FunctionArguments<typeof functions.baseUpper>
export type BaseUpperReturn = FunctionReturn<typeof functions.baseUpper>

export type CollectFeesParams = FunctionArguments<typeof functions.collectFees>
export type CollectFeesReturn = FunctionReturn<typeof functions.collectFees>

export type CurrentTickParams = FunctionArguments<typeof functions.currentTick>
export type CurrentTickReturn = FunctionReturn<typeof functions.currentTick>

export type DecimalsParams = FunctionArguments<typeof functions.decimals>
export type DecimalsReturn = FunctionReturn<typeof functions.decimals>

export type DecreaseAllowanceParams = FunctionArguments<typeof functions.decreaseAllowance>
export type DecreaseAllowanceReturn = FunctionReturn<typeof functions.decreaseAllowance>

export type DepositParams = FunctionArguments<typeof functions.deposit>
export type DepositReturn = FunctionReturn<typeof functions.deposit>

export type Deposit0MaxParams = FunctionArguments<typeof functions.deposit0Max>
export type Deposit0MaxReturn = FunctionReturn<typeof functions.deposit0Max>

export type Deposit1MaxParams = FunctionArguments<typeof functions.deposit1Max>
export type Deposit1MaxReturn = FunctionReturn<typeof functions.deposit1Max>

export type FeeParams = FunctionArguments<typeof functions.fee>
export type FeeReturn = FunctionReturn<typeof functions.fee>

export type GetBasePositionParams = FunctionArguments<typeof functions.getBasePosition>
export type GetBasePositionReturn = FunctionReturn<typeof functions.getBasePosition>

export type GetLimitPositionParams = FunctionArguments<typeof functions.getLimitPosition>
export type GetLimitPositionReturn = FunctionReturn<typeof functions.getLimitPosition>

export type GetTotalAmountsParams = FunctionArguments<typeof functions.getTotalAmounts>
export type GetTotalAmountsReturn = FunctionReturn<typeof functions.getTotalAmounts>

export type HysteresisParams = FunctionArguments<typeof functions.hysteresis>
export type HysteresisReturn = FunctionReturn<typeof functions.hysteresis>

export type IchiVaultFactoryParams = FunctionArguments<typeof functions.ichiVaultFactory>
export type IchiVaultFactoryReturn = FunctionReturn<typeof functions.ichiVaultFactory>

export type IncreaseAllowanceParams = FunctionArguments<typeof functions.increaseAllowance>
export type IncreaseAllowanceReturn = FunctionReturn<typeof functions.increaseAllowance>

export type LimitLowerParams = FunctionArguments<typeof functions.limitLower>
export type LimitLowerReturn = FunctionReturn<typeof functions.limitLower>

export type LimitUpperParams = FunctionArguments<typeof functions.limitUpper>
export type LimitUpperReturn = FunctionReturn<typeof functions.limitUpper>

export type NameParams = FunctionArguments<typeof functions.name>
export type NameReturn = FunctionReturn<typeof functions.name>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type PoolParams = FunctionArguments<typeof functions.pool>
export type PoolReturn = FunctionReturn<typeof functions.pool>

export type RebalanceParams = FunctionArguments<typeof functions.rebalance>
export type RebalanceReturn = FunctionReturn<typeof functions.rebalance>

export type RenounceOwnershipParams = FunctionArguments<typeof functions.renounceOwnership>
export type RenounceOwnershipReturn = FunctionReturn<typeof functions.renounceOwnership>

export type SetAffiliateParams = FunctionArguments<typeof functions.setAffiliate>
export type SetAffiliateReturn = FunctionReturn<typeof functions.setAffiliate>

export type SetAmmFeeRecipientParams = FunctionArguments<typeof functions.setAmmFeeRecipient>
export type SetAmmFeeRecipientReturn = FunctionReturn<typeof functions.setAmmFeeRecipient>

export type SetAuxTwapPeriodParams = FunctionArguments<typeof functions.setAuxTwapPeriod>
export type SetAuxTwapPeriodReturn = FunctionReturn<typeof functions.setAuxTwapPeriod>

export type SetDepositMaxParams = FunctionArguments<typeof functions.setDepositMax>
export type SetDepositMaxReturn = FunctionReturn<typeof functions.setDepositMax>

export type SetHysteresisParams = FunctionArguments<typeof functions.setHysteresis>
export type SetHysteresisReturn = FunctionReturn<typeof functions.setHysteresis>

export type SetTwapPeriodParams = FunctionArguments<typeof functions.setTwapPeriod>
export type SetTwapPeriodReturn = FunctionReturn<typeof functions.setTwapPeriod>

export type SymbolParams = FunctionArguments<typeof functions.symbol>
export type SymbolReturn = FunctionReturn<typeof functions.symbol>

export type TickSpacingParams = FunctionArguments<typeof functions.tickSpacing>
export type TickSpacingReturn = FunctionReturn<typeof functions.tickSpacing>

export type Token0Params = FunctionArguments<typeof functions.token0>
export type Token0Return = FunctionReturn<typeof functions.token0>

export type Token1Params = FunctionArguments<typeof functions.token1>
export type Token1Return = FunctionReturn<typeof functions.token1>

export type TotalSupplyParams = FunctionArguments<typeof functions.totalSupply>
export type TotalSupplyReturn = FunctionReturn<typeof functions.totalSupply>

export type TransferParams = FunctionArguments<typeof functions.transfer>
export type TransferReturn = FunctionReturn<typeof functions.transfer>

export type TransferFromParams = FunctionArguments<typeof functions.transferFrom>
export type TransferFromReturn = FunctionReturn<typeof functions.transferFrom>

export type TransferOwnershipParams = FunctionArguments<typeof functions.transferOwnership>
export type TransferOwnershipReturn = FunctionReturn<typeof functions.transferOwnership>

export type TwapPeriodParams = FunctionArguments<typeof functions.twapPeriod>
export type TwapPeriodReturn = FunctionReturn<typeof functions.twapPeriod>

export type UniswapV3MintCallbackParams = FunctionArguments<typeof functions.uniswapV3MintCallback>
export type UniswapV3MintCallbackReturn = FunctionReturn<typeof functions.uniswapV3MintCallback>

export type UniswapV3SwapCallbackParams = FunctionArguments<typeof functions.uniswapV3SwapCallback>
export type UniswapV3SwapCallbackReturn = FunctionReturn<typeof functions.uniswapV3SwapCallback>

export type WithdrawParams = FunctionArguments<typeof functions.withdraw>
export type WithdrawReturn = FunctionReturn<typeof functions.withdraw>

