import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    Mint: event("0xa8137fff86647d8a402117b9c5dbda627f721d3773338fb9678c83e54ed39080", "Mint(address,uint256,uint256,uint256,address)", {"tokenIn": indexed(p.address), "amountIn": p.uint256, "amountInAfterTransferFee": p.uint256, "mintage": p.uint256, "receiver": p.address}),
    MintingLimitUpdated: event("0x8353d6f6057b53994c31faf6112674bd84b37caab3af81c269080ae9904ebbeb", "MintingLimitUpdated(uint256,uint256)", {"previousMintLimit": p.uint256, "newMintLimit": p.uint256}),
    UpdatedMintingFee: event("0x85735a3ef929fdaaf946ddf4b97deec396e7347cbb47fea3d6a8f3934e1b02e3", "UpdatedMintingFee(uint256,uint256)", {"previousMintingFee": p.uint256, "newMintingFee": p.uint256}),
    UpdatedPriceTolerance: event("0x3cb23ae97dcd603618548f333b96dbb9e41059b6fd0eb7face59058c5ac3b11b", "UpdatedPriceTolerance(uint256,uint256)", {"previousPriceTolerance": p.uint256, "newPriceTolerance": p.uint256}),
    WhitelistedTokenAdded: event("0xf264178f70a222c6991bf4849b98c3722e9f54b6e89d1fb550509113e60ae0b7", "WhitelistedTokenAdded(address,address,address)", {"token": indexed(p.address), "cToken": p.address, "oracle": p.address}),
    WhitelistedTokenRemoved: event("0x3e4130008265a57fa3e4f3cc37bc1d691652b77b4407bd08ddea997b2eda4367", "WhitelistedTokenRemoved(address)", {"token": indexed(p.address)}),
}

export const functions = {
    MAX_BPS: viewFun("0xfd967f47", "MAX_BPS()", {}, p.uint256),
    NAME: viewFun("0xa3f4df7e", "NAME()", {}, p.string),
    VERSION: viewFun("0xffa1ad74", "VERSION()", {}, p.string),
    addWhitelistedToken: fun("0x20ab954e", "addWhitelistedToken(address,address,address)", {"_token": p.address, "_cToken": p.address, "_oracle": p.address}, ),
    availableMintage: viewFun("0x5166c96a", "availableMintage()", {}, p.uint256),
    cTokens: viewFun("0x8c0b09d0", "cTokens(address)", {"_0": p.address}, p.address),
    calculateMintage: viewFun("0x482b6014", "calculateMintage(address,uint256)", {"_token": p.address, "_amountIn": p.uint256}, p.uint256),
    governor: viewFun("0x0c340a24", "governor()", {}, p.address),
    isWhitelistedToken: viewFun("0xab37f486", "isWhitelistedToken(address)", {"_address": p.address}, p.bool),
    maxMintLimit: viewFun("0x70e2f827", "maxMintLimit()", {}, p.uint256),
    'mint(address,uint256,address)': fun("0x0d4d1513", "mint(address,uint256,address)", {"_token": p.address, "_amountIn": p.uint256, "_receiver": p.address}, ),
    'mint(address,uint256)': fun("0x40c10f19", "mint(address,uint256)", {"_token": p.address, "_amountIn": p.uint256}, ),
    'mint(uint256)': fun("0xa0712d68", "mint(uint256)", {"_amount": p.uint256}, ),
    mintingFee: viewFun("0x5a64ad95", "mintingFee()", {}, p.uint256),
    oracles: viewFun("0xaddd5099", "oracles(address)", {"_0": p.address}, p.address),
    priceTolerance: viewFun("0x59011cd1", "priceTolerance()", {}, p.uint256),
    removeWhitelistedToken: fun("0x1c88705d", "removeWhitelistedToken(address)", {"_token": p.address}, ),
    treasury: viewFun("0x61d027b3", "treasury()", {}, p.address),
    updateMaxMintAmount: fun("0x380a0df2", "updateMaxMintAmount(uint256)", {"_newMintLimit": p.uint256}, ),
    updateMintingFee: fun("0xc0275a25", "updateMintingFee(uint256)", {"_newMintingFee": p.uint256}, ),
    updatePriceTolerance: fun("0xc760af5c", "updatePriceTolerance(uint256)", {"_newPriceTolerance": p.uint256}, ),
    vusd: viewFun("0xedac5203", "vusd()", {}, p.address),
    whitelistedTokens: viewFun("0x5e1762a0", "whitelistedTokens()", {}, p.array(p.address)),
}

export class Contract extends ContractBase {

    MAX_BPS() {
        return this.eth_call(functions.MAX_BPS, {})
    }

    NAME() {
        return this.eth_call(functions.NAME, {})
    }

    VERSION() {
        return this.eth_call(functions.VERSION, {})
    }

    availableMintage() {
        return this.eth_call(functions.availableMintage, {})
    }

    cTokens(_0: CTokensParams["_0"]) {
        return this.eth_call(functions.cTokens, {_0})
    }

    calculateMintage(_token: CalculateMintageParams["_token"], _amountIn: CalculateMintageParams["_amountIn"]) {
        return this.eth_call(functions.calculateMintage, {_token, _amountIn})
    }

    governor() {
        return this.eth_call(functions.governor, {})
    }

    isWhitelistedToken(_address: IsWhitelistedTokenParams["_address"]) {
        return this.eth_call(functions.isWhitelistedToken, {_address})
    }

