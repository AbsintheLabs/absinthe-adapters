import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    AuctionCancelled: event("0xdb9cc99dc874f9afbae71151f737e51547d3d412b52922793437d86607050c3c", "AuctionCancelled(uint256,uint256)", {"_auctionId": indexed(p.uint256), "_tokenId": p.uint256}),
    Auction_BidPlaced: event("0x1cd77ec6c10f614681f30c7aa33ebc645b4d597aaf7039f6210e71d0e15c9181", "Auction_BidPlaced(uint256,address,uint256)", {"_auctionID": indexed(p.uint256), "_bidder": indexed(p.address), "_bidAmount": p.uint256}),
    Auction_BidRemoved: event("0xfff24e92e1cbce6e08fa0c957732709b2be79be2ce26c732bcfae1cc368356e5", "Auction_BidRemoved(uint256,address,uint256)", {"_auctionID": indexed(p.uint256), "_bidder": indexed(p.address), "_bidAmount": p.uint256}),
    Auction_BoughtNow: event("0x7499cdcb78443a97a40121f32bf5ca930b090cbfcf9dbfb4b2595ef85f5a4ab6", "Auction_BoughtNow(uint256,address)", {"_auctionId": indexed(p.uint256), "_buyer": indexed(p.address)}),
    Auction_BuyItNowUpdated: event("0xf2dc5cd6c3ed22423032dc954e4aea66a8588bb2a4aa773d401d27be68b80f7b", "Auction_BuyItNowUpdated(uint256,uint256)", {"_auctionId": indexed(p.uint256), "_buyItNowPrice": p.uint256}),
    Auction_EndTimeUpdated: event("0x2e7f50c8a01968bd8edfe9b3ae46a4d0fa3ce89e533d76245c2684ee9882c0cb", "Auction_EndTimeUpdated(uint256,uint256)", {"_auctionID": indexed(p.uint256), "_endTime": p.uint256}),
    Auction_IncentivePaid: event("0xc6330f2f35039b6e7bcfdeb0c2e959d355b88d8c2292ca4a4c42f514cc958be3", "Auction_IncentivePaid(uint256,address,uint256)", {"_auctionID": indexed(p.uint256), "_earner": indexed(p.address), "_incentiveAmount": p.uint256}),
    Auction_Initialized: event("0x62cdbfd46ba3699fb4c7d38a9c09912eedc7dbab26dd93d8a0deea366cb90a9b", "Auction_Initialized(uint256,uint256,uint256,address,bytes4,uint256)", {"_auctionID": indexed(p.uint256), "_tokenID": indexed(p.uint256), "_tokenAmount": indexed(p.uint256), "_contractAddress": p.address, "_tokenKind": p.bytes4, "_presetID": p.uint256}),
    Auction_ItemClaimed: event("0x36c817b01bdbc20b542bcc10ca808780e14aa4c1043a66966a7692de51df5113", "Auction_ItemClaimed(uint256)", {"_auctionID": indexed(p.uint256)}),
    Auction_Modified: event("0x4c0e245216fe061f94169d2798d29deb8f561b330e5c8d90146221faef3878bb", "Auction_Modified(uint256,uint64,uint80)", {"_auctionID": indexed(p.uint256), "_newTokenAmount": indexed(p.uint64), "_newEndTime": indexed(p.uint80)}),
    Auction_StartTimeUpdated: event("0xf2ba5bc98aa30ef7c698049efdd30143dcee3ac45628338de9444ade4b47c650", "Auction_StartTimeUpdated(uint256,uint256,uint256)", {"_auctionID": indexed(p.uint256), "_startTime": p.uint256, "_endTime": p.uint256}),
    Auction_StartingPriceUpdated: event("0xf4f263f6617f8db9156c85cfa6100d6403896b1a02a341079f465c4929c1cd2a", "Auction_StartingPriceUpdated(uint256,uint256)", {"_auctionId": indexed(p.uint256), "_startPrice": p.uint256}),
    Contract_BiddingAllowed: event("0x0b4ea68d808f372a5097f85b16d5e69e050d94a33668fd980f8876593bb8e571", "Contract_BiddingAllowed(address,bool)", {"_contract": indexed(p.address), "_biddingAllowed": p.bool}),
    RoyaltyPaid: event("0xf3f83c9d88dc83497cc705129934b4aa146d32ecd677e6ed32c57009a077067e", "RoyaltyPaid(uint256,address,address,uint256)", {"_auctionId": indexed(p.uint256), "_tokenContractAddress": indexed(p.address), "_beneficiary": p.address, "_amount": p.uint256}),
}

