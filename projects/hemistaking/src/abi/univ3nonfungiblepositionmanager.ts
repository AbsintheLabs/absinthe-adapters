import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    Approval: event("0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925", "Approval(address,address,uint256)", {"owner": indexed(p.address), "approved": indexed(p.address), "tokenId": indexed(p.uint256)}),
    ApprovalForAll: event("0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31", "ApprovalForAll(address,address,bool)", {"owner": indexed(p.address), "operator": indexed(p.address), "approved": p.bool}),
    Collect: event("0x40d0efd1a53d60ecbf40971b9daf7dc90178c3aadc7aab1765632738fa8b8f01", "Collect(uint256,address,uint256,uint256)", {"tokenId": indexed(p.uint256), "recipient": p.address, "amount0": p.uint256, "amount1": p.uint256}),
    DecreaseLiquidity: event("0x26f6a048ee9138f2c0ce266f322cb99228e8d619ae2bff30c67f8dcf9d2377b4", "DecreaseLiquidity(uint256,uint128,uint256,uint256)", {"tokenId": indexed(p.uint256), "liquidity": p.uint128, "amount0": p.uint256, "amount1": p.uint256}),
    IncreaseLiquidity: event("0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f", "IncreaseLiquidity(uint256,uint128,uint256,uint256)", {"tokenId": indexed(p.uint256), "liquidity": p.uint128, "amount0": p.uint256, "amount1": p.uint256}),
    Transfer: event("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "Transfer(address,address,uint256)", {"from": indexed(p.address), "to": indexed(p.address), "tokenId": indexed(p.uint256)}),
}

