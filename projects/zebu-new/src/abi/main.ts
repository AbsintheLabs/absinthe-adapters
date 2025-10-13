import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    AuctionBid_Displaced: event("0x1c58187b22d704ce5bf553b1df7faaf4acb233657e07f39bf34b941d4631847f", "AuctionBid_Displaced(uint256,uint256,address,uint256,uint256)", {"saleID": indexed(p.uint256), "bidIndex": indexed(p.uint256), "bidder": p.address, "bidamount": p.uint256, "incentivesPaid": p.uint256}),
    AuctionBid_Placed: event("0xb9dc578d21595380d1744119e74f65c4dbe079366e84672baae9319db312e644", "AuctionBid_Placed(uint256,uint256,address,uint256,uint256,uint256)", {"saleID": indexed(p.uint256), "bidIndex": indexed(p.uint256), "bidder": p.address, "bidamount": p.uint256, "incentivesDue": p.uint256, "bidTimestamp": p.uint256}),
    AuctionRegistration_EndTimeUpdated: event("0x4ecb731fc8141b634e3920e05ba4399a7ea5e1df43fe828b884a7de5d96c1827", "AuctionRegistration_EndTimeUpdated(uint256,uint256)", {"saleID": indexed(p.uint256), "endTimeStamp": p.uint256}),
    AuctionRegistration_NewAuction: event("0xda0d63ea905afa5120afff8167b366bb7c08a22beb672c99639a5d1ff1e0ffb3", "AuctionRegistration_NewAuction(uint256,address,uint256,uint256,bytes4,uint256,uint256,uint256,uint256,address,uint256)", {"saleID": indexed(p.uint256), "tokenContractAddress": indexed(p.address), "tokenID": indexed(p.uint256), "tokenAmount": p.uint256, "tokenKind": p.bytes4, "gbmPresetIndex": p.uint256, "currencyID": p.uint256, "startTimestamp": p.uint256, "endTimeStamp": p.uint256, "beneficiary": p.address, "startingBid": p.uint256}),
    AuctionRegistration_NewAuction_Mass: event("0xb15abc73f9fddda3cf003ee06e6ef25070da904dd4cf671c196461bc03f320bb", "AuctionRegistration_NewAuction_Mass(uint256,uint256,address,uint256,bytes4,uint256,uint256,uint256,uint256,address,uint256)", {"saleIDStart": indexed(p.uint256), "saleIDEnd": indexed(p.uint256), "tokenContractAddress": indexed(p.address), "tokenAmount": p.uint256, "tokenKind": p.bytes4, "gbmPresetIndex": p.uint256, "currencyID": p.uint256, "startTimestamp": p.uint256, "endTimeStamp": p.uint256, "beneficiary": p.address, "startingBid": p.uint256}),
    Auction_Claimed: event("0x9f5ff23df5ae700eb3de13c5d1b5e115a115e1ccfb2f4ba47f39024774bae5d5", "Auction_Claimed(uint256,address,uint256,uint256,bytes4,address,uint256,uint256,address)", {"saleID": indexed(p.uint256), "tokenContractAddress": p.address, "tokenID": p.uint256, "tokenAmount": p.uint256, "tokenKind": p.bytes4, "beneficiary": p.address, "winningBidAmount": p.uint256, "winningBidCurrencyIndex": p.uint256, "winner": p.address}),
    Currency_AddressUpdated: event("0x351c74bfd34bfc2e0f46696bdb098a6e0566f30c180f0f4768b8c869f56c6549", "Currency_AddressUpdated(uint256,address)", {"currencyIndex": indexed(p.uint256), "currencyAddress": p.address}),
    Currency_DefaultUpdated: event("0x0a312954467dd4b99aca456ca0df6e8b15c9c39560d96884389be741507fc82e", "Currency_DefaultUpdated(uint256,uint256,address,string)", {"previousCurrencyIndex": p.uint256, "currencyIndex": indexed(p.uint256), "currencyAddress": p.address, "currencyName": p.string}),
    Currency_NameUpdated: event("0x00d93f3ef2b7a0fc656de3fc4c7d4fa14dcfb1ffba33eff35ab449de5254012d", "Currency_NameUpdated(uint256,string)", {"currencyIndex": indexed(p.uint256), "currencyName": p.string}),
    DiamondCut: event("0x8faa70878671ccd212d20771b795c50af8fd3ff6cf27f4bde57e5d4de0aeb673", "DiamondCut((address,uint8,bytes4[])[],address,bytes)", {"_diamondCut": p.array(p.struct({"facetAddress": p.address, "action": p.uint8, "functionSelectors": p.array(p.bytes4)})), "_init": p.address, "_calldata": p.bytes}),
    GBMPreset_DefaultUpdated: event("0xe1d179ca7d1662cfed25cdb2400d9b81edf7fe227f3ef29cff8c626c39bca8b1", "GBMPreset_DefaultUpdated(uint256,uint256)", {"previousPresetID": p.uint256, "presetID": indexed(p.uint256)}),
    GBMPreset_Updated: event("0x5d97d477566f3afcdc09638d332f6e843849931f3e46a7b8aacdf80035d7bfc8", "GBMPreset_Updated(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,string)", {"presetID": indexed(p.uint256), "auctionDuration": p.uint256, "hammerTimeDuration": p.uint256, "cancellationPeriodDuration": p.uint256, "stepMin": p.uint256, "incentiveMin": p.uint256, "incentiveMax": p.uint256, "incentiveGrowthMultiplier": p.uint256, "firstMinBid": p.uint256, "presetName": p.string}),
    MarketPlaceFeesStructure_Updated: event("0x67f3e5521ede8dfebdda805a04f54173479adb87384a88177d9cea08844fb91d", "MarketPlaceFeesStructure_Updated(address,bool,uint256,address,uint256,uint256,uint256)", {"licensePaidTo": p.address, "licensePaidOnChain": p.bool, "GBMFeePercentKage": p.uint256, "marketplaceFeeCollectorWallet": p.address, "mPlaceDirectFeePercentKage": p.uint256, "mPlaceEnglishFeePercentKage": p.uint256, "mPlaceGBMFeePercentKage": p.uint256}),
    NFTContractWhitelisted: event("0x75e1c855ec2720228b3445215a42c0b1a91ad7d62a94cefd6cf5fa01dbf6de34", "NFTContractWhitelisted(address,bool)", {"tokenAddress": p.address, "isWhitelistedForSale": p.bool}),
    OwnershipTransferred: event("0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0", "OwnershipTransferred(address,address)", {"previousOwner": indexed(p.address), "newOwner": indexed(p.address)}),
    SaleExecuted: event("0x60051bb1ba3acfd8b3e006709f0ea1db9ce1e6d93870dd0bb514b1c6a54099aa", "SaleExecuted(uint256,address,uint256,uint256,uint256,uint256,uint256,bytes4,address)", {"saleID": indexed(p.uint256), "tokenContractAddress": indexed(p.address), "tokenID": indexed(p.uint256), "tokenAmount": p.uint256, "price": p.uint256, "leftoverTokens": p.uint256, "leftoverPrice": p.uint256, "tokenKind": p.bytes4, "beneficiary": p.address}),
    SaleRegistration_NewSale: event("0x60bee42a5c793b921413765beafbe49105147c97d3750ab5a70849e835ff758b", "SaleRegistration_NewSale(uint256,address,uint256,uint256,bytes4,address,uint256,uint256,address,uint256,uint256)", {"saleID": indexed(p.uint256), "tokenContractAddress": indexed(p.address), "tokenID": indexed(p.uint256), "tokenAmount": p.uint256, "tokenKind": p.bytes4, "tokenOrigin": p.address, "price": p.uint256, "currencyID": p.uint256, "beneficiary": p.address, "startTimestamp": p.uint256, "endTimestamp": p.uint256}),
}