export const functions = {
    batchClaim: fun("0xbc292782", "batchClaim(uint256[])", {"_auctionIDs": p.array(p.uint256)}, ),
    batchCreateAuctions: fun("0x72efe4e3", "batchCreateAuctions((uint80,uint80,uint56,uint8,bytes4,uint256,uint96,uint96)[],address[],uint256[])", {"_info": p.array(p.struct({"startTime": p.uint80, "endTime": p.uint80, "tokenAmount": p.uint56, "category": p.uint8, "tokenKind": p.bytes4, "tokenID": p.uint256, "buyItNowPrice": p.uint96, "startingBid": p.uint96})), "_tokenContracts": p.array(p.address), "_auctionPresetIDs": p.array(p.uint256)}, ),
    buyNow: fun("0x08a0f32f", "buyNow(uint256)", {"_auctionID": p.uint256}, ),
    cancelAuction: fun("0x96b5a755", "cancelAuction(uint256)", {"_auctionID": p.uint256}, ),
    claim: fun("0x379607f5", "claim(uint256)", {"_auctionID": p.uint256}, ),
    claimAll: fun("0x28c77820", "claimAll(uint256[])", {"_auctionIds": p.array(p.uint256)}, ),
    commitBid: fun("0xd2f699fc", "commitBid(uint256,uint256,uint256,address,uint256,uint256,bytes)", {"_auctionID": p.uint256, "_bidAmount": p.uint256, "_highestBid": p.uint256, "_tokenContract": p.address, "_tokenID": p.uint256, "_amount": p.uint256, "_signature": p.bytes}, ),
    createAuction: fun("0xd4e42fea", "createAuction((uint80,uint80,uint56,uint8,bytes4,uint256,uint96,uint96),address,uint256)", {"_info": p.struct({"startTime": p.uint80, "endTime": p.uint80, "tokenAmount": p.uint56, "category": p.uint8, "tokenKind": p.bytes4, "tokenID": p.uint256, "buyItNowPrice": p.uint96, "startingBid": p.uint96}), "_tokenContract": p.address, "_auctionPresetID": p.uint256}, p.uint256),
    getAllUnclaimedAuctions: viewFun("0x380daab4", "getAllUnclaimedAuctions()", {}, p.array(p.uint256)),
    getAuctionBidDecimals: viewFun("0x3f21cf81", "getAuctionBidDecimals(uint256)", {"_auctionID": p.uint256}, p.uint256),
    getAuctionBidMultiplier: viewFun("0xda081c94", "getAuctionBidMultiplier(uint256)", {"_auctionID": p.uint256}, p.uint64),
    getAuctionDebt: viewFun("0x6b9a894e", "getAuctionDebt(uint256)", {"_auctionID": p.uint256}, p.uint256),
    getAuctionDueIncentives: viewFun("0x03ea66a4", "getAuctionDueIncentives(uint256)", {"_auctionID": p.uint256}, p.uint256),
    getAuctionEndTime: viewFun("0x930e79f1", "getAuctionEndTime(uint256)", {"_auctionID": p.uint256}, p.uint256),
    getAuctionHammerTimeDuration: viewFun("0xe25f5b32", "getAuctionHammerTimeDuration()", {}, p.uint256),
    getAuctionHighestBid: viewFun("0xc26e748c", "getAuctionHighestBid(uint256)", {"_auctionID": p.uint256}, p.uint256),
    getAuctionHighestBidder: viewFun("0xdfab114b", "getAuctionHighestBidder(uint256)", {"_auctionID": p.uint256}, p.address),
    getAuctionIncMax: viewFun("0xdb145701", "getAuctionIncMax(uint256)", {"_auctionID": p.uint256}, p.uint64),
    getAuctionIncMin: viewFun("0xef8c55fd", "getAuctionIncMin(uint256)", {"_auctionID": p.uint256}, p.uint64),
    getAuctionInfo: viewFun("0xfc3fc4ed", "getAuctionInfo(uint256)", {"_auctionID": p.uint256}, p.struct({"owner": p.address, "highestBid": p.uint96, "highestBidder": p.address, "auctionDebt": p.uint88, "dueIncentives": p.uint88, "biddingAllowed": p.bool, "claimed": p.bool, "tokenContract": p.address, "info": p.struct({"startTime": p.uint80, "endTime": p.uint80, "tokenAmount": p.uint56, "category": p.uint8, "tokenKind": p.bytes4, "tokenID": p.uint256, "buyItNowPrice": p.uint96, "startingBid": p.uint96}), "presets": p.struct({"incMin": p.uint64, "incMax": p.uint64, "bidMultiplier": p.uint64, "stepMin": p.uint64, "bidDecimals": p.uint256}), "buyItNowPrice": p.uint96, "startingBid": p.uint96})),
    getAuctionPresets: viewFun("0x5608de71", "getAuctionPresets(uint256)", {"_auctionPresetID": p.uint256}, p.struct({"incMin": p.uint64, "incMax": p.uint64, "bidMultiplier": p.uint64, "stepMin": p.uint64, "bidDecimals": p.uint256})),
    getAuctionStartTime: viewFun("0x919e84f5", "getAuctionStartTime(uint256)", {"_auctionID": p.uint256}, p.uint256),
    getAuctionStepMin: viewFun("0xe07bc69c", "getAuctionStepMin(uint256)", {"_auctionID": p.uint256}, p.uint64),
    getBuyItNowInvalidationThreshold: viewFun("0xd6f249d7", "getBuyItNowInvalidationThreshold()", {}, p.uint256),
    getContractAddress: viewFun("0xaefa7d98", "getContractAddress(uint256)", {"_auctionID": p.uint256}, p.address),
    getTokenId: viewFun("0x14ff5ea3", "getTokenId(uint256)", {"_auctionID": p.uint256}, p.uint256),
    getTokenKind: viewFun("0x0facebea", "getTokenKind(uint256)", {"_auctionID": p.uint256}, p.bytes4),
    isBiddingAllowed: viewFun("0x4f6f108a", "isBiddingAllowed(address)", {"_contract": p.address}, p.bool),
    modifyAuction: fun("0xcbd314de", "modifyAuction(uint256,uint80,uint56,bytes4)", {"_auctionID": p.uint256, "_newEndTime": p.uint80, "_newTokenAmount": p.uint56, "_tokenKind": p.bytes4}, ),
    onERC1155BatchReceived: viewFun("0xbc197c81", "onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)", {"_0": p.address, "_1": p.address, "_2": p.array(p.uint256), "_3": p.array(p.uint256), "_4": p.bytes}, p.bytes4),
    onERC1155Received: viewFun("0xf23a6e61", "onERC1155Received(address,address,uint256,uint256,bytes)", {"_0": p.address, "_1": p.address, "_2": p.uint256, "_3": p.uint256, "_4": p.bytes}, p.bytes4),
    onERC721Received: viewFun("0x150b7a02", "onERC721Received(address,address,uint256,bytes)", {"_0": p.address, "_1": p.address, "_2": p.uint256, "_3": p.bytes}, p.bytes4),
    setAddresses: fun("0x4a945f8d", "setAddresses(address,address,address,address)", {"_pixelcraft": p.address, "_dao": p.address, "_gbm": p.address, "_rarityFarming": p.address}, ),
    setAuctionPresets: fun("0x2777de40", "setAuctionPresets(uint256,(uint64,uint64,uint64,uint64,uint256))", {"_auctionPresetID": p.uint256, "_preset": p.struct({"incMin": p.uint64, "incMax": p.uint64, "bidMultiplier": p.uint64, "stepMin": p.uint64, "bidDecimals": p.uint256})}, ),
    setBiddingAllowed: fun("0x50d265d4", "setBiddingAllowed(address,bool)", {"_contract": p.address, "_value": p.bool}, ),
    setBuyItNowInvalidationThreshold: fun("0x0d415315", "setBuyItNowInvalidationThreshold(uint256)", {"_invalidationThreshold": p.uint256}, ),
    setBuyNow: fun("0xf750e993", "setBuyNow(uint256,uint96)", {"_auctionID": p.uint256, "_buyItNowPrice": p.uint96}, ),
    setPubkey: fun("0x1c26a54b", "setPubkey(bytes)", {"_newPubkey": p.bytes}, ),
    toggleContractWhitelist: fun("0x3d9a111f", "toggleContractWhitelist(address,bool)", {"_tokenContract": p.address, "_allowed": p.bool}, ),
    toggleDiamondPause: fun("0x82141f8e", "toggleDiamondPause(bool)", {"_pause": p.bool}, ),
}

