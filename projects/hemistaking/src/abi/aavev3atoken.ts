import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    Approval: event("0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925", "Approval(address,address,uint256)", {"owner": indexed(p.address), "spender": indexed(p.address), "value": p.uint256}),
    BalanceTransfer: event("0x4beccb90f994c31aced7a23b5611020728a23d8ec5cddd1a3e9d97b96fda8666", "BalanceTransfer(address,address,uint256,uint256)", {"from": indexed(p.address), "to": indexed(p.address), "value": p.uint256, "index": p.uint256}),
    Burn: event("0x4cf25bc1d991c17529c25213d3cc0cda295eeaad5f13f361969b12ea48015f90", "Burn(address,address,uint256,uint256,uint256)", {"from": indexed(p.address), "target": indexed(p.address), "value": p.uint256, "balanceIncrease": p.uint256, "index": p.uint256}),
    Initialized: event("0xb19e051f8af41150ccccb3fc2c2d8d15f4a4cf434f32a559ba75fe73d6eea20b", "Initialized(address,address,address,address,uint8,string,string,bytes)", {"underlyingAsset": indexed(p.address), "pool": indexed(p.address), "treasury": p.address, "incentivesController": p.address, "aTokenDecimals": p.uint8, "aTokenName": p.string, "aTokenSymbol": p.string, "params": p.bytes}),
    Mint: event("0x458f5fa412d0f69b08dd84872b0215675cc67bc1d5b6fd93300a1c3878b86196", "Mint(address,address,uint256,uint256,uint256)", {"caller": indexed(p.address), "onBehalfOf": indexed(p.address), "value": p.uint256, "balanceIncrease": p.uint256, "index": p.uint256}),
    Transfer: event("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "Transfer(address,address,uint256)", {"from": indexed(p.address), "to": indexed(p.address), "value": p.uint256}),
}