export const functions = {
    DOMAIN_SEPARATOR: viewFun("0x3644e515", "DOMAIN_SEPARATOR()", {}, p.bytes32),
    PERMIT_TYPEHASH: viewFun("0x30adf81f", "PERMIT_TYPEHASH()", {}, p.bytes32),
    WETH9: viewFun("0x4aa4a4fc", "WETH9()", {}, p.address),
    approve: fun("0x095ea7b3", "approve(address,uint256)", {"to": p.address, "tokenId": p.uint256}, ),
    balanceOf: viewFun("0x70a08231", "balanceOf(address)", {"owner": p.address}, p.uint256),
    baseURI: viewFun("0x6c0360eb", "baseURI()", {}, p.string),
    burn: fun("0x42966c68", "burn(uint256)", {"tokenId": p.uint256}, ),
    collect: fun("0x260e12b0", "collect(uint256,address,uint128,uint128)", {"tokenId": p.uint256, "recipient": p.address, "amount0Max": p.uint128, "amount1Max": p.uint128}, {"amount0": p.uint256, "amount1": p.uint256}),
    createAndInitializePoolIfNecessary: fun("0x13ead562", "createAndInitializePoolIfNecessary(address,address,uint24,uint160)", {"tokenA": p.address, "tokenB": p.address, "fee": p.uint24, "sqrtPriceX96": p.uint160}, p.address),
    decreaseLiquidity: fun("0x03a3f2ab", "decreaseLiquidity(uint256,uint128,uint256,uint256,uint256)", {"tokenId": p.uint256, "liquidity": p.uint128, "amount0Min": p.uint256, "amount1Min": p.uint256, "deadline": p.uint256}, {"amount0": p.uint256, "amount1": p.uint256}),
    factory: viewFun("0xc45a0155", "factory()", {}, p.address),
    getApproved: viewFun("0x081812fc", "getApproved(uint256)", {"tokenId": p.uint256}, p.address),
    increaseLiquidity: fun("0x12d7b2c4", "increaseLiquidity(uint256,uint256,uint256,uint256,uint256,uint256)", {"tokenId": p.uint256, "amount0Desired": p.uint256, "amount1Desired": p.uint256, "amount0Min": p.uint256, "amount1Min": p.uint256, "deadline": p.uint256}, {"liquidity": p.uint128, "amount0": p.uint256, "amount1": p.uint256}),
    isApprovedForAll: viewFun("0xe985e9c5", "isApprovedForAll(address,address)", {"owner": p.address, "operator": p.address}, p.bool),
    mint: fun("0x88316456", "mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256))", {"params": p.struct({"token0": p.address, "token1": p.address, "fee": p.uint24, "tickLower": p.int24, "tickUpper": p.int24, "amount0Desired": p.uint256, "amount1Desired": p.uint256, "amount0Min": p.uint256, "amount1Min": p.uint256, "recipient": p.address, "deadline": p.uint256})}, {"tokenId": p.uint256, "liquidity": p.uint128, "amount0": p.uint256, "amount1": p.uint256}),
    multicall: fun("0xac9650d8", "multicall(bytes[])", {"data": p.array(p.bytes)}, p.array(p.bytes)),
    name: viewFun("0x06fdde03", "name()", {}, p.string),
    ownerOf: viewFun("0x6352211e", "ownerOf(uint256)", {"tokenId": p.uint256}, p.address),
    permit: fun("0x7ac2ff7b", "permit(address,uint256,uint256,uint8,bytes32,bytes32)", {"spender": p.address, "tokenId": p.uint256, "deadline": p.uint256, "v": p.uint8, "r": p.bytes32, "s": p.bytes32}, ),
    positions: viewFun("0x99fbab88", "positions(uint256)", {"tokenId": p.uint256}, {"nonce": p.uint96, "operator": p.address, "token0": p.address, "token1": p.address, "fee": p.uint24, "tickLower": p.int24, "tickUpper": p.int24, "liquidity": p.uint128, "feeGrowthInside0LastX128": p.uint256, "feeGrowthInside1LastX128": p.uint256, "tokensOwed0": p.uint128, "tokensOwed1": p.uint128}),
    'safeTransferFrom(address,address,uint256)': fun("0x42842e0e", "safeTransferFrom(address,address,uint256)", {"from": p.address, "to": p.address, "tokenId": p.uint256}, ),
    'safeTransferFrom(address,address,uint256,bytes)': fun("0xb88d4fde", "safeTransferFrom(address,address,uint256,bytes)", {"from": p.address, "to": p.address, "tokenId": p.uint256, "_data": p.bytes}, ),
    selfPermit: fun("0xf3995c67", "selfPermit(address,uint256,uint256,uint8,bytes32,bytes32)", {"token": p.address, "value": p.uint256, "deadline": p.uint256, "v": p.uint8, "r": p.bytes32, "s": p.bytes32}, ),
    selfPermitAllowed: fun("0x4659a494", "selfPermitAllowed(address,uint256,uint256,uint8,bytes32,bytes32)", {"token": p.address, "nonce": p.uint256, "expiry": p.uint256, "v": p.uint8, "r": p.bytes32, "s": p.bytes32}, ),
    selfPermitAllowedIfNecessary: fun("0xa4a78f0c", "selfPermitAllowedIfNecessary(address,uint256,uint256,uint8,bytes32,bytes32)", {"token": p.address, "nonce": p.uint256, "expiry": p.uint256, "v": p.uint8, "r": p.bytes32, "s": p.bytes32}, ),
    selfPermitIfNecessary: fun("0xc2e3140a", "selfPermitIfNecessary(address,uint256,uint256,uint8,bytes32,bytes32)", {"token": p.address, "value": p.uint256, "deadline": p.uint256, "v": p.uint8, "r": p.bytes32, "s": p.bytes32}, ),
    setApprovalForAll: fun("0xa22cb465", "setApprovalForAll(address,bool)", {"operator": p.address, "approved": p.bool}, ),
    supportsInterface: viewFun("0x01ffc9a7", "supportsInterface(bytes4)", {"interfaceId": p.bytes4}, p.bool),
    sweepToken: fun("0xdf2ab5bb", "sweepToken(address,uint256,address)", {"token": p.address, "amountMinimum": p.uint256, "recipient": p.address}, ),
    symbol: viewFun("0x95d89b41", "symbol()", {}, p.string),
    tokenByIndex: viewFun("0x4f6ccce7", "tokenByIndex(uint256)", {"index": p.uint256}, p.uint256),
    tokenOfOwnerByIndex: viewFun("0x2f745c59", "tokenOfOwnerByIndex(address,uint256)", {"owner": p.address, "index": p.uint256}, p.uint256),
    tokenURI: viewFun("0xc87b56dd", "tokenURI(uint256)", {"tokenId": p.uint256}, p.string),
    totalSupply: viewFun("0x18160ddd", "totalSupply()", {}, p.uint256),
    transferFrom: fun("0x23b872dd", "transferFrom(address,address,uint256)", {"from": p.address, "to": p.address, "tokenId": p.uint256}, ),
    uniswapV3MintCallback: fun("0xd3487997", "uniswapV3MintCallback(uint256,uint256,bytes)", {"amount0Owed": p.uint256, "amount1Owed": p.uint256, "data": p.bytes}, ),
    unwrapWETH9: fun("0x49404b7c", "unwrapWETH9(uint256,address)", {"amountMinimum": p.uint256, "recipient": p.address}, ),
}

export class Contract extends ContractBase {

    DOMAIN_SEPARATOR() {
        return this.eth_call(functions.DOMAIN_SEPARATOR, {})
    }