export const functions = {
    getmPlaceFeePercentKageSwap: viewFun("0xaae18ab0", "getmPlaceFeePercentKageSwap()", {}, p.uint256),
    cancelASaleOffer: fun("0xd85c39bf", "cancelASaleOffer(uint256)", {"saleID": p.uint256}, ),
    safeRegister721DirectSale_User: fun("0x22fdb2c6", "safeRegister721DirectSale_User(uint256,address,uint256,uint256,uint256,uint256)", {"tokenID": p.uint256, "tokenContractAddress": p.address, "price": p.uint256, "currencyID": p.uint256, "startTimestamp": p.uint256, "endTimestamp": p.uint256}, ),
    safeRegister1155DirectSale_User: fun("0x9dbf8c30", "safeRegister1155DirectSale_User(uint256,address,uint256,uint256,uint256,uint256,uint256)", {"tokenID": p.uint256, "tokenContractAddress": p.address, "price": p.uint256, "amount": p.uint256, "currencyID": p.uint256, "startTimestamp": p.uint256, "endTimestamp": p.uint256}, ),
    getGBMFeePercentKageSwap: viewFun("0x956a7471", "getGBMFeePercentKageSwap()", {}, p.uint256),
    getSaleToSwapee: viewFun("0x142d201d", "getSaleToSwapee(uint256)", {"saleID": p.uint256}, p.address),
    getSale_Price: viewFun("0x2ba7203a", "getSale_Price(uint256)", {"saleID": p.uint256}, p.uint256),
    executeSwap: fun("0xa9ab232b", "executeSwap(uint256)", {"saleID": p.uint256}, ),
    cancelSwap: fun("0x54d6a2b7", "cancelSwap(uint256)", {"saleID": p.uint256}, ),
    safeRegister721Swap: fun("0x053b3dbe", "safeRegister721Swap(uint256,address,uint256,uint256,uint256,uint256,address)", {"tokenID": p.uint256, "tokenContractAddress": p.address, "price": p.uint256, "currencyID": p.uint256, "startTimestamp": p.uint256, "endTimestamp": p.uint256, "swapee": p.address}, ),
    getIsSaleSecondary: viewFun("0x9000422f", "getIsSaleSecondary(uint256)", {"saleID": p.uint256}, p.bool),
    'safeRegister1155auctionBatch_User(uint256[],uint256[],address,uint256,uint256,uint256,bytes)': fun("0x27068379", "safeRegister1155auctionBatch_User(uint256[],uint256[],address,uint256,uint256,uint256,bytes)", {"tokenIDs": p.array(p.uint256), "amounts": p.array(p.uint256), "tokenContractAddress": p.address, "gbmPreset": p.uint256, "startTimestamp": p.uint256, "currencyID": p.uint256, "authorisation": p.bytes}, ),
    'safeRegister1155auction_User(uint256,address,uint256,uint256,uint256,uint256,bytes)': fun("0x6de52f0f", "safeRegister1155auction_User(uint256,address,uint256,uint256,uint256,uint256,bytes)", {"tokenID": p.uint256, "tokenContractAddress": p.address, "amount": p.uint256, "gbmPreset": p.uint256, "startTimestamp": p.uint256, "currencyID": p.uint256, "authorisation": p.bytes}, ),
    'safeRegister1155auction_User_Custom(uint256,address,uint256,uint256,uint256,uint256,uint256,uint256,bytes)': fun("0x2216beef", "safeRegister1155auction_User_Custom(uint256,address,uint256,uint256,uint256,uint256,uint256,uint256,bytes)", {"tokenID": p.uint256, "tokenContractAddress": p.address, "amount": p.uint256, "gbmPreset": p.uint256, "startTimestamp": p.uint256, "currencyID": p.uint256, "endTimestamp": p.uint256, "startingBid": p.uint256, "authorisation": p.bytes}, ),
    'safeRegister721AuctionBatch_User(uint256[],address,uint256,uint256,uint256,bytes)': fun("0x0c2f309c", "safeRegister721AuctionBatch_User(uint256[],address,uint256,uint256,uint256,bytes)", {"tokenIDs": p.array(p.uint256), "tokenContractAddress": p.address, "gbmPreset": p.uint256, "startTimestamp": p.uint256, "currencyID": p.uint256, "authorisation": p.bytes}, ),
    'safeRegister721AuctionBatch_User_Custom(uint256[],address,uint256,uint256,uint256,uint256,uint256,bytes)': fun("0xc720ea37", "safeRegister721AuctionBatch_User_Custom(uint256[],address,uint256,uint256,uint256,uint256,uint256,bytes)", {"tokenIDs": p.array(p.uint256), "tokenContractAddress": p.address, "gbmPreset": p.uint256, "startTimestamp": p.uint256, "currencyID": p.uint256, "endTimestamp": p.uint256, "startingBid": p.uint256, "authorisation": p.bytes}, ),
    'safeRegister721Auction_User(uint256,address,uint256,uint256,uint256,bytes)': fun("0xee09abbc", "safeRegister721Auction_User(uint256,address,uint256,uint256,uint256,bytes)", {"tokenID": p.uint256, "tokenContractAddress": p.address, "gbmPreset": p.uint256, "startTimestamp": p.uint256, "currencyID": p.uint256, "authorisation": p.bytes}, ),
    'safeRegister721Auction_User_Custom(uint256,address,uint256,uint256,uint256,uint256,uint256,bytes)': fun("0x41f2bfce", "safeRegister721Auction_User_Custom(uint256,address,uint256,uint256,uint256,uint256,uint256,bytes)", {"tokenID": p.uint256, "tokenContractAddress": p.address, "gbmPreset": p.uint256, "startTimestamp": p.uint256, "currencyID": p.uint256, "endTimestamp": p.uint256, "startingBid": p.uint256, "authorisation": p.bytes}, ),
    startTrackingNFT: fun("0xf20d6788", "startTrackingNFT(address,bytes4)", {"contractAddress": p.address, "contractStandard": p.bytes4}, ),
    setTokenSaleTierConfig: fun("0x67fbe330", "setTokenSaleTierConfig(address,uint256)", {"STELLA_dualFarmContract": p.address, "STELLA_pId": p.uint256}, ),
    'bid(uint256,uint256,uint256)': fun("0x2ac9bf09", "bid(uint256,uint256,uint256)", {"auctionID": p.uint256, "newBidAmount": p.uint256, "previousHighestBidAmount": p.uint256}, ),
    'bid(uint256,uint256,uint256,bytes)': fun("0x4d5773d6", "bid(uint256,uint256,uint256,bytes)", {"auctionID": p.uint256, "newBidAmount": p.uint256, "previousHighestBidAmount": p.uint256, "authorisation": p.bytes}, ),
    buyASaleOffer: fun("0xd6583c35", "buyASaleOffer(uint256)", {"saleID": p.uint256}, ),
    buyASaleOfferPartial: fun("0x0d8be0ab", "buyASaleOfferPartial(uint256,uint256)", {"saleID": p.uint256, "amount": p.uint256}, ),
    cancelAuction: fun("0x96b5a755", "cancelAuction(uint256)", {"auctionID": p.uint256}, ),
    claim: fun("0x379607f5", "claim(uint256)", {"auctionID": p.uint256}, ),
    diamondCut: fun("0x1f931c1c", "diamondCut((address,uint8,bytes4[])[],address,bytes)", {"_diamondCut": p.array(p.struct({"facetAddress": p.address, "action": p.uint8, "functionSelectors": p.array(p.bytes4)})), "_init": p.address, "_calldata": p.bytes}, ),
    facetAddress: viewFun("0xcdffacc6", "facetAddress(bytes4)", {"_functionSelector": p.bytes4}, p.address),
    facetAddresses: viewFun("0x52ef6b2c", "facetAddresses()", {}, p.array(p.address)),
    facetFunctionSelectors: viewFun("0xadfca15e", "facetFunctionSelectors(address)", {"_facet": p.address}, p.array(p.bytes4)),
    facets: viewFun("0x7a0ed627", "facets()", {}, p.array(p.struct({"facetAddress": p.address, "functionSelectors": p.array(p.bytes4)}))),
    getCurrencyAddress: viewFun("0x8db0599d", "getCurrencyAddress(uint256)", {"currencyIndex": p.uint256}, p.address),
    getCurrencyName: viewFun("0xe04ecd93", "getCurrencyName(uint256)", {"currencyIndex": p.uint256}, p.string),
    getDefaultCurrency: viewFun("0x046c7251", "getDefaultCurrency()", {}, p.uint256),
    getERC1155Token_UnderSaleByDepositor: viewFun("0xe1b2088f", "getERC1155Token_UnderSaleByDepositor(address,uint256,address)", {"tokenAddress": p.address, "tokenID": p.uint256, "depositor": p.address}, p.uint256),
    getERC1155Token_depositor: viewFun("0x46578ac5", "getERC1155Token_depositor(address,uint256,address)", {"tokenAddress": p.address, "tokenID": p.uint256, "depositor": p.address}, p.uint256),
    getERC721Token_depositor: viewFun("0xce6fe8e2", "getERC721Token_depositor(address,uint256)", {"tokenAddress": p.address, "tokenID": p.uint256}, p.address),
    getERC721Token_underSale: viewFun("0x377ac648", "getERC721Token_underSale(address,uint256)", {"tokenAddress": p.address, "tokenID": p.uint256}, p.bool),
    getGBMAdmin: viewFun("0x2e014908", "getGBMAdmin()", {}, p.address),
    getGBMFeePercentKage: viewFun("0x14568628", "getGBMFeePercentKage()", {}, p.uint256),
    getGBMFeesAccount: viewFun("0xd9805b1c", "getGBMFeesAccount()", {}, p.address),
    getGBMFeePercentKageEnglish: viewFun("0xfdad5ad1", "getGBMFeePercentKageEnglish()", {}, p.uint256),
    getOverrideSecondaryFee: viewFun("0x2548fe48", "getOverrideSecondaryFee()", {}, p.bool),
    getGBMFeePercentKageSecondary: viewFun("0x3bc453d4", "getGBMFeePercentKageSecondary()", {}, p.uint256),
    getGBMFeePercentKageEnglishSecondary: viewFun("0x021755d0", "getGBMFeePercentKageEnglishSecondary()", {}, p.uint256),
    getGBMFeePercentKageDirectSaleSecondary: viewFun("0x75b86e91", "getGBMFeePercentKageDirectSaleSecondary()", {}, p.uint256),
    getMPlaceGBMFeePercentKageSecondary: viewFun("0x1d07ca7e", "getMPlaceGBMFeePercentKageSecondary()", {}, p.uint256),
    getMPlaceEnglishFeePercentKageSecondary: viewFun("0x53b47a18", "getMPlaceEnglishFeePercentKageSecondary()", {}, p.uint256),
    getMPlaceDirectFeePercentKageSecondary: viewFun("0x441d8c48", "getMPlaceDirectFeePercentKageSecondary()", {}, p.uint256),
    setSecondarySeparateLicenseFees: fun("0x287eb04d", "setSecondarySeparateLicenseFees(bool,uint256,uint256,uint256,uint256,uint256,uint256)", {"overrideSecondaryFee": p.bool, "GBMFeePercentKageSecondary": p.uint256, "GBMFeePercentKageDirectSaleSecondary": p.uint256, "GBMFeePercentKageEnglishSecondary": p.uint256, "mPlaceGBMFeePercentKageSecondary": p.uint256, "mPlaceEnglishFeePercentKageSecondary": p.uint256, "mPlaceDirectFeePercentKageSecondary": p.uint256}, ),
    getGBMFeePercentKageDirectSale: viewFun("0x13c86c3d", "getGBMFeePercentKageDirectSale()", {}, p.uint256),
    setDSandENG_GBMLicenseFees: fun("0xc9b12a24", "setDSandENG_GBMLicenseFees(uint256,uint256)", {"GBMFeePercentKageDirectSale": p.uint256, "GBMFeePercentKageEnglish": p.uint256}, ),
    setPrimarySaleBeneficiaryOverride: fun("0xbddf82fc", "setPrimarySaleBeneficiaryOverride(address)", {"primarySaleBeneficiaryOverride": p.address}, ),
    getPrimarySaleBeneficiaryOverride: viewFun("0x11470577", "getPrimarySaleBeneficiaryOverride()", {}, p.address),
    getGBMPreset: viewFun("0x0b1be45c", "getGBMPreset(uint256)", {"index": p.uint256}, p.struct({"auctionDuration": p.uint256, "hammerTimeDuration": p.uint256, "cancellationPeriodDuration": p.uint256, "stepMin": p.uint256, "incentiveMin": p.uint256, "incentiveMax": p.uint256, "incentiveGrowthMultiplier": p.uint256, "firstMinBid": p.uint256})),
    getGBMPresetDefault: viewFun("0xe9fc05b6", "getGBMPresetDefault()", {}, p.uint256),
    getGBMPreset_AuctionDuration: viewFun("0xd70fe364", "getGBMPreset_AuctionDuration(uint256)", {"index": p.uint256}, p.uint256),
    getGBMPreset_CancellationPeriodDuration: viewFun("0xd57c9902", "getGBMPreset_CancellationPeriodDuration(uint256)", {"index": p.uint256}, p.uint256),
    getGBMPreset_HammerTimeDuration: viewFun("0x00a84804", "getGBMPreset_HammerTimeDuration(uint256)", {"index": p.uint256}, p.uint256),
    getGBMPreset_IncentiveGrowthMultiplier: viewFun("0x8a60a062", "getGBMPreset_IncentiveGrowthMultiplier(uint256)", {"index": p.uint256}, p.uint256),
    getGBMPreset_IncentiveMax: viewFun("0x9d9583af", "getGBMPreset_IncentiveMax(uint256)", {"index": p.uint256}, p.uint256),
    getGBMPreset_IncentiveMin: viewFun("0x9ac344f1", "getGBMPreset_IncentiveMin(uint256)", {"index": p.uint256}, p.uint256),
    getGBMPreset_Name: viewFun("0x4800f547", "getGBMPreset_Name(uint256)", {"index": p.uint256}, p.string),
    getGBMPreset_StepMin: viewFun("0x8e32f4d0", "getGBMPreset_StepMin(uint256)", {"index": p.uint256}, p.uint256),
    getGBMPresetsAmount: viewFun("0x03f44d6f", "getGBMPresetsAmount()", {}, p.uint256),
    getIsLicensePaidOnChain: viewFun("0x1821c894", "getIsLicensePaidOnChain()", {}, p.bool),
    getMarketPlaceRoyalty: viewFun("0x66e578cc", "getMarketPlaceRoyalty()", {}, p.address),
    getNFTContractIsWhitelisted: viewFun("0xd886282a", "getNFTContractIsWhitelisted(address)", {"NFTContract": p.address}, p.bool),
    getSale_Beneficiary: viewFun("0xca95c79e", "getSale_Beneficiary(uint256)", {"saleID": p.uint256}, p.address),
    getSale_Bid_Bidder: viewFun("0xecfc20f0", "getSale_Bid_Bidder(uint256,uint256)", {"saleID": p.uint256, "bidIndex": p.uint256}, p.address),
    getSale_Bid_CurrencyIndex: viewFun("0x56788cac", "getSale_Bid_CurrencyIndex(uint256,uint256)", {"saleID": p.uint256, "_1": p.uint256}, p.uint256),
    getSale_Bid_Currency_Address: viewFun("0x9d4600c9", "getSale_Bid_Currency_Address(uint256,uint256)", {"saleID": p.uint256, "bidIndex": p.uint256}, p.address),
    getSale_Bid_Currency_Name: viewFun("0x6156dced", "getSale_Bid_Currency_Name(uint256,uint256)", {"saleID": p.uint256, "bidIndex": p.uint256}, p.string),
    getSale_Bid_Incentive: viewFun("0x1947f553", "getSale_Bid_Incentive(uint256,uint256)", {"saleID": p.uint256, "bidIndex": p.uint256}, p.uint256),
    getSale_Bid_Timestamp: viewFun("0xe53e7d2f", "getSale_Bid_Timestamp(uint256,uint256)", {"saleID": p.uint256, "bidIndex": p.uint256}, p.uint256),
    getSale_Bid_Value: viewFun("0x62936d0c", "getSale_Bid_Value(uint256,uint256)", {"saleID": p.uint256, "bidIndex": p.uint256}, p.uint256),
    getSale_Claimed: viewFun("0xf5277620", "getSale_Claimed(uint256)", {"saleID": p.uint256}, p.bool),
    getSale_CurrencyID: viewFun("0x728c803e", "getSale_CurrencyID(uint256)", {"saleID": p.uint256}, p.uint256),
    getSale_Currency_Address: viewFun("0xf7803f81", "getSale_Currency_Address(uint256)", {"saleID": p.uint256}, p.address),
    getSale_Currency_Name: viewFun("0x7de7cd13", "getSale_Currency_Name(uint256)", {"saleID": p.uint256}, p.string),
    getSale_Debt: viewFun("0xe5f3d125", "getSale_Debt(uint256)", {"saleID": p.uint256}, p.uint256),
    getSale_EarliestID: viewFun("0xdd5d7133", "getSale_EarliestID()", {}, p.uint256),
    getSale_EndTimestamp: viewFun("0x4d5f98de", "getSale_EndTimestamp(uint256)", {"saleID": p.uint256}, p.uint256),
    getSale_GBMPreset: viewFun("0xff218fb1", "getSale_GBMPreset(uint256)", {"saleID": p.uint256}, p.struct({"auctionDuration": p.uint256, "hammerTimeDuration": p.uint256, "cancellationPeriodDuration": p.uint256, "stepMin": p.uint256, "incentiveMin": p.uint256, "incentiveMax": p.uint256, "incentiveGrowthMultiplier": p.uint256, "firstMinBid": p.uint256})),
    getSale_GBMPresetIndex: viewFun("0xc0bb8fcb", "getSale_GBMPresetIndex(uint256)", {"saleID": p.uint256}, p.uint256),
    getSale_GBMPreset_AuctionDuration: viewFun("0x9e807787", "getSale_GBMPreset_AuctionDuration(uint256)", {"saleID": p.uint256}, p.uint256),
    getSale_GBMPreset_CancellationPeriodDuration: viewFun("0xcdd0e56c", "getSale_GBMPreset_CancellationPeriodDuration(uint256)", {"saleID": p.uint256}, p.uint256),
    getSale_GBMPreset_HammerTimeDuration: viewFun("0x7b0c3caf", "getSale_GBMPreset_HammerTimeDuration(uint256)", {"saleID": p.uint256}, p.uint256),
    getSale_GBMPreset_IncentiveGrowthMultiplier: viewFun("0xff8efe31", "getSale_GBMPreset_IncentiveGrowthMultiplier(uint256)", {"saleID": p.uint256}, p.uint256),
    getSale_GBMPreset_IncentiveMax: viewFun("0x8bb8371b", "getSale_GBMPreset_IncentiveMax(uint256)", {"saleID": p.uint256}, p.uint256),
    getSale_GBMPreset_IncentiveMin: viewFun("0xc6bf2842", "getSale_GBMPreset_IncentiveMin(uint256)", {"saleID": p.uint256}, p.uint256),
    getSale_GBMPreset_StepMin: viewFun("0xef50d97b", "getSale_GBMPreset_StepMin(uint256)", {"saleID": p.uint256}, p.uint256),
    getSale_HighestBid_Bidder: viewFun("0x2f4b8887", "getSale_HighestBid_Bidder(uint256)", {"saleID": p.uint256}, p.address),
    getSale_HighestBid_CurrencyIndex: viewFun("0x11998c2a", "getSale_HighestBid_CurrencyIndex(uint256)", {"saleID": p.uint256}, p.uint256),
    getSale_HighestBid_Currency_Address: viewFun("0x7bfb88f4", "getSale_HighestBid_Currency_Address(uint256)", {"saleID": p.uint256}, p.address),
    getSale_HighestBid_Currency_Name: viewFun("0x24ffa865", "getSale_HighestBid_Currency_Name(uint256)", {"saleID": p.uint256}, p.string),
    getSale_HighestBid_Incentive: viewFun("0xab6e6653", "getSale_HighestBid_Incentive(uint256)", {"saleID": p.uint256}, p.uint256),
    getSale_HighestBid_Value: viewFun("0x9f6dc112", "getSale_HighestBid_Value(uint256)", {"saleID": p.uint256}, p.uint256),
    getSale_LatestID: viewFun("0x0db7e681", "getSale_LatestID()", {}, p.uint256),
    getSale_NumberOfBids: viewFun("0xce323dca", "getSale_NumberOfBids(uint256)", {"saleID": p.uint256}, p.uint256),
    getSale_SaleKind: viewFun("0xcd23379c", "getSale_SaleKind(uint256)", {"saleID": p.uint256}, p.bytes4),
    getSale_StartTimestamp: viewFun("0xa4124820", "getSale_StartTimestamp(uint256)", {"saleID": p.uint256}, p.uint256),
    getSale_StartingBid: viewFun("0x47f0dfa2", "getSale_StartingBid(uint256)", {"saleID": p.uint256}, p.uint256),
    getSale_TokenAddress: viewFun("0x2e854578", "getSale_TokenAddress(uint256)", {"saleID": p.uint256}, p.address),
    getSale_TokenAmount: viewFun("0x07d0c51a", "getSale_TokenAmount(uint256)", {"saleID": p.uint256}, p.uint256),
    getSale_TokenID: viewFun("0x6fb46bf6", "getSale_TokenID(uint256)", {"saleID": p.uint256}, p.uint256),
    getSale_TokenKind: viewFun("0x1e625df6", "getSale_TokenKind(uint256)", {"saleID": p.uint256}, p.bytes4),
    getSale_TokenOrigin: viewFun("0xeb06d11f", "getSale_TokenOrigin(uint256)", {"saleID": p.uint256}, p.address),
    getSmartContractsUsersNativeCurrencyBalance: viewFun("0x21b9959a", "getSmartContractsUsersNativeCurrencyBalance(address)", {"smartContract": p.address}, p.uint256),
    getTotalNumberOfSales: viewFun("0x23a9de7c", "getTotalNumberOfSales()", {}, p.uint256),
    getWhitelistCounterSigner: viewFun("0x288318d0", "getWhitelistCounterSigner()", {}, p.address),
    getmPlaceDirectSaleFeePercentKage: viewFun("0x7195eed7", "getmPlaceDirectSaleFeePercentKage()", {}, p.uint256),
    getmPlaceEnglishFeePercentKage: viewFun("0x3548ac22", "getmPlaceEnglishFeePercentKage()", {}, p.uint256),
    getmPlaceGBMFeePercentKage: viewFun("0x253a3c38", "getmPlaceGBMFeePercentKage()", {}, p.uint256),
    getpercentKage: viewFun("0x38c86c5d", "getpercentKage()", {}, p.uint256),
    onERC1155BatchReceived: fun("0xbc197c81", "onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)", {"_operator": p.address, "_from": p.address, "_ids": p.array(p.uint256), "_values": p.array(p.uint256), "_data": p.bytes}, p.bytes4),
    onERC1155Received: fun("0xf23a6e61", "onERC1155Received(address,address,uint256,uint256,bytes)", {"_operator": p.address, "_from": p.address, "_id": p.uint256, "_value": p.uint256, "_data": p.bytes}, p.bytes4),
    onERC721Received: fun("0x150b7a02", "onERC721Received(address,address,uint256,bytes)", {"_operator": p.address, "_from": p.address, "_tokenId": p.uint256, "_data": p.bytes}, p.bytes4),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    registerLazyBatch721Auction: fun("0x9e94139e", "registerLazyBatch721Auction(address,uint256,uint256,uint256,uint256,uint256,uint256,uint256)", {"tokenContractAddress": p.address, "gbmPreset": p.uint256, "startTimestamp": p.uint256, "currencyID": p.uint256, "endTimestamp": p.uint256, "startingBid": p.uint256, "startingAuctionId": p.uint256, "endingAuctionId": p.uint256}, ),
    safeRegister1155DirectSale: fun("0xb7bf3ac0", "safeRegister1155DirectSale(uint256,address,uint256,uint256,uint256,uint256,uint256)", {"tokenID": p.uint256, "tokenContractAddress": p.address, "price": p.uint256, "amount": p.uint256, "currencyID": p.uint256, "startTimestamp": p.uint256, "endTimestamp": p.uint256}, ),
    safeRegister1155DirectSale_Batch: fun("0x7d5496b8", "safeRegister1155DirectSale_Batch(uint256[],address,uint256,uint256[],uint256,uint256,uint256)", {"tokenIDs": p.array(p.uint256), "tokenContractAddress": p.address, "price": p.uint256, "amounts": p.array(p.uint256), "currencyID": p.uint256, "startTimestamp": p.uint256, "endTimestamp": p.uint256}, ),
    safeRegister1155auction: fun("0x65aae6fc", "safeRegister1155auction(uint256,address,uint256,uint256,uint256,uint256,address)", {"tokenID": p.uint256, "tokenContractAddress": p.address, "amount": p.uint256, "gbmPreset": p.uint256, "startTimestamp": p.uint256, "currencyID": p.uint256, "beneficiary": p.address}, ),
    safeRegister1155auctionBatch: fun("0xb73f1376", "safeRegister1155auctionBatch(uint256[],uint256[],address,uint256,uint256,uint256,address)", {"tokenIDs": p.array(p.uint256), "amounts": p.array(p.uint256), "tokenContractAddress": p.address, "gbmPreset": p.uint256, "startTimestamp": p.uint256, "currencyID": p.uint256, "beneficiary": p.address}, ),
    safeRegister1155auctionBatch_Custom: fun("0x12e2a60b", "safeRegister1155auctionBatch_Custom(uint256[],uint256[],address,uint256,uint256,uint256,address,uint256,uint256)", {"tokenIDs": p.array(p.uint256), "amounts": p.array(p.uint256), "tokenContractAddress": p.address, "gbmPreset": p.uint256, "startTimestamp": p.uint256, "currencyID": p.uint256, "beneficiary": p.address, "endTimestamp": p.uint256, "startingBid": p.uint256}, ),
    'safeRegister1155auctionBatch_User(uint256[],uint256[],address,uint256,uint256,uint256)': fun("0xd55942f2", "safeRegister1155auctionBatch_User(uint256[],uint256[],address,uint256,uint256,uint256)", {"tokenIDs": p.array(p.uint256), "amounts": p.array(p.uint256), "tokenContractAddress": p.address, "gbmPreset": p.uint256, "startTimestamp": p.uint256, "currencyID": p.uint256}, ),
    safeRegister1155auctionBatch_User_Custom: fun("0x67be7a99", "safeRegister1155auctionBatch_User_Custom(uint256[],uint256[],address,uint256,uint256,uint256,uint256,uint256)", {"tokenIDs": p.array(p.uint256), "amounts": p.array(p.uint256), "tokenContractAddress": p.address, "gbmPreset": p.uint256, "startTimestamp": p.uint256, "currencyID": p.uint256, "endTimestamp": p.uint256, "startingBid": p.uint256}, ),
    safeRegister1155auction_Custom: fun("0xb72c1b5e", "safeRegister1155auction_Custom(uint256,address,uint256,uint256,uint256,uint256,address,uint256,uint256)", {"tokenID": p.uint256, "tokenContractAddress": p.address, "amount": p.uint256, "gbmPreset": p.uint256, "startTimestamp": p.uint256, "currencyID": p.uint256, "beneficiary": p.address, "endTimestamp": p.uint256, "startingBid": p.uint256}, ),
    'safeRegister1155auction_User(uint256,address,uint256,uint256,uint256,uint256)': fun("0xdb852eab", "safeRegister1155auction_User(uint256,address,uint256,uint256,uint256,uint256)", {"tokenID": p.uint256, "tokenContractAddress": p.address, "amount": p.uint256, "gbmPreset": p.uint256, "startTimestamp": p.uint256, "currencyID": p.uint256}, ),
    'safeRegister1155auction_User_Custom(uint256,address,uint256,uint256,uint256,uint256,uint256,uint256)': fun("0x4cc286dc", "safeRegister1155auction_User_Custom(uint256,address,uint256,uint256,uint256,uint256,uint256,uint256)", {"tokenID": p.uint256, "tokenContractAddress": p.address, "amount": p.uint256, "gbmPreset": p.uint256, "startTimestamp": p.uint256, "currencyID": p.uint256, "endTimestamp": p.uint256, "startingBid": p.uint256}, ),
    safeRegister721Auction: fun("0x4207fd66", "safeRegister721Auction(uint256,address,uint256,uint256,uint256,address)", {"tokenID": p.uint256, "tokenContractAddress": p.address, "gbmPreset": p.uint256, "startTimestamp": p.uint256, "currencyID": p.uint256, "beneficiary": p.address}, ),
    safeRegister721AuctionBatch: fun("0xc9fc4262", "safeRegister721AuctionBatch(uint256[],address,uint256,uint256,uint256,address)", {"tokenIDs": p.array(p.uint256), "tokenContractAddress": p.address, "gbmPreset": p.uint256, "startTimestamp": p.uint256, "currencyID": p.uint256, "beneficiary": p.address}, ),
    safeRegister721AuctionBatch_Custom: fun("0xad9de813", "safeRegister721AuctionBatch_Custom(uint256[],address,uint256,uint256,uint256,address,uint256,uint256)", {"tokenIDs": p.array(p.uint256), "tokenContractAddress": p.address, "gbmPreset": p.uint256, "startTimestamp": p.uint256, "currencyID": p.uint256, "beneficiary": p.address, "endTimestamp": p.uint256, "startingBid": p.uint256}, ),
    'safeRegister721AuctionBatch_User(uint256[],address,uint256,uint256,uint256)': fun("0x5d404952", "safeRegister721AuctionBatch_User(uint256[],address,uint256,uint256,uint256)", {"tokenIDs": p.array(p.uint256), "tokenContractAddress": p.address, "gbmPreset": p.uint256, "startTimestamp": p.uint256, "currencyID": p.uint256}, ),
    'safeRegister721AuctionBatch_User_Custom(uint256[],address,uint256,uint256,uint256,uint256,uint256)': fun("0x7ef40db1", "safeRegister721AuctionBatch_User_Custom(uint256[],address,uint256,uint256,uint256,uint256,uint256)", {"tokenIDs": p.array(p.uint256), "tokenContractAddress": p.address, "gbmPreset": p.uint256, "startTimestamp": p.uint256, "currencyID": p.uint256, "endTimestamp": p.uint256, "startingBid": p.uint256}, ),
    safeRegister721Auction_Custom: fun("0x5cf5bfd4", "safeRegister721Auction_Custom(uint256,address,uint256,uint256,uint256,address,uint256,uint256)", {"tokenID": p.uint256, "tokenContractAddress": p.address, "gbmPreset": p.uint256, "startTimestamp": p.uint256, "currencyID": p.uint256, "beneficiary": p.address, "endTimestamp": p.uint256, "startingBid": p.uint256}, ),
    'safeRegister721Auction_User(uint256,address,uint256,uint256,uint256)': fun("0x90f2d4e0", "safeRegister721Auction_User(uint256,address,uint256,uint256,uint256)", {"tokenID": p.uint256, "tokenContractAddress": p.address, "gbmPreset": p.uint256, "startTimestamp": p.uint256, "currencyID": p.uint256}, ),
    'safeRegister721Auction_User_Custom(uint256,address,uint256,uint256,uint256,uint256,uint256)': fun("0x8ec5897d", "safeRegister721Auction_User_Custom(uint256,address,uint256,uint256,uint256,uint256,uint256)", {"tokenID": p.uint256, "tokenContractAddress": p.address, "gbmPreset": p.uint256, "startTimestamp": p.uint256, "currencyID": p.uint256, "endTimestamp": p.uint256, "startingBid": p.uint256}, ),
    safeRegister721DirectSale: fun("0xdc92bf1b", "safeRegister721DirectSale(uint256,address,uint256,uint256,uint256,uint256)", {"tokenID": p.uint256, "tokenContractAddress": p.address, "price": p.uint256, "currencyID": p.uint256, "startTimestamp": p.uint256, "endTimestamp": p.uint256}, ),
    safeRegister721DirectSale_Batch: fun("0x3bb18e28", "safeRegister721DirectSale_Batch(uint256[],address,uint256,uint256,uint256,uint256)", {"tokenIDs": p.array(p.uint256), "tokenContractAddress": p.address, "price": p.uint256, "currencyID": p.uint256, "startTimestamp": p.uint256, "endTimestamp": p.uint256}, ),
    setCurrencyAddress: fun("0xc39686dc", "setCurrencyAddress(uint256,address)", {"currencyIndex": p.uint256, "currencyAddress": p.address}, ),
    setCurrencyAddressAndName: fun("0xb3923679", "setCurrencyAddressAndName(uint256,address,string)", {"currencyIndex": p.uint256, "currencyAddress": p.address, "currencyName": p.string}, ),
    setCurrencyName: fun("0x08750151", "setCurrencyName(uint256,string)", {"currencyIndex": p.uint256, "currencyName": p.string}, ),
    setDefaultCurrency: fun("0x649fcee7", "setDefaultCurrency(uint256)", {"currencyIndex": p.uint256}, ),
    setDefaultGBMPreset: fun("0x57918727", "setDefaultGBMPreset(uint256)", {"presetIndex": p.uint256}, ),
    setGBMAdmin: fun("0x8b2a4a11", "setGBMAdmin(address)", {"GBMAdmin": p.address}, ),
    setGBMPreset: fun("0xb462c242", "setGBMPreset(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,string)", {"presetIndex": p.uint256, "auctionDuration": p.uint256, "hammerTimeDuration": p.uint256, "cancellationPeriodDuration": p.uint256, "stepMin": p.uint256, "incentiveMin": p.uint256, "incentiveMax": p.uint256, "incentiveGrowthMultiplier": p.uint256, "firstMinBid": p.uint256, "presetName": p.string}, ),
    setMarketPlaceFeesStructure: fun("0x18513454", "setMarketPlaceFeesStructure(address,bool,uint256,address,uint256,uint256,uint256)", {"licensePaidTo": p.address, "licensePaidOnChain": p.bool, "GBMFeePercentKage": p.uint256, "marketplaceFeeCollectorWallet": p.address, "mPlaceDirectFeePercentKage": p.uint256, "mPlaceEnglishFeePercentKage": p.uint256, "mPlaceGBMFeePercentKage": p.uint256}, ),
    setNFTContractIsWhitelisted: fun("0xd24412c1", "setNFTContractIsWhitelisted(address,bool,bytes4)", {"NFTContract": p.address, "isWhitelistedForSale": p.bool, "tokenKind": p.bytes4}, ),
    setWhitelistCounterSigner: fun("0x91ef973e", "setWhitelistCounterSigner(address)", {"whitelistCounterSigner": p.address}, ),
    supportsInterface: viewFun("0x01ffc9a7", "supportsInterface(bytes4)", {"interfaceID": p.bytes4}, p.bool),
    transferOwnership: fun("0xf2fde38b", "transferOwnership(address)", {"_newOwner": p.address}, ),
    withdraw: fun("0x3ccfd60b", "withdraw()", {}, ),
    setSaleClaimedFlag: fun("0xe27893b8", "setSaleClaimedFlag(uint256,bool)", {"saleID": p.uint256, "flag": p.bool}, ),
    setSaleClaimedFlag_Batch: fun("0x2e6a9da4", "setSaleClaimedFlag_Batch(uint256[],bool)", {"saleIDs": p.array(p.uint256), "flag": p.bool}, ),
}