export const functions = {
    ATOKEN_REVISION: viewFun("0x0bd7ad3b", "ATOKEN_REVISION()", {}, p.uint256),
    DOMAIN_SEPARATOR: viewFun("0x3644e515", "DOMAIN_SEPARATOR()", {}, p.bytes32),
    EIP712_REVISION: viewFun("0x78160376", "EIP712_REVISION()", {}, p.bytes),
    PERMIT_TYPEHASH: viewFun("0x30adf81f", "PERMIT_TYPEHASH()", {}, p.bytes32),
    POOL: viewFun("0x7535d246", "POOL()", {}, p.address),
    RESERVE_TREASURY_ADDRESS: viewFun("0xae167335", "RESERVE_TREASURY_ADDRESS()", {}, p.address),
    REWARDS_CONTROLLER: viewFun("0xcd086d45", "REWARDS_CONTROLLER()", {}, p.address),
    TREASURY: viewFun("0x2d2c5565", "TREASURY()", {}, p.address),
    UNDERLYING_ASSET_ADDRESS: viewFun("0xb16a19de", "UNDERLYING_ASSET_ADDRESS()", {}, p.address),
    allowance: viewFun("0xdd62ed3e", "allowance(address,address)", {"owner": p.address, "spender": p.address}, p.uint256),
    approve: fun("0x095ea7b3", "approve(address,uint256)", {"spender": p.address, "amount": p.uint256}, p.bool),
    balanceOf: viewFun("0x70a08231", "balanceOf(address)", {"user": p.address}, p.uint256),
    burn: fun("0xb18d6afd", "burn(address,address,uint256,uint256,uint256)", {"from": p.address, "receiverOfUnderlying": p.address, "amount": p.uint256, "scaledAmount": p.uint256, "index": p.uint256}, p.bool),
    decimals: viewFun("0x313ce567", "decimals()", {}, p.uint8),
    decreaseAllowance: fun("0xa457c2d7", "decreaseAllowance(address,uint256)", {"spender": p.address, "subtractedValue": p.uint256}, p.bool),
    getIncentivesController: viewFun("0x75d26413", "getIncentivesController()", {}, p.address),
    getPreviousIndex: viewFun("0xe0753986", "getPreviousIndex(address)", {"user": p.address}, p.uint256),
    getScaledUserBalanceAndSupply: viewFun("0x0afbcdc9", "getScaledUserBalanceAndSupply(address)", {"user": p.address}, {"_0": p.uint256, "_1": p.uint256}),
    increaseAllowance: fun("0x39509351", "increaseAllowance(address,uint256)", {"spender": p.address, "addedValue": p.uint256}, p.bool),
    initialize: fun("0x7fdd585f", "initialize(address,address,uint8,string,string,bytes)", {"initializingPool": p.address, "underlyingAsset": p.address, "aTokenDecimals": p.uint8, "aTokenName": p.string, "aTokenSymbol": p.string, "params": p.bytes}, ),
    mint: fun("0xb3f1c93d", "mint(address,address,uint256,uint256)", {"caller": p.address, "onBehalfOf": p.address, "scaledAmount": p.uint256, "index": p.uint256}, p.bool),
    mintToTreasury: fun("0x7df5bd3b", "mintToTreasury(uint256,uint256)", {"scaledAmount": p.uint256, "index": p.uint256}, ),
    name: viewFun("0x06fdde03", "name()", {}, p.string),
    nonces: viewFun("0x7ecebe00", "nonces(address)", {"owner": p.address}, p.uint256),
    permit: fun("0xd505accf", "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)", {"owner": p.address, "spender": p.address, "value": p.uint256, "deadline": p.uint256, "v": p.uint8, "r": p.bytes32, "s": p.bytes32}, ),
    rescueTokens: fun("0xcea9d26f", "rescueTokens(address,address,uint256)", {"token": p.address, "to": p.address, "amount": p.uint256}, ),
    scaledBalanceOf: viewFun("0x1da24f3e", "scaledBalanceOf(address)", {"user": p.address}, p.uint256),
    scaledTotalSupply: viewFun("0xb1bf962d", "scaledTotalSupply()", {}, p.uint256),
    symbol: viewFun("0x95d89b41", "symbol()", {}, p.string),
    totalSupply: viewFun("0x18160ddd", "totalSupply()", {}, p.uint256),
    transfer: fun("0xa9059cbb", "transfer(address,uint256)", {"recipient": p.address, "amount": p.uint256}, p.bool),
    transferFrom: fun("0x23b872dd", "transferFrom(address,address,uint256)", {"sender": p.address, "recipient": p.address, "amount": p.uint256}, p.bool),
    transferOnLiquidation: fun("0x353b7b9a", "transferOnLiquidation(address,address,uint256,uint256,uint256)", {"from": p.address, "to": p.address, "amount": p.uint256, "scaledAmount": p.uint256, "index": p.uint256}, ),
    transferUnderlyingTo: fun("0x4efecaa5", "transferUnderlyingTo(address,uint256)", {"target": p.address, "amount": p.uint256}, ),
}

export class Contract extends ContractBase {

    ATOKEN_REVISION() {
        return this.eth_call(functions.ATOKEN_REVISION, {})
    }

    DOMAIN_SEPARATOR() {
        return this.eth_call(functions.DOMAIN_SEPARATOR, {})
    }

    EIP712_REVISION() {
        return this.eth_call(functions.EIP712_REVISION, {})
    }

    PERMIT_TYPEHASH() {
        return this.eth_call(functions.PERMIT_TYPEHASH, {})
    }

    POOL() {
        return this.eth_call(functions.POOL, {})
    }

    RESERVE_TREASURY_ADDRESS() {
        return this.eth_call(functions.RESERVE_TREASURY_ADDRESS, {})
    }

    REWARDS_CONTROLLER() {
        return this.eth_call(functions.REWARDS_CONTROLLER, {})
    }

    TREASURY() {
        return this.eth_call(functions.TREASURY, {})
    }

    UNDERLYING_ASSET_ADDRESS() {
        return this.eth_call(functions.UNDERLYING_ASSET_ADDRESS, {})
    }