export class Contract extends ContractBase {

    getAllUnclaimedAuctions() {
        return this.eth_call(functions.getAllUnclaimedAuctions, {})
    }

    getAuctionBidDecimals(_auctionID: GetAuctionBidDecimalsParams["_auctionID"]) {
        return this.eth_call(functions.getAuctionBidDecimals, {_auctionID})
    }

    getAuctionBidMultiplier(_auctionID: GetAuctionBidMultiplierParams["_auctionID"]) {
        return this.eth_call(functions.getAuctionBidMultiplier, {_auctionID})
    }

    getAuctionDebt(_auctionID: GetAuctionDebtParams["_auctionID"]) {
        return this.eth_call(functions.getAuctionDebt, {_auctionID})
    }

    getAuctionDueIncentives(_auctionID: GetAuctionDueIncentivesParams["_auctionID"]) {
        return this.eth_call(functions.getAuctionDueIncentives, {_auctionID})
    }

    getAuctionEndTime(_auctionID: GetAuctionEndTimeParams["_auctionID"]) {
        return this.eth_call(functions.getAuctionEndTime, {_auctionID})
    }

    getAuctionHammerTimeDuration() {
        return this.eth_call(functions.getAuctionHammerTimeDuration, {})
    }

    getAuctionHighestBid(_auctionID: GetAuctionHighestBidParams["_auctionID"]) {
        return this.eth_call(functions.getAuctionHighestBid, {_auctionID})
    }