    maxMintLimit() {
        return this.eth_call(functions.maxMintLimit, {})
    }

    mintingFee() {
        return this.eth_call(functions.mintingFee, {})
    }

    oracles(_0: OraclesParams["_0"]) {
        return this.eth_call(functions.oracles, {_0})
    }

    priceTolerance() {
        return this.eth_call(functions.priceTolerance, {})
    }

    treasury() {
        return this.eth_call(functions.treasury, {})
    }

    vusd() {
        return this.eth_call(functions.vusd, {})
    }

    whitelistedTokens() {
        return this.eth_call(functions.whitelistedTokens, {})
    }
}

/// Event types
export type MintEventArgs = EParams<typeof events.Mint>
export type MintingLimitUpdatedEventArgs = EParams<typeof events.MintingLimitUpdated>
export type UpdatedMintingFeeEventArgs = EParams<typeof events.UpdatedMintingFee>
export type UpdatedPriceToleranceEventArgs = EParams<typeof events.UpdatedPriceTolerance>
export type WhitelistedTokenAddedEventArgs = EParams<typeof events.WhitelistedTokenAdded>
export type WhitelistedTokenRemovedEventArgs = EParams<typeof events.WhitelistedTokenRemoved>

/// Function types
export type MAX_BPSParams = FunctionArguments<typeof functions.MAX_BPS>
export type MAX_BPSReturn = FunctionReturn<typeof functions.MAX_BPS>

export type NAMEParams = FunctionArguments<typeof functions.NAME>
export type NAMEReturn = FunctionReturn<typeof functions.NAME>

export type VERSIONParams = FunctionArguments<typeof functions.VERSION>
export type VERSIONReturn = FunctionReturn<typeof functions.VERSION>

export type AddWhitelistedTokenParams = FunctionArguments<typeof functions.addWhitelistedToken>
export type AddWhitelistedTokenReturn = FunctionReturn<typeof functions.addWhitelistedToken>

export type AvailableMintageParams = FunctionArguments<typeof functions.availableMintage>
export type AvailableMintageReturn = FunctionReturn<typeof functions.availableMintage>

export type CTokensParams = FunctionArguments<typeof functions.cTokens>
export type CTokensReturn = FunctionReturn<typeof functions.cTokens>

export type CalculateMintageParams = FunctionArguments<typeof functions.calculateMintage>
export type CalculateMintageReturn = FunctionReturn<typeof functions.calculateMintage>

export type GovernorParams = FunctionArguments<typeof functions.governor>
export type GovernorReturn = FunctionReturn<typeof functions.governor>

export type IsWhitelistedTokenParams = FunctionArguments<typeof functions.isWhitelistedToken>
export type IsWhitelistedTokenReturn = FunctionReturn<typeof functions.isWhitelistedToken>

export type MaxMintLimitParams = FunctionArguments<typeof functions.maxMintLimit>
export type MaxMintLimitReturn = FunctionReturn<typeof functions.maxMintLimit>

export type MintParams_0 = FunctionArguments<typeof functions['mint(address,uint256,address)']>
export type MintReturn_0 = FunctionReturn<typeof functions['mint(address,uint256,address)']>

export type MintParams_1 = FunctionArguments<typeof functions['mint(address,uint256)']>
export type MintReturn_1 = FunctionReturn<typeof functions['mint(address,uint256)']>

export type MintParams_2 = FunctionArguments<typeof functions['mint(uint256)']>
export type MintReturn_2 = FunctionReturn<typeof functions['mint(uint256)']>

export type MintingFeeParams = FunctionArguments<typeof functions.mintingFee>
export type MintingFeeReturn = FunctionReturn<typeof functions.mintingFee>

export type OraclesParams = FunctionArguments<typeof functions.oracles>
export type OraclesReturn = FunctionReturn<typeof functions.oracles>

export type PriceToleranceParams = FunctionArguments<typeof functions.priceTolerance>
export type PriceToleranceReturn = FunctionReturn<typeof functions.priceTolerance>

export type RemoveWhitelistedTokenParams = FunctionArguments<typeof functions.removeWhitelistedToken>
export type RemoveWhitelistedTokenReturn = FunctionReturn<typeof functions.removeWhitelistedToken>

export type TreasuryParams = FunctionArguments<typeof functions.treasury>
export type TreasuryReturn = FunctionReturn<typeof functions.treasury>

export type UpdateMaxMintAmountParams = FunctionArguments<typeof functions.updateMaxMintAmount>
export type UpdateMaxMintAmountReturn = FunctionReturn<typeof functions.updateMaxMintAmount>

export type UpdateMintingFeeParams = FunctionArguments<typeof functions.updateMintingFee>
export type UpdateMintingFeeReturn = FunctionReturn<typeof functions.updateMintingFee>

export type UpdatePriceToleranceParams = FunctionArguments<typeof functions.updatePriceTolerance>
export type UpdatePriceToleranceReturn = FunctionReturn<typeof functions.updatePriceTolerance>

export type VusdParams = FunctionArguments<typeof functions.vusd>
export type VusdReturn = FunctionReturn<typeof functions.vusd>

export type WhitelistedTokensParams = FunctionArguments<typeof functions.whitelistedTokens>
export type WhitelistedTokensReturn = FunctionReturn<typeof functions.whitelistedTokens>