export class Contract extends ContractBase {

    getmPlaceFeePercentKageSwap() {
        return this.eth_call(functions.getmPlaceFeePercentKageSwap, {})
    }

    getGBMFeePercentKageSwap() {
        return this.eth_call(functions.getGBMFeePercentKageSwap, {})
    }

    getSaleToSwapee(saleID: GetSaleToSwapeeParams["saleID"]) {
        return this.eth_call(functions.getSaleToSwapee, {saleID})
    }

    getSale_Price(saleID: GetSale_PriceParams["saleID"]) {
        return this.eth_call(functions.getSale_Price, {saleID})
    }

    getIsSaleSecondary(saleID: GetIsSaleSecondaryParams["saleID"]) {
        return this.eth_call(functions.getIsSaleSecondary, {saleID})
    }

    facetAddress(_functionSelector: FacetAddressParams["_functionSelector"]) {
        return this.eth_call(functions.facetAddress, {_functionSelector})
    }

    facetAddresses() {
        return this.eth_call(functions.facetAddresses, {})
    }

    facetFunctionSelectors(_facet: FacetFunctionSelectorsParams["_facet"]) {
        return this.eth_call(functions.facetFunctionSelectors, {_facet})
    }

    facets() {
        return this.eth_call(functions.facets, {})
    }