    PERMIT_TYPEHASH() {
        return this.eth_call(functions.PERMIT_TYPEHASH, {})
    }

    WETH9() {
        return this.eth_call(functions.WETH9, {})
    }

    balanceOf(owner: BalanceOfParams["owner"]) {
        return this.eth_call(functions.balanceOf, {owner})
    }

    baseURI() {
        return this.eth_call(functions.baseURI, {})
    }

    factory() {
        return this.eth_call(functions.factory, {})
    }

    getApproved(tokenId: GetApprovedParams["tokenId"]) {
        return this.eth_call(functions.getApproved, {tokenId})
    }

    isApprovedForAll(owner: IsApprovedForAllParams["owner"], operator: IsApprovedForAllParams["operator"]) {
        return this.eth_call(functions.isApprovedForAll, {owner, operator})
    }

    name() {
        return this.eth_call(functions.name, {})
    }

    ownerOf(tokenId: OwnerOfParams["tokenId"]) {
        return this.eth_call(functions.ownerOf, {tokenId})
    }

    positions(tokenId: PositionsParams["tokenId"]) {
        return this.eth_call(functions.positions, {tokenId})
    }

    supportsInterface(interfaceId: SupportsInterfaceParams["interfaceId"]) {
        return this.eth_call(functions.supportsInterface, {interfaceId})
    }

    symbol() {
        return this.eth_call(functions.symbol, {})
    }

    tokenByIndex(index: TokenByIndexParams["index"]) {
        return this.eth_call(functions.tokenByIndex, {index})
    }

    tokenOfOwnerByIndex(owner: TokenOfOwnerByIndexParams["owner"], index: TokenOfOwnerByIndexParams["index"]) {
        return this.eth_call(functions.tokenOfOwnerByIndex, {owner, index})
    }

    tokenURI(tokenId: TokenURIParams["tokenId"]) {
        return this.eth_call(functions.tokenURI, {tokenId})
    }

    totalSupply() {
        return this.eth_call(functions.totalSupply, {})
    }
}

/// Event types
export type ApprovalEventArgs = EParams<typeof events.Approval>
export type ApprovalForAllEventArgs = EParams<typeof events.ApprovalForAll>
export type CollectEventArgs = EParams<typeof events.Collect>
export type DecreaseLiquidityEventArgs = EParams<typeof events.DecreaseLiquidity>
export type IncreaseLiquidityEventArgs = EParams<typeof events.IncreaseLiquidity>
export type TransferEventArgs = EParams<typeof events.Transfer>

/// Function types
export type DOMAIN_SEPARATORParams = FunctionArguments<typeof functions.DOMAIN_SEPARATOR>
export type DOMAIN_SEPARATORReturn = FunctionReturn<typeof functions.DOMAIN_SEPARATOR>

export type PERMIT_TYPEHASHParams = FunctionArguments<typeof functions.PERMIT_TYPEHASH>
export type PERMIT_TYPEHASHReturn = FunctionReturn<typeof functions.PERMIT_TYPEHASH>

export type WETH9Params = FunctionArguments<typeof functions.WETH9>
export type WETH9Return = FunctionReturn<typeof functions.WETH9>

export type ApproveParams = FunctionArguments<typeof functions.approve>
export type ApproveReturn = FunctionReturn<typeof functions.approve>

export type BalanceOfParams = FunctionArguments<typeof functions.balanceOf>
export type BalanceOfReturn = FunctionReturn<typeof functions.balanceOf>

export type BaseURIParams = FunctionArguments<typeof functions.baseURI>
export type BaseURIReturn = FunctionReturn<typeof functions.baseURI>

export type BurnParams = FunctionArguments<typeof functions.burn>
export type BurnReturn = FunctionReturn<typeof functions.burn>

export type CollectParams = FunctionArguments<typeof functions.collect>
export type CollectReturn = FunctionReturn<typeof functions.collect>

export type CreateAndInitializePoolIfNecessaryParams = FunctionArguments<typeof functions.createAndInitializePoolIfNecessary>
export type CreateAndInitializePoolIfNecessaryReturn = FunctionReturn<typeof functions.createAndInitializePoolIfNecessary>

export type DecreaseLiquidityParams = FunctionArguments<typeof functions.decreaseLiquidity>
export type DecreaseLiquidityReturn = FunctionReturn<typeof functions.decreaseLiquidity>

export type FactoryParams = FunctionArguments<typeof functions.factory>
export type FactoryReturn = FunctionReturn<typeof functions.factory>

export type GetApprovedParams = FunctionArguments<typeof functions.getApproved>
export type GetApprovedReturn = FunctionReturn<typeof functions.getApproved>

