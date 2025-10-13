import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    Auction_BidPlaced: event("0x1cd77ec6c10f614681f30c7aa33ebc645b4d597aaf7039f6210e71d0e15c9181", "Auction_BidPlaced(uint256,address,uint256)", {"_auctionID": indexed(p.uint256), "_bidder": indexed(p.address), "_bidAmount": p.uint256}),
    Auction_BidRemoved: event("0xfff24e92e1cbce6e08fa0c957732709b2be79be2ce26c732bcfae1cc368356e5", "Auction_BidRemoved(uint256,address,uint256)", {"_auctionID": indexed(p.uint256), "_bidder": indexed(p.address), "_bidAmount": p.uint256}),
    Auction_Claimed: event("0xb1270969942994e0432341247ac48a59854a62941bad895492ab9e45418582db", "Auction_Claimed(uint256)", {"_auctionID": indexed(p.uint256)}),
    Auction_EndTimeUpdated: event("0x2e7f50c8a01968bd8edfe9b3ae46a4d0fa3ce89e533d76245c2684ee9882c0cb", "Auction_EndTimeUpdated(uint256,uint256)", {"_auctionID": indexed(p.uint256), "_endTime": p.uint256}),
    Auction_IncentivePaid: event("0xc6330f2f35039b6e7bcfdeb0c2e959d355b88d8c2292ca4a4c42f514cc958be3", "Auction_IncentivePaid(uint256,address,uint256)", {"_auctionID": indexed(p.uint256), "_earner": indexed(p.address), "_incentiveAmount": p.uint256}),
    Auction_Initialized: event("0xb9d707ce49c63f003358ae85d59fc5c7762e8de3ce5a41f6bb0e7fb5e1a4cd85", "Auction_Initialized(uint256,uint256,address,bytes4)", {"_auctionID": indexed(p.uint256), "_tokenID": indexed(p.uint256), "_contractAddress": indexed(p.address), "_tokenKind": p.bytes4}),
    Auction_StartTimeUpdated: event("0x13868ce1b50a84aac263efd89923de989e831c1c1184925e076d0db83d2b1453", "Auction_StartTimeUpdated(uint256,uint256)", {"_auctionID": indexed(p.uint256), "_startTime": p.uint256}),
    OwnershipTransferred: event("0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0", "OwnershipTransferred(address,address)", {"previousOwner": indexed(p.address), "newOwner": indexed(p.address)}),
}