    getCurrencyAddress(currencyIndex: GetCurrencyAddressParams["currencyIndex"]) {
        return this.eth_call(functions.getCurrencyAddress, {currencyIndex})
    }

    getCurrencyName(currencyIndex: GetCurrencyNameParams["currencyIndex"]) {
        return this.eth_call(functions.getCurrencyName, {currencyIndex})
    }

    getDefaultCurrency() {
        return this.eth_call(functions.getDefaultCurrency, {})
    }

    getERC1155Token_UnderSaleByDepositor(tokenAddress: GetERC1155Token_UnderSaleByDepositorParams["tokenAddress"], tokenID: GetERC1155Token_UnderSaleByDepositorParams["tokenID"], depositor: GetERC1155Token_UnderSaleByDepositorParams["depositor"]) {
        return this.eth_call(functions.getERC1155Token_UnderSaleByDepositor, {tokenAddress, tokenID, depositor})
    }

    getERC1155Token_depositor(tokenAddress: GetERC1155Token_depositorParams["tokenAddress"], tokenID: GetERC1155Token_depositorParams["tokenID"], depositor: GetERC1155Token_depositorParams["depositor"]) {
        return this.eth_call(functions.getERC1155Token_depositor, {tokenAddress, tokenID, depositor})
    }

    getERC721Token_depositor(tokenAddress: GetERC721Token_depositorParams["tokenAddress"], tokenID: GetERC721Token_depositorParams["tokenID"]) {
        return this.eth_call(functions.getERC721Token_depositor, {tokenAddress, tokenID})
    }

    getERC721Token_underSale(tokenAddress: GetERC721Token_underSaleParams["tokenAddress"], tokenID: GetERC721Token_underSaleParams["tokenID"]) {
        return this.eth_call(functions.getERC721Token_underSale, {tokenAddress, tokenID})
    }

    getGBMAdmin() {
        return this.eth_call(functions.getGBMAdmin, {})
    }

    getGBMFeePercentKage() {
        return this.eth_call(functions.getGBMFeePercentKage, {})
    }

    getGBMFeesAccount() {
        return this.eth_call(functions.getGBMFeesAccount, {})
    }

    getGBMFeePercentKageEnglish() {
        return this.eth_call(functions.getGBMFeePercentKageEnglish, {})
    }

    getOverrideSecondaryFee() {
        return this.eth_call(functions.getOverrideSecondaryFee, {})
    }

    getGBMFeePercentKageSecondary() {
        return this.eth_call(functions.getGBMFeePercentKageSecondary, {})
    }

    getGBMFeePercentKageEnglishSecondary() {
        return this.eth_call(functions.getGBMFeePercentKageEnglishSecondary, {})
    }

    getGBMFeePercentKageDirectSaleSecondary() {
        return this.eth_call(functions.getGBMFeePercentKageDirectSaleSecondary, {})
    }

    getMPlaceGBMFeePercentKageSecondary() {
        return this.eth_call(functions.getMPlaceGBMFeePercentKageSecondary, {})
    }

    getMPlaceEnglishFeePercentKageSecondary() {
        return this.eth_call(functions.getMPlaceEnglishFeePercentKageSecondary, {})
    }

    getMPlaceDirectFeePercentKageSecondary() {
        return this.eth_call(functions.getMPlaceDirectFeePercentKageSecondary, {})
    }

    getGBMFeePercentKageDirectSale() {
        return this.eth_call(functions.getGBMFeePercentKageDirectSale, {})
    }

    getPrimarySaleBeneficiaryOverride() {
        return this.eth_call(functions.getPrimarySaleBeneficiaryOverride, {})
    }

    getGBMPreset(index: GetGBMPresetParams["index"]) {
        return this.eth_call(functions.getGBMPreset, {index})
    }

    getGBMPresetDefault() {
        return this.eth_call(functions.getGBMPresetDefault, {})
    }

    getGBMPreset_AuctionDuration(index: GetGBMPreset_AuctionDurationParams["index"]) {
        return this.eth_call(functions.getGBMPreset_AuctionDuration, {index})
    }

    getGBMPreset_CancellationPeriodDuration(index: GetGBMPreset_CancellationPeriodDurationParams["index"]) {
        return this.eth_call(functions.getGBMPreset_CancellationPeriodDuration, {index})
    }

    getGBMPreset_HammerTimeDuration(index: GetGBMPreset_HammerTimeDurationParams["index"]) {
        return this.eth_call(functions.getGBMPreset_HammerTimeDuration, {index})
    }

    getGBMPreset_IncentiveGrowthMultiplier(index: GetGBMPreset_IncentiveGrowthMultiplierParams["index"]) {
        return this.eth_call(functions.getGBMPreset_IncentiveGrowthMultiplier, {index})
    }

    getGBMPreset_IncentiveMax(index: GetGBMPreset_IncentiveMaxParams["index"]) {
        return this.eth_call(functions.getGBMPreset_IncentiveMax, {index})
    }

    getGBMPreset_IncentiveMin(index: GetGBMPreset_IncentiveMinParams["index"]) {
        return this.eth_call(functions.getGBMPreset_IncentiveMin, {index})
    }

    getGBMPreset_Name(index: GetGBMPreset_NameParams["index"]) {
        return this.eth_call(functions.getGBMPreset_Name, {index})
    }