    getAuctionHighestBidder(_auctionID: GetAuctionHighestBidderParams["_auctionID"]) {
        return this.eth_call(functions.getAuctionHighestBidder, {_auctionID})
    }

    getAuctionIncMax(_auctionID: GetAuctionIncMaxParams["_auctionID"]) {
        return this.eth_call(functions.getAuctionIncMax, {_auctionID})
    }

    getAuctionIncMin(_auctionID: GetAuctionIncMinParams["_auctionID"]) {
        return this.eth_call(functions.getAuctionIncMin, {_auctionID})
    }

    getAuctionInfo(_auctionID: GetAuctionInfoParams["_auctionID"]) {
        return this.eth_call(functions.getAuctionInfo, {_auctionID})
    }

    getAuctionPresets(_auctionPresetID: GetAuctionPresetsParams["_auctionPresetID"]) {
        return this.eth_call(functions.getAuctionPresets, {_auctionPresetID})
    }

    getAuctionStartTime(_auctionID: GetAuctionStartTimeParams["_auctionID"]) {
        return this.eth_call(functions.getAuctionStartTime, {_auctionID})
    }

    getAuctionStepMin(_auctionID: GetAuctionStepMinParams["_auctionID"]) {
        return this.eth_call(functions.getAuctionStepMin, {_auctionID})
    }