export const functions = {
    beneficiary: viewFun("0x38af3eed", "beneficiary()", {}, p.address),
    bid: fun("0x6da79a93", "bid(uint256,uint256,uint256,address)", {"_auctionID": p.uint256, "_bidAmount": p.uint256, "_highestBid": p.uint256, "_bidder": p.address}, ),
    claim: fun("0x379607f5", "claim(uint256)", {"_auctionID": p.uint256}, ),
    claimMultiple: fun("0x9051cce9", "claimMultiple(uint256[])", {"_auctionIDs": p.array(p.uint256)}, ),
    editionBeneficiary: viewFun("0x08480fe5", "editionBeneficiary()", {}, p.address),
    editionContract: viewFun("0x40ae8aba", "editionContract()", {}, p.address),
    getAuctionBidDecimals: viewFun("0x3f21cf81", "getAuctionBidDecimals(uint256)", {"_auctionID": p.uint256}, p.uint256),
    getAuctionBidMultiplier: viewFun("0xda081c94", "getAuctionBidMultiplier(uint256)", {"_auctionID": p.uint256}, p.uint256),
    getAuctionDebt: viewFun("0x6b9a894e", "getAuctionDebt(uint256)", {"_auctionID": p.uint256}, p.uint256),
    getAuctionDueIncentives: viewFun("0x03ea66a4", "getAuctionDueIncentives(uint256)", {"_auctionID": p.uint256}, p.uint256),
    getAuctionEndTime: viewFun("0x930e79f1", "getAuctionEndTime(uint256)", {"_auctionID": p.uint256}, p.uint256),
    getAuctionHighestBid: viewFun("0xc26e748c", "getAuctionHighestBid(uint256)", {"_auctionID": p.uint256}, p.uint256),
    getAuctionHighestBidder: viewFun("0xdfab114b", "getAuctionHighestBidder(uint256)", {"_auctionID": p.uint256}, p.address),
    getAuctionID: viewFun("0x74f8c40b", "getAuctionID(address,bytes4,uint256,uint256)", {"_contract": p.address, "_1": p.bytes4, "_tokenID": p.uint256, "_3": p.uint256}, p.uint256),
    getAuctionIDSongADao: viewFun("0x78370d7b", "getAuctionIDSongADao(address,uint256)", {"_contract": p.address, "_tokenID": p.uint256}, p.uint256),
    getAuctionIncMax: viewFun("0xdb145701", "getAuctionIncMax(uint256)", {"_auctionID": p.uint256}, p.uint256),
    getAuctionIncMin: viewFun("0xef8c55fd", "getAuctionIncMin(uint256)", {"_auctionID": p.uint256}, p.uint256),
    getAuctionStartTime: viewFun("0x919e84f5", "getAuctionStartTime(uint256)", {"_auctionID": p.uint256}, p.uint256),
    getAuctionStepMin: viewFun("0xe07bc69c", "getAuctionStepMin(uint256)", {"_auctionID": p.uint256}, p.uint256),
    getContractAddress: viewFun("0xaefa7d98", "getContractAddress(uint256)", {"_auctionID": p.uint256}, p.address),
    getEditionTokenId: viewFun("0x58e83e5b", "getEditionTokenId(uint256)", {"_auctionID": p.uint256}, p.uint256),
    getHammerTimeDuration: viewFun("0xcb7020e4", "getHammerTimeDuration(uint256)", {"_auctionID": p.uint256}, p.uint256),
    getTokenAmount: viewFun("0xc2507ac1", "getTokenAmount(uint256)", {"_0": p.uint256}, p.uint256),
    getTokenId: viewFun("0x14ff5ea3", "getTokenId(uint256)", {"_auctionID": p.uint256}, p.uint256),
    getTokenKind: viewFun("0x0facebea", "getTokenKind(uint256)", {"_auctionID": p.uint256}, p.bytes4),
    getWithdrawBalance: viewFun("0x75e5af3b", "getWithdrawBalance(address)", {"account": p.address}, p.uint256),
    modifyAnAuctionTokenSongAdao: fun("0x56f23ae3", "modifyAnAuctionTokenSongAdao(uint256,address,uint256,uint256)", {"_auctionID": p.uint256, "_initiator": p.address, "_startTime": p.uint256, "_endTime": p.uint256}, ),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    registerAnAuctionContract: fun("0xb3f78050", "registerAnAuctionContract(address,address)", {"_contract": p.address, "_initiator": p.address}, ),
    registerAnAuctionTokenSongAdao: fun("0x35f9cb46", "registerAnAuctionTokenSongAdao(address,uint256,uint256,uint256,uint256)", {"_contract": p.address, "_tokenID": p.uint256, "_startTime": p.uint256, "_endTime": p.uint256, "_editionTokenID": p.uint256}, ),
    renounceOwnership: fun("0x715018a6", "renounceOwnership()", {}, ),
    setBeneficiary: fun("0x1c31f710", "setBeneficiary(address)", {"_beneficiary": p.address}, ),
    setBiddingAllowed: fun("0x50d265d4", "setBiddingAllowed(address,bool)", {"_contract": p.address, "_value": p.bool}, ),
    setEditionBeneficiary: fun("0x8ebd7113", "setEditionBeneficiary(address)", {"_editionBeneficiary": p.address}, ),
    setEditionContract: fun("0x433f7b8b", "setEditionContract(address)", {"_contract": p.address}, ),
    setEditionTokenId: fun("0x2f399530", "setEditionTokenId(uint256,uint256)", {"_auctionID": p.uint256, "_editionTokenID": p.uint256}, ),
    supportsInterface: viewFun("0x01ffc9a7", "supportsInterface(bytes4)", {"interfaceId": p.bytes4}, p.bool),
    transferOwnership: fun("0xf2fde38b", "transferOwnership(address)", {"newOwner": p.address}, ),
    wasClaimed: viewFun("0x9b7a7009", "wasClaimed(uint256)", {"_auctionID": p.uint256}, p.bool),
    withdraw: fun("0x51cff8d9", "withdraw(address)", {"_withdrawer": p.address}, ),
}