    getGBMPreset_StepMin(index: GetGBMPreset_StepMinParams["index"]) {
        return this.eth_call(functions.getGBMPreset_StepMin, {index})
    }

    getGBMPresetsAmount() {
        return this.eth_call(functions.getGBMPresetsAmount, {})
    }

    getIsLicensePaidOnChain() {
        return this.eth_call(functions.getIsLicensePaidOnChain, {})
    }

    getMarketPlaceRoyalty() {
        return this.eth_call(functions.getMarketPlaceRoyalty, {})
    }

    getNFTContractIsWhitelisted(NFTContract: GetNFTContractIsWhitelistedParams["NFTContract"]) {
        return this.eth_call(functions.getNFTContractIsWhitelisted, {NFTContract})
    }

    getSale_Beneficiary(saleID: GetSale_BeneficiaryParams["saleID"]) {
        return this.eth_call(functions.getSale_Beneficiary, {saleID})
    }

    getSale_Bid_Bidder(saleID: GetSale_Bid_BidderParams["saleID"], bidIndex: GetSale_Bid_BidderParams["bidIndex"]) {
        return this.eth_call(functions.getSale_Bid_Bidder, {saleID, bidIndex})
    }

    getSale_Bid_CurrencyIndex(saleID: GetSale_Bid_CurrencyIndexParams["saleID"], _1: GetSale_Bid_CurrencyIndexParams["_1"]) {
        return this.eth_call(functions.getSale_Bid_CurrencyIndex, {saleID, _1})
    }

    getSale_Bid_Currency_Address(saleID: GetSale_Bid_Currency_AddressParams["saleID"], bidIndex: GetSale_Bid_Currency_AddressParams["bidIndex"]) {
        return this.eth_call(functions.getSale_Bid_Currency_Address, {saleID, bidIndex})
    }

    getSale_Bid_Currency_Name(saleID: GetSale_Bid_Currency_NameParams["saleID"], bidIndex: GetSale_Bid_Currency_NameParams["bidIndex"]) {
        return this.eth_call(functions.getSale_Bid_Currency_Name, {saleID, bidIndex})
    }

    getSale_Bid_Incentive(saleID: GetSale_Bid_IncentiveParams["saleID"], bidIndex: GetSale_Bid_IncentiveParams["bidIndex"]) {
        return this.eth_call(functions.getSale_Bid_Incentive, {saleID, bidIndex})
    }

    getSale_Bid_Timestamp(saleID: GetSale_Bid_TimestampParams["saleID"], bidIndex: GetSale_Bid_TimestampParams["bidIndex"]) {
        return this.eth_call(functions.getSale_Bid_Timestamp, {saleID, bidIndex})
    }

    getSale_Bid_Value(saleID: GetSale_Bid_ValueParams["saleID"], bidIndex: GetSale_Bid_ValueParams["bidIndex"]) {
        return this.eth_call(functions.getSale_Bid_Value, {saleID, bidIndex})
    }

    getSale_Claimed(saleID: GetSale_ClaimedParams["saleID"]) {
        return this.eth_call(functions.getSale_Claimed, {saleID})
    }

    getSale_CurrencyID(saleID: GetSale_CurrencyIDParams["saleID"]) {
        return this.eth_call(functions.getSale_CurrencyID, {saleID})
    }

    getSale_Currency_Address(saleID: GetSale_Currency_AddressParams["saleID"]) {
        return this.eth_call(functions.getSale_Currency_Address, {saleID})
    }

    getSale_Currency_Name(saleID: GetSale_Currency_NameParams["saleID"]) {
        return this.eth_call(functions.getSale_Currency_Name, {saleID})
    }

    getSale_Debt(saleID: GetSale_DebtParams["saleID"]) {
        return this.eth_call(functions.getSale_Debt, {saleID})
    }

    getSale_EarliestID() {
        return this.eth_call(functions.getSale_EarliestID, {})
    }

    getSale_EndTimestamp(saleID: GetSale_EndTimestampParams["saleID"]) {
        return this.eth_call(functions.getSale_EndTimestamp, {saleID})
    }

    getSale_GBMPreset(saleID: GetSale_GBMPresetParams["saleID"]) {
        return this.eth_call(functions.getSale_GBMPreset, {saleID})
    }

    getSale_GBMPresetIndex(saleID: GetSale_GBMPresetIndexParams["saleID"]) {
        return this.eth_call(functions.getSale_GBMPresetIndex, {saleID})
    }

    getSale_GBMPreset_AuctionDuration(saleID: GetSale_GBMPreset_AuctionDurationParams["saleID"]) {
        return this.eth_call(functions.getSale_GBMPreset_AuctionDuration, {saleID})
    }

    getSale_GBMPreset_CancellationPeriodDuration(saleID: GetSale_GBMPreset_CancellationPeriodDurationParams["saleID"]) {
        return this.eth_call(functions.getSale_GBMPreset_CancellationPeriodDuration, {saleID})
    }

    getSale_GBMPreset_HammerTimeDuration(saleID: GetSale_GBMPreset_HammerTimeDurationParams["saleID"]) {
        return this.eth_call(functions.getSale_GBMPreset_HammerTimeDuration, {saleID})
    }

    getSale_GBMPreset_IncentiveGrowthMultiplier(saleID: GetSale_GBMPreset_IncentiveGrowthMultiplierParams["saleID"]) {
        return this.eth_call(functions.getSale_GBMPreset_IncentiveGrowthMultiplier, {saleID})
    }

    getSale_GBMPreset_IncentiveMax(saleID: GetSale_GBMPreset_IncentiveMaxParams["saleID"]) {
        return this.eth_call(functions.getSale_GBMPreset_IncentiveMax, {saleID})
    }

    getSale_GBMPreset_IncentiveMin(saleID: GetSale_GBMPreset_IncentiveMinParams["saleID"]) {
        return this.eth_call(functions.getSale_GBMPreset_IncentiveMin, {saleID})
    }

    getSale_GBMPreset_StepMin(saleID: GetSale_GBMPreset_StepMinParams["saleID"]) {
        return this.eth_call(functions.getSale_GBMPreset_StepMin, {saleID})
    }

    getSale_HighestBid_Bidder(saleID: GetSale_HighestBid_BidderParams["saleID"]) {
        return this.eth_call(functions.getSale_HighestBid_Bidder, {saleID})
    }

    getSale_HighestBid_CurrencyIndex(saleID: GetSale_HighestBid_CurrencyIndexParams["saleID"]) {
        return this.eth_call(functions.getSale_HighestBid_CurrencyIndex, {saleID})
    }

    getSale_HighestBid_Currency_Address(saleID: GetSale_HighestBid_Currency_AddressParams["saleID"]) {
        return this.eth_call(functions.getSale_HighestBid_Currency_Address, {saleID})
    }

    getSale_HighestBid_Currency_Name(saleID: GetSale_HighestBid_Currency_NameParams["saleID"]) {
        return this.eth_call(functions.getSale_HighestBid_Currency_Name, {saleID})
    }

    getSale_HighestBid_Incentive(saleID: GetSale_HighestBid_IncentiveParams["saleID"]) {
        return this.eth_call(functions.getSale_HighestBid_Incentive, {saleID})
    }

    getSale_HighestBid_Value(saleID: GetSale_HighestBid_ValueParams["saleID"]) {
        return this.eth_call(functions.getSale_HighestBid_Value, {saleID})
    }

    getSale_LatestID() {
        return this.eth_call(functions.getSale_LatestID, {})
    }

    getSale_NumberOfBids(saleID: GetSale_NumberOfBidsParams["saleID"]) {
        return this.eth_call(functions.getSale_NumberOfBids, {saleID})
    }

    getSale_SaleKind(saleID: GetSale_SaleKindParams["saleID"]) {
        return this.eth_call(functions.getSale_SaleKind, {saleID})
    }

    getSale_StartTimestamp(saleID: GetSale_StartTimestampParams["saleID"]) {
        return this.eth_call(functions.getSale_StartTimestamp, {saleID})
    }

    getSale_StartingBid(saleID: GetSale_StartingBidParams["saleID"]) {
        return this.eth_call(functions.getSale_StartingBid, {saleID})
    }

    getSale_TokenAddress(saleID: GetSale_TokenAddressParams["saleID"]) {
        return this.eth_call(functions.getSale_TokenAddress, {saleID})
    }

    getSale_TokenAmount(saleID: GetSale_TokenAmountParams["saleID"]) {
        return this.eth_call(functions.getSale_TokenAmount, {saleID})
    }

    getSale_TokenID(saleID: GetSale_TokenIDParams["saleID"]) {
        return this.eth_call(functions.getSale_TokenID, {saleID})
    }

    getSale_TokenKind(saleID: GetSale_TokenKindParams["saleID"]) {
        return this.eth_call(functions.getSale_TokenKind, {saleID})
    }

    getSale_TokenOrigin(saleID: GetSale_TokenOriginParams["saleID"]) {
        return this.eth_call(functions.getSale_TokenOrigin, {saleID})
    }

    getSmartContractsUsersNativeCurrencyBalance(smartContract: GetSmartContractsUsersNativeCurrencyBalanceParams["smartContract"]) {
        return this.eth_call(functions.getSmartContractsUsersNativeCurrencyBalance, {smartContract})
    }

    getTotalNumberOfSales() {
        return this.eth_call(functions.getTotalNumberOfSales, {})
    }

    getWhitelistCounterSigner() {
        return this.eth_call(functions.getWhitelistCounterSigner, {})
    }

    getmPlaceDirectSaleFeePercentKage() {
        return this.eth_call(functions.getmPlaceDirectSaleFeePercentKage, {})
    }

    getmPlaceEnglishFeePercentKage() {
        return this.eth_call(functions.getmPlaceEnglishFeePercentKage, {})
    }

    getmPlaceGBMFeePercentKage() {
        return this.eth_call(functions.getmPlaceGBMFeePercentKage, {})
    }