    allowance(owner: AllowanceParams["owner"], spender: AllowanceParams["spender"]) {
        return this.eth_call(functions.allowance, {owner, spender})
    }

    balanceOf(user: BalanceOfParams["user"]) {
        return this.eth_call(functions.balanceOf, {user})
    }

    decimals() {
        return this.eth_call(functions.decimals, {})
    }

    getIncentivesController() {
        return this.eth_call(functions.getIncentivesController, {})
    }

    getPreviousIndex(user: GetPreviousIndexParams["user"]) {
        return this.eth_call(functions.getPreviousIndex, {user})
    }

    getScaledUserBalanceAndSupply(user: GetScaledUserBalanceAndSupplyParams["user"]) {
        return this.eth_call(functions.getScaledUserBalanceAndSupply, {user})
    }

    name() {
        return this.eth_call(functions.name, {})
    }

    nonces(owner: NoncesParams["owner"]) {
        return this.eth_call(functions.nonces, {owner})
    }

    scaledBalanceOf(user: ScaledBalanceOfParams["user"]) {
        return this.eth_call(functions.scaledBalanceOf, {user})
    }

    scaledTotalSupply() {
        return this.eth_call(functions.scaledTotalSupply, {})
    }

    symbol() {
        return this.eth_call(functions.symbol, {})
    }

    totalSupply() {
        return this.eth_call(functions.totalSupply, {})
    }
}

/// Event types
export type ApprovalEventArgs = EParams<typeof events.Approval>
export type BalanceTransferEventArgs = EParams<typeof events.BalanceTransfer>
export type BurnEventArgs = EParams<typeof events.Burn>
export type InitializedEventArgs = EParams<typeof events.Initialized>
export type MintEventArgs = EParams<typeof events.Mint>
export type TransferEventArgs = EParams<typeof events.Transfer>

/// Function types
export type ATOKEN_REVISIONParams = FunctionArguments<typeof functions.ATOKEN_REVISION>
export type ATOKEN_REVISIONReturn = FunctionReturn<typeof functions.ATOKEN_REVISION>

export type DOMAIN_SEPARATORParams = FunctionArguments<typeof functions.DOMAIN_SEPARATOR>
export type DOMAIN_SEPARATORReturn = FunctionReturn<typeof functions.DOMAIN_SEPARATOR>

export type EIP712_REVISIONParams = FunctionArguments<typeof functions.EIP712_REVISION>
export type EIP712_REVISIONReturn = FunctionReturn<typeof functions.EIP712_REVISION>

export type PERMIT_TYPEHASHParams = FunctionArguments<typeof functions.PERMIT_TYPEHASH>
export type PERMIT_TYPEHASHReturn = FunctionReturn<typeof functions.PERMIT_TYPEHASH>

export type POOLParams = FunctionArguments<typeof functions.POOL>
export type POOLReturn = FunctionReturn<typeof functions.POOL>

export type RESERVE_TREASURY_ADDRESSParams = FunctionArguments<typeof functions.RESERVE_TREASURY_ADDRESS>
export type RESERVE_TREASURY_ADDRESSReturn = FunctionReturn<typeof functions.RESERVE_TREASURY_ADDRESS>

export type REWARDS_CONTROLLERParams = FunctionArguments<typeof functions.REWARDS_CONTROLLER>
export type REWARDS_CONTROLLERReturn = FunctionReturn<typeof functions.REWARDS_CONTROLLER>

export type TREASURYParams = FunctionArguments<typeof functions.TREASURY>
export type TREASURYReturn = FunctionReturn<typeof functions.TREASURY>

export type UNDERLYING_ASSET_ADDRESSParams = FunctionArguments<typeof functions.UNDERLYING_ASSET_ADDRESS>
export type UNDERLYING_ASSET_ADDRESSReturn = FunctionReturn<typeof functions.UNDERLYING_ASSET_ADDRESS>

export type AllowanceParams = FunctionArguments<typeof functions.allowance>
export type AllowanceReturn = FunctionReturn<typeof functions.allowance>