    getBuyItNowInvalidationThreshold() {
        return this.eth_call(functions.getBuyItNowInvalidationThreshold, {})
    }

    getContractAddress(_auctionID: GetContractAddressParams["_auctionID"]) {
        return this.eth_call(functions.getContractAddress, {_auctionID})
    }

    getTokenId(_auctionID: GetTokenIdParams["_auctionID"]) {
        return this.eth_call(functions.getTokenId, {_auctionID})
    }

    getTokenKind(_auctionID: GetTokenKindParams["_auctionID"]) {
        return this.eth_call(functions.getTokenKind, {_auctionID})
    }

    isBiddingAllowed(_contract: IsBiddingAllowedParams["_contract"]) {
        return this.eth_call(functions.isBiddingAllowed, {_contract})
    }

    onERC1155BatchReceived(_0: OnERC1155BatchReceivedParams["_0"], _1: OnERC1155BatchReceivedParams["_1"], _2: OnERC1155BatchReceivedParams["_2"], _3: OnERC1155BatchReceivedParams["_3"], _4: OnERC1155BatchReceivedParams["_4"]) {
        return this.eth_call(functions.onERC1155BatchReceived, {_0, _1, _2, _3, _4})
    }

    onERC1155Received(_0: OnERC1155ReceivedParams["_0"], _1: OnERC1155ReceivedParams["_1"], _2: OnERC1155ReceivedParams["_2"], _3: OnERC1155ReceivedParams["_3"], _4: OnERC1155ReceivedParams["_4"]) {
        return this.eth_call(functions.onERC1155Received, {_0, _1, _2, _3, _4})
    }

    onERC721Received(_0: OnERC721ReceivedParams["_0"], _1: OnERC721ReceivedParams["_1"], _2: OnERC721ReceivedParams["_2"], _3: OnERC721ReceivedParams["_3"]) {
        return this.eth_call(functions.onERC721Received, {_0, _1, _2, _3})
    }
}

/// Event types
export type AuctionCancelledEventArgs = EParams<typeof events.AuctionCancelled>
export type Auction_BidPlacedEventArgs = EParams<typeof events.Auction_BidPlaced>
export type Auction_BidRemovedEventArgs = EParams<typeof events.Auction_BidRemoved>
export type Auction_BoughtNowEventArgs = EParams<typeof events.Auction_BoughtNow>
export type Auction_BuyItNowUpdatedEventArgs = EParams<typeof events.Auction_BuyItNowUpdated>
export type Auction_EndTimeUpdatedEventArgs = EParams<typeof events.Auction_EndTimeUpdated>
export type Auction_IncentivePaidEventArgs = EParams<typeof events.Auction_IncentivePaid>
export type Auction_InitializedEventArgs = EParams<typeof events.Auction_Initialized>
export type Auction_ItemClaimedEventArgs = EParams<typeof events.Auction_ItemClaimed>
export type Auction_ModifiedEventArgs = EParams<typeof events.Auction_Modified>
export type Auction_StartTimeUpdatedEventArgs = EParams<typeof events.Auction_StartTimeUpdated>
export type Auction_StartingPriceUpdatedEventArgs = EParams<typeof events.Auction_StartingPriceUpdated>
export type Contract_BiddingAllowedEventArgs = EParams<typeof events.Contract_BiddingAllowed>
export type RoyaltyPaidEventArgs = EParams<typeof events.RoyaltyPaid>

/// Function types
export type BatchClaimParams = FunctionArguments<typeof functions.batchClaim>
export type BatchClaimReturn = FunctionReturn<typeof functions.batchClaim>