export class Contract extends ContractBase {

    beneficiary() {
        return this.eth_call(functions.beneficiary, {})
    }

    editionBeneficiary() {
        return this.eth_call(functions.editionBeneficiary, {})
    }

    editionContract() {
        return this.eth_call(functions.editionContract, {})
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

    getAuctionHighestBid(_auctionID: GetAuctionHighestBidParams["_auctionID"]) {
        return this.eth_call(functions.getAuctionHighestBid, {_auctionID})
    }

    getAuctionHighestBidder(_auctionID: GetAuctionHighestBidderParams["_auctionID"]) {
        return this.eth_call(functions.getAuctionHighestBidder, {_auctionID})
    }

    getAuctionID(_contract: GetAuctionIDParams["_contract"], _1: GetAuctionIDParams["_1"], _tokenID: GetAuctionIDParams["_tokenID"], _3: GetAuctionIDParams["_3"]) {
        return this.eth_call(functions.getAuctionID, {_contract, _1, _tokenID, _3})
    }

    getAuctionIDSongADao(_contract: GetAuctionIDSongADaoParams["_contract"], _tokenID: GetAuctionIDSongADaoParams["_tokenID"]) {
        return this.eth_call(functions.getAuctionIDSongADao, {_contract, _tokenID})
    }

    getAuctionIncMax(_auctionID: GetAuctionIncMaxParams["_auctionID"]) {
        return this.eth_call(functions.getAuctionIncMax, {_auctionID})
    }

    getAuctionIncMin(_auctionID: GetAuctionIncMinParams["_auctionID"]) {
        return this.eth_call(functions.getAuctionIncMin, {_auctionID})
    }

    getAuctionStartTime(_auctionID: GetAuctionStartTimeParams["_auctionID"]) {
        return this.eth_call(functions.getAuctionStartTime, {_auctionID})
    }

    getAuctionStepMin(_auctionID: GetAuctionStepMinParams["_auctionID"]) {
        return this.eth_call(functions.getAuctionStepMin, {_auctionID})
    }

    getContractAddress(_auctionID: GetContractAddressParams["_auctionID"]) {
        return this.eth_call(functions.getContractAddress, {_auctionID})
    }

    getEditionTokenId(_auctionID: GetEditionTokenIdParams["_auctionID"]) {
        return this.eth_call(functions.getEditionTokenId, {_auctionID})
    }

    getHammerTimeDuration(_auctionID: GetHammerTimeDurationParams["_auctionID"]) {
        return this.eth_call(functions.getHammerTimeDuration, {_auctionID})
    }

    getTokenAmount(_0: GetTokenAmountParams["_0"]) {
        return this.eth_call(functions.getTokenAmount, {_0})
    }

    getTokenId(_auctionID: GetTokenIdParams["_auctionID"]) {
        return this.eth_call(functions.getTokenId, {_auctionID})
    }

    getTokenKind(_auctionID: GetTokenKindParams["_auctionID"]) {
        return this.eth_call(functions.getTokenKind, {_auctionID})
    }

    getWithdrawBalance(account: GetWithdrawBalanceParams["account"]) {
        return this.eth_call(functions.getWithdrawBalance, {account})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    supportsInterface(interfaceId: SupportsInterfaceParams["interfaceId"]) {
        return this.eth_call(functions.supportsInterface, {interfaceId})
    }

    wasClaimed(_auctionID: WasClaimedParams["_auctionID"]) {
        return this.eth_call(functions.wasClaimed, {_auctionID})
    }
}

/// Event types
export type Auction_BidPlacedEventArgs = EParams<typeof events.Auction_BidPlaced>
export type Auction_BidRemovedEventArgs = EParams<typeof events.Auction_BidRemoved>
export type Auction_ClaimedEventArgs = EParams<typeof events.Auction_Claimed>
export type Auction_EndTimeUpdatedEventArgs = EParams<typeof events.Auction_EndTimeUpdated>
export type Auction_IncentivePaidEventArgs = EParams<typeof events.Auction_IncentivePaid>
export type Auction_InitializedEventArgs = EParams<typeof events.Auction_Initialized>
export type Auction_StartTimeUpdatedEventArgs = EParams<typeof events.Auction_StartTimeUpdated>
export type OwnershipTransferredEventArgs = EParams<typeof events.OwnershipTransferred>

/// Function types
export type BeneficiaryParams = FunctionArguments<typeof functions.beneficiary>
export type BeneficiaryReturn = FunctionReturn<typeof functions.beneficiary>

export type BidParams = FunctionArguments<typeof functions.bid>
export type BidReturn = FunctionReturn<typeof functions.bid>

export type ClaimParams = FunctionArguments<typeof functions.claim>
export type ClaimReturn = FunctionReturn<typeof functions.claim>

export type ClaimMultipleParams = FunctionArguments<typeof functions.claimMultiple>
export type ClaimMultipleReturn = FunctionReturn<typeof functions.claimMultiple>

export type EditionBeneficiaryParams = FunctionArguments<typeof functions.editionBeneficiary>
export type EditionBeneficiaryReturn = FunctionReturn<typeof functions.editionBeneficiary>

export type EditionContractParams = FunctionArguments<typeof functions.editionContract>
export type EditionContractReturn = FunctionReturn<typeof functions.editionContract>

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

export type GetAuctionHighestBidParams = FunctionArguments<typeof functions.getAuctionHighestBid>
export type GetAuctionHighestBidReturn = FunctionReturn<typeof functions.getAuctionHighestBid>

export type GetAuctionHighestBidderParams = FunctionArguments<typeof functions.getAuctionHighestBidder>
export type GetAuctionHighestBidderReturn = FunctionReturn<typeof functions.getAuctionHighestBidder>

export type GetAuctionIDParams = FunctionArguments<typeof functions.getAuctionID>
export type GetAuctionIDReturn = FunctionReturn<typeof functions.getAuctionID>

export type GetAuctionIDSongADaoParams = FunctionArguments<typeof functions.getAuctionIDSongADao>
export type GetAuctionIDSongADaoReturn = FunctionReturn<typeof functions.getAuctionIDSongADao>

export type GetAuctionIncMaxParams = FunctionArguments<typeof functions.getAuctionIncMax>
export type GetAuctionIncMaxReturn = FunctionReturn<typeof functions.getAuctionIncMax>

export type GetAuctionIncMinParams = FunctionArguments<typeof functions.getAuctionIncMin>
export type GetAuctionIncMinReturn = FunctionReturn<typeof functions.getAuctionIncMin>

export type GetAuctionStartTimeParams = FunctionArguments<typeof functions.getAuctionStartTime>
export type GetAuctionStartTimeReturn = FunctionReturn<typeof functions.getAuctionStartTime>

export type GetAuctionStepMinParams = FunctionArguments<typeof functions.getAuctionStepMin>
export type GetAuctionStepMinReturn = FunctionReturn<typeof functions.getAuctionStepMin>

export type GetContractAddressParams = FunctionArguments<typeof functions.getContractAddress>
export type GetContractAddressReturn = FunctionReturn<typeof functions.getContractAddress>

export type GetEditionTokenIdParams = FunctionArguments<typeof functions.getEditionTokenId>
export type GetEditionTokenIdReturn = FunctionReturn<typeof functions.getEditionTokenId>

export type GetHammerTimeDurationParams = FunctionArguments<typeof functions.getHammerTimeDuration>
export type GetHammerTimeDurationReturn = FunctionReturn<typeof functions.getHammerTimeDuration>

export type GetTokenAmountParams = FunctionArguments<typeof functions.getTokenAmount>
export type GetTokenAmountReturn = FunctionReturn<typeof functions.getTokenAmount>

export type GetTokenIdParams = FunctionArguments<typeof functions.getTokenId>
export type GetTokenIdReturn = FunctionReturn<typeof functions.getTokenId>

export type GetTokenKindParams = FunctionArguments<typeof functions.getTokenKind>
export type GetTokenKindReturn = FunctionReturn<typeof functions.getTokenKind>

export type GetWithdrawBalanceParams = FunctionArguments<typeof functions.getWithdrawBalance>
export type GetWithdrawBalanceReturn = FunctionReturn<typeof functions.getWithdrawBalance>

export type ModifyAnAuctionTokenSongAdaoParams = FunctionArguments<typeof functions.modifyAnAuctionTokenSongAdao>
export type ModifyAnAuctionTokenSongAdaoReturn = FunctionReturn<typeof functions.modifyAnAuctionTokenSongAdao>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type RegisterAnAuctionContractParams = FunctionArguments<typeof functions.registerAnAuctionContract>
export type RegisterAnAuctionContractReturn = FunctionReturn<typeof functions.registerAnAuctionContract>

export type RegisterAnAuctionTokenSongAdaoParams = FunctionArguments<typeof functions.registerAnAuctionTokenSongAdao>
export type RegisterAnAuctionTokenSongAdaoReturn = FunctionReturn<typeof functions.registerAnAuctionTokenSongAdao>

export type RenounceOwnershipParams = FunctionArguments<typeof functions.renounceOwnership>
export type RenounceOwnershipReturn = FunctionReturn<typeof functions.renounceOwnership>

export type SetBeneficiaryParams = FunctionArguments<typeof functions.setBeneficiary>
export type SetBeneficiaryReturn = FunctionReturn<typeof functions.setBeneficiary>

export type SetBiddingAllowedParams = FunctionArguments<typeof functions.setBiddingAllowed>
export type SetBiddingAllowedReturn = FunctionReturn<typeof functions.setBiddingAllowed>

export type SetEditionBeneficiaryParams = FunctionArguments<typeof functions.setEditionBeneficiary>
export type SetEditionBeneficiaryReturn = FunctionReturn<typeof functions.setEditionBeneficiary>

export type SetEditionContractParams = FunctionArguments<typeof functions.setEditionContract>
export type SetEditionContractReturn = FunctionReturn<typeof functions.setEditionContract>

export type SetEditionTokenIdParams = FunctionArguments<typeof functions.setEditionTokenId>
export type SetEditionTokenIdReturn = FunctionReturn<typeof functions.setEditionTokenId>

export type SupportsInterfaceParams = FunctionArguments<typeof functions.supportsInterface>
export type SupportsInterfaceReturn = FunctionReturn<typeof functions.supportsInterface>

export type TransferOwnershipParams = FunctionArguments<typeof functions.transferOwnership>
export type TransferOwnershipReturn = FunctionReturn<typeof functions.transferOwnership>

export type WasClaimedParams = FunctionArguments<typeof functions.wasClaimed>
export type WasClaimedReturn = FunctionReturn<typeof functions.wasClaimed>

export type WithdrawParams = FunctionArguments<typeof functions.withdraw>
export type WithdrawReturn = FunctionReturn<typeof functions.withdraw>