export type ApproveParams = FunctionArguments<typeof functions.approve>
export type ApproveReturn = FunctionReturn<typeof functions.approve>

export type BalanceOfParams = FunctionArguments<typeof functions.balanceOf>
export type BalanceOfReturn = FunctionReturn<typeof functions.balanceOf>

export type BurnParams = FunctionArguments<typeof functions.burn>
export type BurnReturn = FunctionReturn<typeof functions.burn>

export type DecimalsParams = FunctionArguments<typeof functions.decimals>
export type DecimalsReturn = FunctionReturn<typeof functions.decimals>

export type DecreaseAllowanceParams = FunctionArguments<typeof functions.decreaseAllowance>
export type DecreaseAllowanceReturn = FunctionReturn<typeof functions.decreaseAllowance>

export type GetIncentivesControllerParams = FunctionArguments<typeof functions.getIncentivesController>
export type GetIncentivesControllerReturn = FunctionReturn<typeof functions.getIncentivesController>

export type GetPreviousIndexParams = FunctionArguments<typeof functions.getPreviousIndex>
export type GetPreviousIndexReturn = FunctionReturn<typeof functions.getPreviousIndex>

export type GetScaledUserBalanceAndSupplyParams = FunctionArguments<typeof functions.getScaledUserBalanceAndSupply>
export type GetScaledUserBalanceAndSupplyReturn = FunctionReturn<typeof functions.getScaledUserBalanceAndSupply>

export type IncreaseAllowanceParams = FunctionArguments<typeof functions.increaseAllowance>
export type IncreaseAllowanceReturn = FunctionReturn<typeof functions.increaseAllowance>

export type InitializeParams = FunctionArguments<typeof functions.initialize>
export type InitializeReturn = FunctionReturn<typeof functions.initialize>

export type MintParams = FunctionArguments<typeof functions.mint>
export type MintReturn = FunctionReturn<typeof functions.mint>

export type MintToTreasuryParams = FunctionArguments<typeof functions.mintToTreasury>
export type MintToTreasuryReturn = FunctionReturn<typeof functions.mintToTreasury>

export type NameParams = FunctionArguments<typeof functions.name>
export type NameReturn = FunctionReturn<typeof functions.name>

export type NoncesParams = FunctionArguments<typeof functions.nonces>
export type NoncesReturn = FunctionReturn<typeof functions.nonces>

export type PermitParams = FunctionArguments<typeof functions.permit>
export type PermitReturn = FunctionReturn<typeof functions.permit>

export type RescueTokensParams = FunctionArguments<typeof functions.rescueTokens>
export type RescueTokensReturn = FunctionReturn<typeof functions.rescueTokens>

export type ScaledBalanceOfParams = FunctionArguments<typeof functions.scaledBalanceOf>
export type ScaledBalanceOfReturn = FunctionReturn<typeof functions.scaledBalanceOf>

export type ScaledTotalSupplyParams = FunctionArguments<typeof functions.scaledTotalSupply>
export type ScaledTotalSupplyReturn = FunctionReturn<typeof functions.scaledTotalSupply>

export type SymbolParams = FunctionArguments<typeof functions.symbol>
export type SymbolReturn = FunctionReturn<typeof functions.symbol>

export type TotalSupplyParams = FunctionArguments<typeof functions.totalSupply>
export type TotalSupplyReturn = FunctionReturn<typeof functions.totalSupply>

export type TransferParams = FunctionArguments<typeof functions.transfer>
export type TransferReturn = FunctionReturn<typeof functions.transfer>

export type TransferFromParams = FunctionArguments<typeof functions.transferFrom>
export type TransferFromReturn = FunctionReturn<typeof functions.transferFrom>

export type TransferOnLiquidationParams = FunctionArguments<typeof functions.transferOnLiquidation>
export type TransferOnLiquidationReturn = FunctionReturn<typeof functions.transferOnLiquidation>

export type TransferUnderlyingToParams = FunctionArguments<typeof functions.transferUnderlyingTo>
export type TransferUnderlyingToReturn = FunctionReturn<typeof functions.transferUnderlyingTo>