export type BatchCreateAuctionsParams = FunctionArguments<typeof functions.batchCreateAuctions>
export type BatchCreateAuctionsReturn = FunctionReturn<typeof functions.batchCreateAuctions>

export type BuyNowParams = FunctionArguments<typeof functions.buyNow>
export type BuyNowReturn = FunctionReturn<typeof functions.buyNow>

export type CancelAuctionParams = FunctionArguments<typeof functions.cancelAuction>
export type CancelAuctionReturn = FunctionReturn<typeof functions.cancelAuction>

export type ClaimParams = FunctionArguments<typeof functions.claim>
export type ClaimReturn = FunctionReturn<typeof functions.claim>

export type ClaimAllParams = FunctionArguments<typeof functions.claimAll>
export type ClaimAllReturn = FunctionReturn<typeof functions.claimAll>

export type CommitBidParams = FunctionArguments<typeof functions.commitBid>
export type CommitBidReturn = FunctionReturn<typeof functions.commitBid>

export type CreateAuctionParams = FunctionArguments<typeof functions.createAuction>
export type CreateAuctionReturn = FunctionReturn<typeof functions.createAuction>

export type GetAllUnclaimedAuctionsParams = FunctionArguments<typeof functions.getAllUnclaimedAuctions>
export type GetAllUnclaimedAuctionsReturn = FunctionReturn<typeof functions.getAllUnclaimedAuctions>

export type GetAuctionBidDecimalsParams = FunctionArguments<typeof functions.getAuctionBidDecimals>
export type GetAuctionBidDecimalsReturn = FunctionReturn<typeof functions.getAuctionBidDecimals>

export type GetAuctionBidMultiplierParams = FunctionArguments<typeof functions.getAuctionBidMultiplier>
export type GetAuctionBidMultiplierReturn = FunctionReturn<typeof functions.getAuctionBidMultiplier>

export type GetAuctionDebtParams = FunctionArguments<typeof functions.getAuctionDebt>
export type GetAuctionDebtReturn = FunctionReturn<typeof functions.getAuctionDebt>

export type GetAuctionDueIncentivesParams = FunctionArguments<typeof functions.getAuctionDueIncentives>
export type GetAuctionDueIncentivesReturn = FunctionReturn<typeof functions.getAuctionDueIncentives>

export type GetAuctionEndTimeParams = FunctionArguments<typeof functions.getAuctionEndTime>
export type GetAuctionEndTimeReturn = FunctionReturn<typeof functions.getAuctionEndTime>

export type GetAuctionHammerTimeDurationParams = FunctionArguments<typeof functions.getAuctionHammerTimeDuration>
export type GetAuctionHammerTimeDurationReturn = FunctionReturn<typeof functions.getAuctionHammerTimeDuration>

export type GetAuctionHighestBidParams = FunctionArguments<typeof functions.getAuctionHighestBid>
export type GetAuctionHighestBidReturn = FunctionReturn<typeof functions.getAuctionHighestBid>

export type GetAuctionHighestBidderParams = FunctionArguments<typeof functions.getAuctionHighestBidder>
export type GetAuctionHighestBidderReturn = FunctionReturn<typeof functions.getAuctionHighestBidder>

export type GetAuctionIncMaxParams = FunctionArguments<typeof functions.getAuctionIncMax>
export type GetAuctionIncMaxReturn = FunctionReturn<typeof functions.getAuctionIncMax>

export type GetAuctionIncMinParams = FunctionArguments<typeof functions.getAuctionIncMin>
export type GetAuctionIncMinReturn = FunctionReturn<typeof functions.getAuctionIncMin>

export type GetAuctionInfoParams = FunctionArguments<typeof functions.getAuctionInfo>
export type GetAuctionInfoReturn = FunctionReturn<typeof functions.getAuctionInfo>