export type IncreaseLiquidityParams = FunctionArguments<typeof functions.increaseLiquidity>
export type IncreaseLiquidityReturn = FunctionReturn<typeof functions.increaseLiquidity>

export type IsApprovedForAllParams = FunctionArguments<typeof functions.isApprovedForAll>
export type IsApprovedForAllReturn = FunctionReturn<typeof functions.isApprovedForAll>

export type MintParams = FunctionArguments<typeof functions.mint>
export type MintReturn = FunctionReturn<typeof functions.mint>

export type MulticallParams = FunctionArguments<typeof functions.multicall>
export type MulticallReturn = FunctionReturn<typeof functions.multicall>

export type NameParams = FunctionArguments<typeof functions.name>
export type NameReturn = FunctionReturn<typeof functions.name>

export type OwnerOfParams = FunctionArguments<typeof functions.ownerOf>
export type OwnerOfReturn = FunctionReturn<typeof functions.ownerOf>

export type PermitParams = FunctionArguments<typeof functions.permit>
export type PermitReturn = FunctionReturn<typeof functions.permit>

export type PositionsParams = FunctionArguments<typeof functions.positions>
export type PositionsReturn = FunctionReturn<typeof functions.positions>

export type SafeTransferFromParams_0 = FunctionArguments<typeof functions['safeTransferFrom(address,address,uint256)']>
export type SafeTransferFromReturn_0 = FunctionReturn<typeof functions['safeTransferFrom(address,address,uint256)']>

export type SafeTransferFromParams_1 = FunctionArguments<typeof functions['safeTransferFrom(address,address,uint256,bytes)']>
export type SafeTransferFromReturn_1 = FunctionReturn<typeof functions['safeTransferFrom(address,address,uint256,bytes)']>

export type SelfPermitParams = FunctionArguments<typeof functions.selfPermit>
export type SelfPermitReturn = FunctionReturn<typeof functions.selfPermit>

export type SelfPermitAllowedParams = FunctionArguments<typeof functions.selfPermitAllowed>
export type SelfPermitAllowedReturn = FunctionReturn<typeof functions.selfPermitAllowed>

export type SelfPermitAllowedIfNecessaryParams = FunctionArguments<typeof functions.selfPermitAllowedIfNecessary>
export type SelfPermitAllowedIfNecessaryReturn = FunctionReturn<typeof functions.selfPermitAllowedIfNecessary>

export type SelfPermitIfNecessaryParams = FunctionArguments<typeof functions.selfPermitIfNecessary>
export type SelfPermitIfNecessaryReturn = FunctionReturn<typeof functions.selfPermitIfNecessary>

export type SetApprovalForAllParams = FunctionArguments<typeof functions.setApprovalForAll>
export type SetApprovalForAllReturn = FunctionReturn<typeof functions.setApprovalForAll>

export type SupportsInterfaceParams = FunctionArguments<typeof functions.supportsInterface>
export type SupportsInterfaceReturn = FunctionReturn<typeof functions.supportsInterface>

export type SweepTokenParams = FunctionArguments<typeof functions.sweepToken>
export type SweepTokenReturn = FunctionReturn<typeof functions.sweepToken>

export type SymbolParams = FunctionArguments<typeof functions.symbol>
export type SymbolReturn = FunctionReturn<typeof functions.symbol>

export type TokenByIndexParams = FunctionArguments<typeof functions.tokenByIndex>
export type TokenByIndexReturn = FunctionReturn<typeof functions.tokenByIndex>

export type TokenOfOwnerByIndexParams = FunctionArguments<typeof functions.tokenOfOwnerByIndex>
export type TokenOfOwnerByIndexReturn = FunctionReturn<typeof functions.tokenOfOwnerByIndex>

export type TokenURIParams = FunctionArguments<typeof functions.tokenURI>
export type TokenURIReturn = FunctionReturn<typeof functions.tokenURI>

export type TotalSupplyParams = FunctionArguments<typeof functions.totalSupply>
export type TotalSupplyReturn = FunctionReturn<typeof functions.totalSupply>

export type TransferFromParams = FunctionArguments<typeof functions.transferFrom>
export type TransferFromReturn = FunctionReturn<typeof functions.transferFrom>

export type UniswapV3MintCallbackParams = FunctionArguments<typeof functions.uniswapV3MintCallback>
export type UniswapV3MintCallbackReturn = FunctionReturn<typeof functions.uniswapV3MintCallback>

export type UnwrapWETH9Params = FunctionArguments<typeof functions.unwrapWETH9>
export type UnwrapWETH9Return = FunctionReturn<typeof functions.unwrapWETH9>