    getpercentKage() {
        return this.eth_call(functions.getpercentKage, {})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    supportsInterface(interfaceID: SupportsInterfaceParams["interfaceID"]) {
        return this.eth_call(functions.supportsInterface, {interfaceID})
    }
}

/// Event types
export type AuctionBid_DisplacedEventArgs = EParams<typeof events.AuctionBid_Displaced>
export type AuctionBid_PlacedEventArgs = EParams<typeof events.AuctionBid_Placed>
export type AuctionRegistration_EndTimeUpdatedEventArgs = EParams<typeof events.AuctionRegistration_EndTimeUpdated>
export type AuctionRegistration_NewAuctionEventArgs = EParams<typeof events.AuctionRegistration_NewAuction>
export type AuctionRegistration_NewAuction_MassEventArgs = EParams<typeof events.AuctionRegistration_NewAuction_Mass>
export type Auction_ClaimedEventArgs = EParams<typeof events.Auction_Claimed>
export type Currency_AddressUpdatedEventArgs = EParams<typeof events.Currency_AddressUpdated>
export type Currency_DefaultUpdatedEventArgs = EParams<typeof events.Currency_DefaultUpdated>
export type Currency_NameUpdatedEventArgs = EParams<typeof events.Currency_NameUpdated>
export type DiamondCutEventArgs = EParams<typeof events.DiamondCut>
export type GBMPreset_DefaultUpdatedEventArgs = EParams<typeof events.GBMPreset_DefaultUpdated>
export type GBMPreset_UpdatedEventArgs = EParams<typeof events.GBMPreset_Updated>
export type MarketPlaceFeesStructure_UpdatedEventArgs = EParams<typeof events.MarketPlaceFeesStructure_Updated>
export type NFTContractWhitelistedEventArgs = EParams<typeof events.NFTContractWhitelisted>
export type OwnershipTransferredEventArgs = EParams<typeof events.OwnershipTransferred>
export type SaleExecutedEventArgs = EParams<typeof events.SaleExecuted>
export type SaleRegistration_NewSaleEventArgs = EParams<typeof events.SaleRegistration_NewSale>

/// Function types
export type GetmPlaceFeePercentKageSwapParams = FunctionArguments<typeof functions.getmPlaceFeePercentKageSwap>
export type GetmPlaceFeePercentKageSwapReturn = FunctionReturn<typeof functions.getmPlaceFeePercentKageSwap>

export type CancelASaleOfferParams = FunctionArguments<typeof functions.cancelASaleOffer>
export type CancelASaleOfferReturn = FunctionReturn<typeof functions.cancelASaleOffer>

export type SafeRegister721DirectSale_UserParams = FunctionArguments<typeof functions.safeRegister721DirectSale_User>
export type SafeRegister721DirectSale_UserReturn = FunctionReturn<typeof functions.safeRegister721DirectSale_User>

export type SafeRegister1155DirectSale_UserParams = FunctionArguments<typeof functions.safeRegister1155DirectSale_User>
export type SafeRegister1155DirectSale_UserReturn = FunctionReturn<typeof functions.safeRegister1155DirectSale_User>

export type GetGBMFeePercentKageSwapParams = FunctionArguments<typeof functions.getGBMFeePercentKageSwap>
export type GetGBMFeePercentKageSwapReturn = FunctionReturn<typeof functions.getGBMFeePercentKageSwap>

export type GetSaleToSwapeeParams = FunctionArguments<typeof functions.getSaleToSwapee>
export type GetSaleToSwapeeReturn = FunctionReturn<typeof functions.getSaleToSwapee>

export type GetSale_PriceParams = FunctionArguments<typeof functions.getSale_Price>
export type GetSale_PriceReturn = FunctionReturn<typeof functions.getSale_Price>

export type ExecuteSwapParams = FunctionArguments<typeof functions.executeSwap>
export type ExecuteSwapReturn = FunctionReturn<typeof functions.executeSwap>

export type CancelSwapParams = FunctionArguments<typeof functions.cancelSwap>
export type CancelSwapReturn = FunctionReturn<typeof functions.cancelSwap>

export type SafeRegister721SwapParams = FunctionArguments<typeof functions.safeRegister721Swap>
export type SafeRegister721SwapReturn = FunctionReturn<typeof functions.safeRegister721Swap>

export type GetIsSaleSecondaryParams = FunctionArguments<typeof functions.getIsSaleSecondary>
export type GetIsSaleSecondaryReturn = FunctionReturn<typeof functions.getIsSaleSecondary>

export type SafeRegister1155auctionBatch_UserParams_0 = FunctionArguments<typeof functions['safeRegister1155auctionBatch_User(uint256[],uint256[],address,uint256,uint256,uint256,bytes)']>
export type SafeRegister1155auctionBatch_UserReturn_0 = FunctionReturn<typeof functions['safeRegister1155auctionBatch_User(uint256[],uint256[],address,uint256,uint256,uint256,bytes)']>

export type SafeRegister1155auction_UserParams_0 = FunctionArguments<typeof functions['safeRegister1155auction_User(uint256,address,uint256,uint256,uint256,uint256,bytes)']>
export type SafeRegister1155auction_UserReturn_0 = FunctionReturn<typeof functions['safeRegister1155auction_User(uint256,address,uint256,uint256,uint256,uint256,bytes)']>

export type SafeRegister1155auction_User_CustomParams_0 = FunctionArguments<typeof functions['safeRegister1155auction_User_Custom(uint256,address,uint256,uint256,uint256,uint256,uint256,uint256,bytes)']>
export type SafeRegister1155auction_User_CustomReturn_0 = FunctionReturn<typeof functions['safeRegister1155auction_User_Custom(uint256,address,uint256,uint256,uint256,uint256,uint256,uint256,bytes)']>

export type SafeRegister721AuctionBatch_UserParams_0 = FunctionArguments<typeof functions['safeRegister721AuctionBatch_User(uint256[],address,uint256,uint256,uint256,bytes)']>
export type SafeRegister721AuctionBatch_UserReturn_0 = FunctionReturn<typeof functions['safeRegister721AuctionBatch_User(uint256[],address,uint256,uint256,uint256,bytes)']>

export type SafeRegister721AuctionBatch_User_CustomParams_0 = FunctionArguments<typeof functions['safeRegister721AuctionBatch_User_Custom(uint256[],address,uint256,uint256,uint256,uint256,uint256,bytes)']>
export type SafeRegister721AuctionBatch_User_CustomReturn_0 = FunctionReturn<typeof functions['safeRegister721AuctionBatch_User_Custom(uint256[],address,uint256,uint256,uint256,uint256,uint256,bytes)']>

export type SafeRegister721Auction_UserParams_0 = FunctionArguments<typeof functions['safeRegister721Auction_User(uint256,address,uint256,uint256,uint256,bytes)']>
export type SafeRegister721Auction_UserReturn_0 = FunctionReturn<typeof functions['safeRegister721Auction_User(uint256,address,uint256,uint256,uint256,bytes)']>

export type SafeRegister721Auction_User_CustomParams_0 = FunctionArguments<typeof functions['safeRegister721Auction_User_Custom(uint256,address,uint256,uint256,uint256,uint256,uint256,bytes)']>
export type SafeRegister721Auction_User_CustomReturn_0 = FunctionReturn<typeof functions['safeRegister721Auction_User_Custom(uint256,address,uint256,uint256,uint256,uint256,uint256,bytes)']>

export type StartTrackingNFTParams = FunctionArguments<typeof functions.startTrackingNFT>
export type StartTrackingNFTReturn = FunctionReturn<typeof functions.startTrackingNFT>

export type SetTokenSaleTierConfigParams = FunctionArguments<typeof functions.setTokenSaleTierConfig>
export type SetTokenSaleTierConfigReturn = FunctionReturn<typeof functions.setTokenSaleTierConfig>

export type BidParams_0 = FunctionArguments<typeof functions['bid(uint256,uint256,uint256)']>
export type BidReturn_0 = FunctionReturn<typeof functions['bid(uint256,uint256,uint256)']>

export type BidParams_1 = FunctionArguments<typeof functions['bid(uint256,uint256,uint256,bytes)']>
export type BidReturn_1 = FunctionReturn<typeof functions['bid(uint256,uint256,uint256,bytes)']>

export type BuyASaleOfferParams = FunctionArguments<typeof functions.buyASaleOffer>
export type BuyASaleOfferReturn = FunctionReturn<typeof functions.buyASaleOffer>

export type BuyASaleOfferPartialParams = FunctionArguments<typeof functions.buyASaleOfferPartial>
export type BuyASaleOfferPartialReturn = FunctionReturn<typeof functions.buyASaleOfferPartial>

export type CancelAuctionParams = FunctionArguments<typeof functions.cancelAuction>
export type CancelAuctionReturn = FunctionReturn<typeof functions.cancelAuction>

export type ClaimParams = FunctionArguments<typeof functions.claim>
export type ClaimReturn = FunctionReturn<typeof functions.claim>

export type DiamondCutParams = FunctionArguments<typeof functions.diamondCut>
export type DiamondCutReturn = FunctionReturn<typeof functions.diamondCut>

export type FacetAddressParams = FunctionArguments<typeof functions.facetAddress>
export type FacetAddressReturn = FunctionReturn<typeof functions.facetAddress>

export type FacetAddressesParams = FunctionArguments<typeof functions.facetAddresses>
export type FacetAddressesReturn = FunctionReturn<typeof functions.facetAddresses>

export type FacetFunctionSelectorsParams = FunctionArguments<typeof functions.facetFunctionSelectors>
export type FacetFunctionSelectorsReturn = FunctionReturn<typeof functions.facetFunctionSelectors>

export type FacetsParams = FunctionArguments<typeof functions.facets>
export type FacetsReturn = FunctionReturn<typeof functions.facets>

export type GetCurrencyAddressParams = FunctionArguments<typeof functions.getCurrencyAddress>
export type GetCurrencyAddressReturn = FunctionReturn<typeof functions.getCurrencyAddress>

export type GetCurrencyNameParams = FunctionArguments<typeof functions.getCurrencyName>
export type GetCurrencyNameReturn = FunctionReturn<typeof functions.getCurrencyName>

export type GetDefaultCurrencyParams = FunctionArguments<typeof functions.getDefaultCurrency>
export type GetDefaultCurrencyReturn = FunctionReturn<typeof functions.getDefaultCurrency>

export type GetERC1155Token_UnderSaleByDepositorParams = FunctionArguments<typeof functions.getERC1155Token_UnderSaleByDepositor>
export type GetERC1155Token_UnderSaleByDepositorReturn = FunctionReturn<typeof functions.getERC1155Token_UnderSaleByDepositor>

export type GetERC1155Token_depositorParams = FunctionArguments<typeof functions.getERC1155Token_depositor>
export type GetERC1155Token_depositorReturn = FunctionReturn<typeof functions.getERC1155Token_depositor>

export type GetERC721Token_depositorParams = FunctionArguments<typeof functions.getERC721Token_depositor>
export type GetERC721Token_depositorReturn = FunctionReturn<typeof functions.getERC721Token_depositor>

export type GetERC721Token_underSaleParams = FunctionArguments<typeof functions.getERC721Token_underSale>
export type GetERC721Token_underSaleReturn = FunctionReturn<typeof functions.getERC721Token_underSale>

export type GetGBMAdminParams = FunctionArguments<typeof functions.getGBMAdmin>
export type GetGBMAdminReturn = FunctionReturn<typeof functions.getGBMAdmin>

export type GetGBMFeePercentKageParams = FunctionArguments<typeof functions.getGBMFeePercentKage>
export type GetGBMFeePercentKageReturn = FunctionReturn<typeof functions.getGBMFeePercentKage>

export type GetGBMFeesAccountParams = FunctionArguments<typeof functions.getGBMFeesAccount>
export type GetGBMFeesAccountReturn = FunctionReturn<typeof functions.getGBMFeesAccount>

export type GetGBMFeePercentKageEnglishParams = FunctionArguments<typeof functions.getGBMFeePercentKageEnglish>
export type GetGBMFeePercentKageEnglishReturn = FunctionReturn<typeof functions.getGBMFeePercentKageEnglish>

export type GetOverrideSecondaryFeeParams = FunctionArguments<typeof functions.getOverrideSecondaryFee>
export type GetOverrideSecondaryFeeReturn = FunctionReturn<typeof functions.getOverrideSecondaryFee>

export type GetGBMFeePercentKageSecondaryParams = FunctionArguments<typeof functions.getGBMFeePercentKageSecondary>
export type GetGBMFeePercentKageSecondaryReturn = FunctionReturn<typeof functions.getGBMFeePercentKageSecondary>

export type GetGBMFeePercentKageEnglishSecondaryParams = FunctionArguments<typeof functions.getGBMFeePercentKageEnglishSecondary>
export type GetGBMFeePercentKageEnglishSecondaryReturn = FunctionReturn<typeof functions.getGBMFeePercentKageEnglishSecondary>

export type GetGBMFeePercentKageDirectSaleSecondaryParams = FunctionArguments<typeof functions.getGBMFeePercentKageDirectSaleSecondary>
export type GetGBMFeePercentKageDirectSaleSecondaryReturn = FunctionReturn<typeof functions.getGBMFeePercentKageDirectSaleSecondary>

export type GetMPlaceGBMFeePercentKageSecondaryParams = FunctionArguments<typeof functions.getMPlaceGBMFeePercentKageSecondary>
export type GetMPlaceGBMFeePercentKageSecondaryReturn = FunctionReturn<typeof functions.getMPlaceGBMFeePercentKageSecondary>

export type GetMPlaceEnglishFeePercentKageSecondaryParams = FunctionArguments<typeof functions.getMPlaceEnglishFeePercentKageSecondary>
export type GetMPlaceEnglishFeePercentKageSecondaryReturn = FunctionReturn<typeof functions.getMPlaceEnglishFeePercentKageSecondary>

export type GetMPlaceDirectFeePercentKageSecondaryParams = FunctionArguments<typeof functions.getMPlaceDirectFeePercentKageSecondary>
export type GetMPlaceDirectFeePercentKageSecondaryReturn = FunctionReturn<typeof functions.getMPlaceDirectFeePercentKageSecondary>

export type SetSecondarySeparateLicenseFeesParams = FunctionArguments<typeof functions.setSecondarySeparateLicenseFees>
export type SetSecondarySeparateLicenseFeesReturn = FunctionReturn<typeof functions.setSecondarySeparateLicenseFees>

export type GetGBMFeePercentKageDirectSaleParams = FunctionArguments<typeof functions.getGBMFeePercentKageDirectSale>
export type GetGBMFeePercentKageDirectSaleReturn = FunctionReturn<typeof functions.getGBMFeePercentKageDirectSale>

export type SetDSandENG_GBMLicenseFeesParams = FunctionArguments<typeof functions.setDSandENG_GBMLicenseFees>
export type SetDSandENG_GBMLicenseFeesReturn = FunctionReturn<typeof functions.setDSandENG_GBMLicenseFees>

export type SetPrimarySaleBeneficiaryOverrideParams = FunctionArguments<typeof functions.setPrimarySaleBeneficiaryOverride>
export type SetPrimarySaleBeneficiaryOverrideReturn = FunctionReturn<typeof functions.setPrimarySaleBeneficiaryOverride>

export type GetPrimarySaleBeneficiaryOverrideParams = FunctionArguments<typeof functions.getPrimarySaleBeneficiaryOverride>
export type GetPrimarySaleBeneficiaryOverrideReturn = FunctionReturn<typeof functions.getPrimarySaleBeneficiaryOverride>

export type GetGBMPresetParams = FunctionArguments<typeof functions.getGBMPreset>
export type GetGBMPresetReturn = FunctionReturn<typeof functions.getGBMPreset>

export type GetGBMPresetDefaultParams = FunctionArguments<typeof functions.getGBMPresetDefault>
export type GetGBMPresetDefaultReturn = FunctionReturn<typeof functions.getGBMPresetDefault>

export type GetGBMPreset_AuctionDurationParams = FunctionArguments<typeof functions.getGBMPreset_AuctionDuration>
export type GetGBMPreset_AuctionDurationReturn = FunctionReturn<typeof functions.getGBMPreset_AuctionDuration>

export type GetGBMPreset_CancellationPeriodDurationParams = FunctionArguments<typeof functions.getGBMPreset_CancellationPeriodDuration>
export type GetGBMPreset_CancellationPeriodDurationReturn = FunctionReturn<typeof functions.getGBMPreset_CancellationPeriodDuration>

export type GetGBMPreset_HammerTimeDurationParams = FunctionArguments<typeof functions.getGBMPreset_HammerTimeDuration>
export type GetGBMPreset_HammerTimeDurationReturn = FunctionReturn<typeof functions.getGBMPreset_HammerTimeDuration>

export type GetGBMPreset_IncentiveGrowthMultiplierParams = FunctionArguments<typeof functions.getGBMPreset_IncentiveGrowthMultiplier>
export type GetGBMPreset_IncentiveGrowthMultiplierReturn = FunctionReturn<typeof functions.getGBMPreset_IncentiveGrowthMultiplier>

export type GetGBMPreset_IncentiveMaxParams = FunctionArguments<typeof functions.getGBMPreset_IncentiveMax>
export type GetGBMPreset_IncentiveMaxReturn = FunctionReturn<typeof functions.getGBMPreset_IncentiveMax>

export type GetGBMPreset_IncentiveMinParams = FunctionArguments<typeof functions.getGBMPreset_IncentiveMin>
export type GetGBMPreset_IncentiveMinReturn = FunctionReturn<typeof functions.getGBMPreset_IncentiveMin>

export type GetGBMPreset_NameParams = FunctionArguments<typeof functions.getGBMPreset_Name>
export type GetGBMPreset_NameReturn = FunctionReturn<typeof functions.getGBMPreset_Name>

export type GetGBMPreset_StepMinParams = FunctionArguments<typeof functions.getGBMPreset_StepMin>
export type GetGBMPreset_StepMinReturn = FunctionReturn<typeof functions.getGBMPreset_StepMin>

export type GetGBMPresetsAmountParams = FunctionArguments<typeof functions.getGBMPresetsAmount>
export type GetGBMPresetsAmountReturn = FunctionReturn<typeof functions.getGBMPresetsAmount>

export type GetIsLicensePaidOnChainParams = FunctionArguments<typeof functions.getIsLicensePaidOnChain>
export type GetIsLicensePaidOnChainReturn = FunctionReturn<typeof functions.getIsLicensePaidOnChain>

export type GetMarketPlaceRoyaltyParams = FunctionArguments<typeof functions.getMarketPlaceRoyalty>
export type GetMarketPlaceRoyaltyReturn = FunctionReturn<typeof functions.getMarketPlaceRoyalty>

export type GetNFTContractIsWhitelistedParams = FunctionArguments<typeof functions.getNFTContractIsWhitelisted>
export type GetNFTContractIsWhitelistedReturn = FunctionReturn<typeof functions.getNFTContractIsWhitelisted>

export type GetSale_BeneficiaryParams = FunctionArguments<typeof functions.getSale_Beneficiary>
export type GetSale_BeneficiaryReturn = FunctionReturn<typeof functions.getSale_Beneficiary>

export type GetSale_Bid_BidderParams = FunctionArguments<typeof functions.getSale_Bid_Bidder>
export type GetSale_Bid_BidderReturn = FunctionReturn<typeof functions.getSale_Bid_Bidder>

export type GetSale_Bid_CurrencyIndexParams = FunctionArguments<typeof functions.getSale_Bid_CurrencyIndex>
export type GetSale_Bid_CurrencyIndexReturn = FunctionReturn<typeof functions.getSale_Bid_CurrencyIndex>

export type GetSale_Bid_Currency_AddressParams = FunctionArguments<typeof functions.getSale_Bid_Currency_Address>
export type GetSale_Bid_Currency_AddressReturn = FunctionReturn<typeof functions.getSale_Bid_Currency_Address>

export type GetSale_Bid_Currency_NameParams = FunctionArguments<typeof functions.getSale_Bid_Currency_Name>
export type GetSale_Bid_Currency_NameReturn = FunctionReturn<typeof functions.getSale_Bid_Currency_Name>

export type GetSale_Bid_IncentiveParams = FunctionArguments<typeof functions.getSale_Bid_Incentive>
export type GetSale_Bid_IncentiveReturn = FunctionReturn<typeof functions.getSale_Bid_Incentive>

export type GetSale_Bid_TimestampParams = FunctionArguments<typeof functions.getSale_Bid_Timestamp>
export type GetSale_Bid_TimestampReturn = FunctionReturn<typeof functions.getSale_Bid_Timestamp>

export type GetSale_Bid_ValueParams = FunctionArguments<typeof functions.getSale_Bid_Value>
export type GetSale_Bid_ValueReturn = FunctionReturn<typeof functions.getSale_Bid_Value>

export type GetSale_ClaimedParams = FunctionArguments<typeof functions.getSale_Claimed>
export type GetSale_ClaimedReturn = FunctionReturn<typeof functions.getSale_Claimed>

export type GetSale_CurrencyIDParams = FunctionArguments<typeof functions.getSale_CurrencyID>
export type GetSale_CurrencyIDReturn = FunctionReturn<typeof functions.getSale_CurrencyID>

export type GetSale_Currency_AddressParams = FunctionArguments<typeof functions.getSale_Currency_Address>
export type GetSale_Currency_AddressReturn = FunctionReturn<typeof functions.getSale_Currency_Address>

export type GetSale_Currency_NameParams = FunctionArguments<typeof functions.getSale_Currency_Name>
export type GetSale_Currency_NameReturn = FunctionReturn<typeof functions.getSale_Currency_Name>

export type GetSale_DebtParams = FunctionArguments<typeof functions.getSale_Debt>
export type GetSale_DebtReturn = FunctionReturn<typeof functions.getSale_Debt>

export type GetSale_EarliestIDParams = FunctionArguments<typeof functions.getSale_EarliestID>
export type GetSale_EarliestIDReturn = FunctionReturn<typeof functions.getSale_EarliestID>

export type GetSale_EndTimestampParams = FunctionArguments<typeof functions.getSale_EndTimestamp>
export type GetSale_EndTimestampReturn = FunctionReturn<typeof functions.getSale_EndTimestamp>

export type GetSale_GBMPresetParams = FunctionArguments<typeof functions.getSale_GBMPreset>
export type GetSale_GBMPresetReturn = FunctionReturn<typeof functions.getSale_GBMPreset>

export type GetSale_GBMPresetIndexParams = FunctionArguments<typeof functions.getSale_GBMPresetIndex>
export type GetSale_GBMPresetIndexReturn = FunctionReturn<typeof functions.getSale_GBMPresetIndex>

export type GetSale_GBMPreset_AuctionDurationParams = FunctionArguments<typeof functions.getSale_GBMPreset_AuctionDuration>
export type GetSale_GBMPreset_AuctionDurationReturn = FunctionReturn<typeof functions.getSale_GBMPreset_AuctionDuration>

export type GetSale_GBMPreset_CancellationPeriodDurationParams = FunctionArguments<typeof functions.getSale_GBMPreset_CancellationPeriodDuration>
export type GetSale_GBMPreset_CancellationPeriodDurationReturn = FunctionReturn<typeof functions.getSale_GBMPreset_CancellationPeriodDuration>

export type GetSale_GBMPreset_HammerTimeDurationParams = FunctionArguments<typeof functions.getSale_GBMPreset_HammerTimeDuration>
export type GetSale_GBMPreset_HammerTimeDurationReturn = FunctionReturn<typeof functions.getSale_GBMPreset_HammerTimeDuration>

export type GetSale_GBMPreset_IncentiveGrowthMultiplierParams = FunctionArguments<typeof functions.getSale_GBMPreset_IncentiveGrowthMultiplier>
export type GetSale_GBMPreset_IncentiveGrowthMultiplierReturn = FunctionReturn<typeof functions.getSale_GBMPreset_IncentiveGrowthMultiplier>

export type GetSale_GBMPreset_IncentiveMaxParams = FunctionArguments<typeof functions.getSale_GBMPreset_IncentiveMax>
export type GetSale_GBMPreset_IncentiveMaxReturn = FunctionReturn<typeof functions.getSale_GBMPreset_IncentiveMax>

export type GetSale_GBMPreset_IncentiveMinParams = FunctionArguments<typeof functions.getSale_GBMPreset_IncentiveMin>
export type GetSale_GBMPreset_IncentiveMinReturn = FunctionReturn<typeof functions.getSale_GBMPreset_IncentiveMin>

export type GetSale_GBMPreset_StepMinParams = FunctionArguments<typeof functions.getSale_GBMPreset_StepMin>
export type GetSale_GBMPreset_StepMinReturn = FunctionReturn<typeof functions.getSale_GBMPreset_StepMin>

export type GetSale_HighestBid_BidderParams = FunctionArguments<typeof functions.getSale_HighestBid_Bidder>
export type GetSale_HighestBid_BidderReturn = FunctionReturn<typeof functions.getSale_HighestBid_Bidder>

export type GetSale_HighestBid_CurrencyIndexParams = FunctionArguments<typeof functions.getSale_HighestBid_CurrencyIndex>
export type GetSale_HighestBid_CurrencyIndexReturn = FunctionReturn<typeof functions.getSale_HighestBid_CurrencyIndex>

export type GetSale_HighestBid_Currency_AddressParams = FunctionArguments<typeof functions.getSale_HighestBid_Currency_Address>
export type GetSale_HighestBid_Currency_AddressReturn = FunctionReturn<typeof functions.getSale_HighestBid_Currency_Address>

export type GetSale_HighestBid_Currency_NameParams = FunctionArguments<typeof functions.getSale_HighestBid_Currency_Name>
export type GetSale_HighestBid_Currency_NameReturn = FunctionReturn<typeof functions.getSale_HighestBid_Currency_Name>

export type GetSale_HighestBid_IncentiveParams = FunctionArguments<typeof functions.getSale_HighestBid_Incentive>
export type GetSale_HighestBid_IncentiveReturn = FunctionReturn<typeof functions.getSale_HighestBid_Incentive>

export type GetSale_HighestBid_ValueParams = FunctionArguments<typeof functions.getSale_HighestBid_Value>
export type GetSale_HighestBid_ValueReturn = FunctionReturn<typeof functions.getSale_HighestBid_Value>

export type GetSale_LatestIDParams = FunctionArguments<typeof functions.getSale_LatestID>
export type GetSale_LatestIDReturn = FunctionReturn<typeof functions.getSale_LatestID>

export type GetSale_NumberOfBidsParams = FunctionArguments<typeof functions.getSale_NumberOfBids>
export type GetSale_NumberOfBidsReturn = FunctionReturn<typeof functions.getSale_NumberOfBids>

export type GetSale_SaleKindParams = FunctionArguments<typeof functions.getSale_SaleKind>
export type GetSale_SaleKindReturn = FunctionReturn<typeof functions.getSale_SaleKind>

export type GetSale_StartTimestampParams = FunctionArguments<typeof functions.getSale_StartTimestamp>
export type GetSale_StartTimestampReturn = FunctionReturn<typeof functions.getSale_StartTimestamp>

export type GetSale_StartingBidParams = FunctionArguments<typeof functions.getSale_StartingBid>
export type GetSale_StartingBidReturn = FunctionReturn<typeof functions.getSale_StartingBid>

export type GetSale_TokenAddressParams = FunctionArguments<typeof functions.getSale_TokenAddress>
export type GetSale_TokenAddressReturn = FunctionReturn<typeof functions.getSale_TokenAddress>

export type GetSale_TokenAmountParams = FunctionArguments<typeof functions.getSale_TokenAmount>
export type GetSale_TokenAmountReturn = FunctionReturn<typeof functions.getSale_TokenAmount>

export type GetSale_TokenIDParams = FunctionArguments<typeof functions.getSale_TokenID>
export type GetSale_TokenIDReturn = FunctionReturn<typeof functions.getSale_TokenID>

export type GetSale_TokenKindParams = FunctionArguments<typeof functions.getSale_TokenKind>
export type GetSale_TokenKindReturn = FunctionReturn<typeof functions.getSale_TokenKind>

export type GetSale_TokenOriginParams = FunctionArguments<typeof functions.getSale_TokenOrigin>
export type GetSale_TokenOriginReturn = FunctionReturn<typeof functions.getSale_TokenOrigin>

export type GetSmartContractsUsersNativeCurrencyBalanceParams = FunctionArguments<typeof functions.getSmartContractsUsersNativeCurrencyBalance>
export type GetSmartContractsUsersNativeCurrencyBalanceReturn = FunctionReturn<typeof functions.getSmartContractsUsersNativeCurrencyBalance>

export type GetTotalNumberOfSalesParams = FunctionArguments<typeof functions.getTotalNumberOfSales>
export type GetTotalNumberOfSalesReturn = FunctionReturn<typeof functions.getTotalNumberOfSales>

export type GetWhitelistCounterSignerParams = FunctionArguments<typeof functions.getWhitelistCounterSigner>
export type GetWhitelistCounterSignerReturn = FunctionReturn<typeof functions.getWhitelistCounterSigner>

export type GetmPlaceDirectSaleFeePercentKageParams = FunctionArguments<typeof functions.getmPlaceDirectSaleFeePercentKage>
export type GetmPlaceDirectSaleFeePercentKageReturn = FunctionReturn<typeof functions.getmPlaceDirectSaleFeePercentKage>

export type GetmPlaceEnglishFeePercentKageParams = FunctionArguments<typeof functions.getmPlaceEnglishFeePercentKage>
export type GetmPlaceEnglishFeePercentKageReturn = FunctionReturn<typeof functions.getmPlaceEnglishFeePercentKage>

export type GetmPlaceGBMFeePercentKageParams = FunctionArguments<typeof functions.getmPlaceGBMFeePercentKage>
export type GetmPlaceGBMFeePercentKageReturn = FunctionReturn<typeof functions.getmPlaceGBMFeePercentKage>

export type GetpercentKageParams = FunctionArguments<typeof functions.getpercentKage>
export type GetpercentKageReturn = FunctionReturn<typeof functions.getpercentKage>

export type OnERC1155BatchReceivedParams = FunctionArguments<typeof functions.onERC1155BatchReceived>
export type OnERC1155BatchReceivedReturn = FunctionReturn<typeof functions.onERC1155BatchReceived>

export type OnERC1155ReceivedParams = FunctionArguments<typeof functions.onERC1155Received>
export type OnERC1155ReceivedReturn = FunctionReturn<typeof functions.onERC1155Received>

export type OnERC721ReceivedParams = FunctionArguments<typeof functions.onERC721Received>
export type OnERC721ReceivedReturn = FunctionReturn<typeof functions.onERC721Received>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type RegisterLazyBatch721AuctionParams = FunctionArguments<typeof functions.registerLazyBatch721Auction>
export type RegisterLazyBatch721AuctionReturn = FunctionReturn<typeof functions.registerLazyBatch721Auction>

export type SafeRegister1155DirectSaleParams = FunctionArguments<typeof functions.safeRegister1155DirectSale>
export type SafeRegister1155DirectSaleReturn = FunctionReturn<typeof functions.safeRegister1155DirectSale>

export type SafeRegister1155DirectSale_BatchParams = FunctionArguments<typeof functions.safeRegister1155DirectSale_Batch>
export type SafeRegister1155DirectSale_BatchReturn = FunctionReturn<typeof functions.safeRegister1155DirectSale_Batch>

export type SafeRegister1155auctionParams = FunctionArguments<typeof functions.safeRegister1155auction>
export type SafeRegister1155auctionReturn = FunctionReturn<typeof functions.safeRegister1155auction>

export type SafeRegister1155auctionBatchParams = FunctionArguments<typeof functions.safeRegister1155auctionBatch>
export type SafeRegister1155auctionBatchReturn = FunctionReturn<typeof functions.safeRegister1155auctionBatch>

export type SafeRegister1155auctionBatch_CustomParams = FunctionArguments<typeof functions.safeRegister1155auctionBatch_Custom>
export type SafeRegister1155auctionBatch_CustomReturn = FunctionReturn<typeof functions.safeRegister1155auctionBatch_Custom>

export type SafeRegister1155auctionBatch_UserParams_1 = FunctionArguments<typeof functions['safeRegister1155auctionBatch_User(uint256[],uint256[],address,uint256,uint256,uint256)']>
export type SafeRegister1155auctionBatch_UserReturn_1 = FunctionReturn<typeof functions['safeRegister1155auctionBatch_User(uint256[],uint256[],address,uint256,uint256,uint256)']>

export type SafeRegister1155auctionBatch_User_CustomParams = FunctionArguments<typeof functions.safeRegister1155auctionBatch_User_Custom>
export type SafeRegister1155auctionBatch_User_CustomReturn = FunctionReturn<typeof functions.safeRegister1155auctionBatch_User_Custom>

export type SafeRegister1155auction_CustomParams = FunctionArguments<typeof functions.safeRegister1155auction_Custom>
export type SafeRegister1155auction_CustomReturn = FunctionReturn<typeof functions.safeRegister1155auction_Custom>

export type SafeRegister1155auction_UserParams_1 = FunctionArguments<typeof functions['safeRegister1155auction_User(uint256,address,uint256,uint256,uint256,uint256)']>
export type SafeRegister1155auction_UserReturn_1 = FunctionReturn<typeof functions['safeRegister1155auction_User(uint256,address,uint256,uint256,uint256,uint256)']>

export type SafeRegister1155auction_User_CustomParams_1 = FunctionArguments<typeof functions['safeRegister1155auction_User_Custom(uint256,address,uint256,uint256,uint256,uint256,uint256,uint256)']>
export type SafeRegister1155auction_User_CustomReturn_1 = FunctionReturn<typeof functions['safeRegister1155auction_User_Custom(uint256,address,uint256,uint256,uint256,uint256,uint256,uint256)']>

export type SafeRegister721AuctionParams = FunctionArguments<typeof functions.safeRegister721Auction>
export type SafeRegister721AuctionReturn = FunctionReturn<typeof functions.safeRegister721Auction>

export type SafeRegister721AuctionBatchParams = FunctionArguments<typeof functions.safeRegister721AuctionBatch>
export type SafeRegister721AuctionBatchReturn = FunctionReturn<typeof functions.safeRegister721AuctionBatch>

export type SafeRegister721AuctionBatch_CustomParams = FunctionArguments<typeof functions.safeRegister721AuctionBatch_Custom>
export type SafeRegister721AuctionBatch_CustomReturn = FunctionReturn<typeof functions.safeRegister721AuctionBatch_Custom>

export type SafeRegister721AuctionBatch_UserParams_1 = FunctionArguments<typeof functions['safeRegister721AuctionBatch_User(uint256[],address,uint256,uint256,uint256)']>
export type SafeRegister721AuctionBatch_UserReturn_1 = FunctionReturn<typeof functions['safeRegister721AuctionBatch_User(uint256[],address,uint256,uint256,uint256)']>

export type SafeRegister721AuctionBatch_User_CustomParams_1 = FunctionArguments<typeof functions['safeRegister721AuctionBatch_User_Custom(uint256[],address,uint256,uint256,uint256,uint256,uint256)']>
export type SafeRegister721AuctionBatch_User_CustomReturn_1 = FunctionReturn<typeof functions['safeRegister721AuctionBatch_User_Custom(uint256[],address,uint256,uint256,uint256,uint256,uint256)']>

export type SafeRegister721Auction_CustomParams = FunctionArguments<typeof functions.safeRegister721Auction_Custom>
export type SafeRegister721Auction_CustomReturn = FunctionReturn<typeof functions.safeRegister721Auction_Custom>

export type SafeRegister721Auction_UserParams_1 = FunctionArguments<typeof functions['safeRegister721Auction_User(uint256,address,uint256,uint256,uint256)']>
export type SafeRegister721Auction_UserReturn_1 = FunctionReturn<typeof functions['safeRegister721Auction_User(uint256,address,uint256,uint256,uint256)']>

export type SafeRegister721Auction_User_CustomParams_1 = FunctionArguments<typeof functions['safeRegister721Auction_User_Custom(uint256,address,uint256,uint256,uint256,uint256,uint256)']>
export type SafeRegister721Auction_User_CustomReturn_1 = FunctionReturn<typeof functions['safeRegister721Auction_User_Custom(uint256,address,uint256,uint256,uint256,uint256,uint256)']>

export type SafeRegister721DirectSaleParams = FunctionArguments<typeof functions.safeRegister721DirectSale>
export type SafeRegister721DirectSaleReturn = FunctionReturn<typeof functions.safeRegister721DirectSale>

export type SafeRegister721DirectSale_BatchParams = FunctionArguments<typeof functions.safeRegister721DirectSale_Batch>
export type SafeRegister721DirectSale_BatchReturn = FunctionReturn<typeof functions.safeRegister721DirectSale_Batch>

export type SetCurrencyAddressParams = FunctionArguments<typeof functions.setCurrencyAddress>
export type SetCurrencyAddressReturn = FunctionReturn<typeof functions.setCurrencyAddress>

export type SetCurrencyAddressAndNameParams = FunctionArguments<typeof functions.setCurrencyAddressAndName>
export type SetCurrencyAddressAndNameReturn = FunctionReturn<typeof functions.setCurrencyAddressAndName>

export type SetCurrencyNameParams = FunctionArguments<typeof functions.setCurrencyName>
export type SetCurrencyNameReturn = FunctionReturn<typeof functions.setCurrencyName>

export type SetDefaultCurrencyParams = FunctionArguments<typeof functions.setDefaultCurrency>
export type SetDefaultCurrencyReturn = FunctionReturn<typeof functions.setDefaultCurrency>

export type SetDefaultGBMPresetParams = FunctionArguments<typeof functions.setDefaultGBMPreset>
export type SetDefaultGBMPresetReturn = FunctionReturn<typeof functions.setDefaultGBMPreset>

export type SetGBMAdminParams = FunctionArguments<typeof functions.setGBMAdmin>
export type SetGBMAdminReturn = FunctionReturn<typeof functions.setGBMAdmin>

export type SetGBMPresetParams = FunctionArguments<typeof functions.setGBMPreset>
export type SetGBMPresetReturn = FunctionReturn<typeof functions.setGBMPreset>

export type SetMarketPlaceFeesStructureParams = FunctionArguments<typeof functions.setMarketPlaceFeesStructure>
export type SetMarketPlaceFeesStructureReturn = FunctionReturn<typeof functions.setMarketPlaceFeesStructure>

export type SetNFTContractIsWhitelistedParams = FunctionArguments<typeof functions.setNFTContractIsWhitelisted>
export type SetNFTContractIsWhitelistedReturn = FunctionReturn<typeof functions.setNFTContractIsWhitelisted>

export type SetWhitelistCounterSignerParams = FunctionArguments<typeof functions.setWhitelistCounterSigner>
export type SetWhitelistCounterSignerReturn = FunctionReturn<typeof functions.setWhitelistCounterSigner>

export type SupportsInterfaceParams = FunctionArguments<typeof functions.supportsInterface>
export type SupportsInterfaceReturn = FunctionReturn<typeof functions.supportsInterface>

export type TransferOwnershipParams = FunctionArguments<typeof functions.transferOwnership>
export type TransferOwnershipReturn = FunctionReturn<typeof functions.transferOwnership>

export type WithdrawParams = FunctionArguments<typeof functions.withdraw>
export type WithdrawReturn = FunctionReturn<typeof functions.withdraw>

export type SetSaleClaimedFlagParams = FunctionArguments<typeof functions.setSaleClaimedFlag>
export type SetSaleClaimedFlagReturn = FunctionReturn<typeof functions.setSaleClaimedFlag>

export type SetSaleClaimedFlag_BatchParams = FunctionArguments<typeof functions.setSaleClaimedFlag_Batch>
export type SetSaleClaimedFlag_BatchReturn = FunctionReturn<typeof functions.setSaleClaimedFlag_Batch>