export type GetAuctionPresetsParams = FunctionArguments<typeof functions.getAuctionPresets>
export type GetAuctionPresetsReturn = FunctionReturn<typeof functions.getAuctionPresets>

export type GetAuctionStartTimeParams = FunctionArguments<typeof functions.getAuctionStartTime>
export type GetAuctionStartTimeReturn = FunctionReturn<typeof functions.getAuctionStartTime>

export type GetAuctionStepMinParams = FunctionArguments<typeof functions.getAuctionStepMin>
export type GetAuctionStepMinReturn = FunctionReturn<typeof functions.getAuctionStepMin>

export type GetBuyItNowInvalidationThresholdParams = FunctionArguments<typeof functions.getBuyItNowInvalidationThreshold>
export type GetBuyItNowInvalidationThresholdReturn = FunctionReturn<typeof functions.getBuyItNowInvalidationThreshold>

export type GetContractAddressParams = FunctionArguments<typeof functions.getContractAddress>
export type GetContractAddressReturn = FunctionReturn<typeof functions.getContractAddress>

export type GetTokenIdParams = FunctionArguments<typeof functions.getTokenId>
export type GetTokenIdReturn = FunctionReturn<typeof functions.getTokenId>

export type GetTokenKindParams = FunctionArguments<typeof functions.getTokenKind>
export type GetTokenKindReturn = FunctionReturn<typeof functions.getTokenKind>

export type IsBiddingAllowedParams = FunctionArguments<typeof functions.isBiddingAllowed>
export type IsBiddingAllowedReturn = FunctionReturn<typeof functions.isBiddingAllowed>

export type ModifyAuctionParams = FunctionArguments<typeof functions.modifyAuction>
export type ModifyAuctionReturn = FunctionReturn<typeof functions.modifyAuction>

export type OnERC1155BatchReceivedParams = FunctionArguments<typeof functions.onERC1155BatchReceived>
export type OnERC1155BatchReceivedReturn = FunctionReturn<typeof functions.onERC1155BatchReceived>

export type OnERC1155ReceivedParams = FunctionArguments<typeof functions.onERC1155Received>
export type OnERC1155ReceivedReturn = FunctionReturn<typeof functions.onERC1155Received>

export type OnERC721ReceivedParams = FunctionArguments<typeof functions.onERC721Received>
export type OnERC721ReceivedReturn = FunctionReturn<typeof functions.onERC721Received>

export type SetAddressesParams = FunctionArguments<typeof functions.setAddresses>
export type SetAddressesReturn = FunctionReturn<typeof functions.setAddresses>

export type SetAuctionPresetsParams = FunctionArguments<typeof functions.setAuctionPresets>
export type SetAuctionPresetsReturn = FunctionReturn<typeof functions.setAuctionPresets>

export type SetBiddingAllowedParams = FunctionArguments<typeof functions.setBiddingAllowed>
export type SetBiddingAllowedReturn = FunctionReturn<typeof functions.setBiddingAllowed>

export type SetBuyItNowInvalidationThresholdParams = FunctionArguments<typeof functions.setBuyItNowInvalidationThreshold>
export type SetBuyItNowInvalidationThresholdReturn = FunctionReturn<typeof functions.setBuyItNowInvalidationThreshold>

export type SetBuyNowParams = FunctionArguments<typeof functions.setBuyNow>
export type SetBuyNowReturn = FunctionReturn<typeof functions.setBuyNow>

export type SetPubkeyParams = FunctionArguments<typeof functions.setPubkey>
export type SetPubkeyReturn = FunctionReturn<typeof functions.setPubkey>

export type ToggleContractWhitelistParams = FunctionArguments<typeof functions.toggleContractWhitelist>
export type ToggleContractWhitelistReturn = FunctionReturn<typeof functions.toggleContractWhitelist>

export type ToggleDiamondPauseParams = FunctionArguments<typeof functions.toggleDiamondPause>
export type ToggleDiamondPauseReturn = FunctionReturn<typeof functions.toggleDiamondPause>

