import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    Abdicate: event("0xa8480b135a28741e8c059528bf8f82de70278485fb86bfc816a183801f0a8570", "Abdicate(bytes4)", {"selector": indexed(p.bytes4)}),
    Accept: event("0x29aa42fc192ff77ef42105abba283197ac841341e196e417a7fc2784cdc4e5fb", "Accept(bytes4,bytes)", {"selector": indexed(p.bytes4), "data": p.bytes}),
    AccrueInterest: event("0x4dec04e750ca11537cabcd8a9eab06494de08da3735bc8871cd41250e190bc04", "AccrueInterest(uint256,uint256,uint256,uint256)", {"previousTotalAssets": p.uint256, "newTotalAssets": p.uint256, "performanceFeeShares": p.uint256, "managementFeeShares": p.uint256}),
    AddAdapter: event("0x8f125a24838c4c23e893904b255b5c672d43d4cb8af7e3d15841eaeabc1e68aa", "AddAdapter(address)", {"account": indexed(p.address)}),
    Allocate: event("0x2bc7948a96a066968d2a58aaf46eb0b305aa166b1d1951d2f7ef0919746b8c2a", "Allocate(address,address,uint256,bytes32[],int256)", {"sender": indexed(p.address), "adapter": indexed(p.address), "assets": p.uint256, "ids": p.array(p.bytes32), "change": p.int256}),
    AllowanceUpdatedByTransferFrom: event("0xc1886047cf852ffdaeda16dafd86e28507781ffba1faafef1d536d4abaa260b0", "AllowanceUpdatedByTransferFrom(address,address,uint256)", {"owner": indexed(p.address), "spender": indexed(p.address), "shares": p.uint256}),
    Approval: event("0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925", "Approval(address,address,uint256)", {"owner": indexed(p.address), "spender": indexed(p.address), "shares": p.uint256}),
    Constructor: event("0x612d665a88b3ae6bc3e53207bfc2db673e2e05e2aa4a68043b618cc81295a27d", "Constructor(address,address)", {"owner": indexed(p.address), "asset": indexed(p.address)}),
    Deallocate: event("0xd602b36fb24934aef1bc2a658de029b486fa4c664a6e45de1f48e3fd1be25dd9", "Deallocate(address,address,uint256,bytes32[],int256)", {"sender": indexed(p.address), "adapter": indexed(p.address), "assets": p.uint256, "ids": p.array(p.bytes32), "change": p.int256}),
    DecreaseAbsoluteCap: event("0xbc2ffe81312f53db4f327eca188ebdc13df66a8ce25f7dec6f5b4495fe27b371", "DecreaseAbsoluteCap(address,bytes32,bytes,uint256)", {"sender": indexed(p.address), "id": indexed(p.bytes32), "idData": p.bytes, "newAbsoluteCap": p.uint256}),
    DecreaseRelativeCap: event("0xcedce6ffe8b7f89de49bd4f955667ca0a963a8059264196807b240ed470b25ce", "DecreaseRelativeCap(address,bytes32,bytes,uint256)", {"sender": indexed(p.address), "id": indexed(p.bytes32), "idData": p.bytes, "newRelativeCap": p.uint256}),
    DecreaseTimelock: event("0x488e0bfafe0a9580c2271bee1f563a47d309f0105ca950ea525d909b43b36daf", "DecreaseTimelock(bytes4,uint256)", {"selector": indexed(p.bytes4), "newDuration": p.uint256}),
    Deposit: event("0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7", "Deposit(address,address,uint256,uint256)", {"sender": indexed(p.address), "onBehalf": indexed(p.address), "assets": p.uint256, "shares": p.uint256}),
    ForceDeallocate: event("0xb98216be0267fa550428a584fe6ac1ef0f39788e0198372100e813444afecd29", "ForceDeallocate(address,address,uint256,address,bytes32[],uint256)", {"sender": indexed(p.address), "adapter": p.address, "assets": p.uint256, "onBehalf": indexed(p.address), "ids": p.array(p.bytes32), "penaltyAssets": p.uint256}),
    IncreaseAbsoluteCap: event("0x7368d59ed82f6a538f6deef9baa54623fe3699ce07b19031f762f740c8c34b03", "IncreaseAbsoluteCap(bytes32,bytes,uint256)", {"id": indexed(p.bytes32), "idData": p.bytes, "newAbsoluteCap": p.uint256}),
    IncreaseRelativeCap: event("0x2a343b9a1ceba40853d01c6adeea53f5c0e4b95b4eb870ed4af309a0ead7e399", "IncreaseRelativeCap(bytes32,bytes,uint256)", {"id": indexed(p.bytes32), "idData": p.bytes, "newRelativeCap": p.uint256}),
    IncreaseTimelock: event("0xed380a7a1f0afc99b313ac7d9f1e52e44430d32b4639c7993bd0021974e30c0e", "IncreaseTimelock(bytes4,uint256)", {"selector": indexed(p.bytes4), "newDuration": p.uint256}),
    Permit: event("0x40336af4b170f3dad5ddfb59897a8289adc3bed01417ca7e2bd77f85bc526413", "Permit(address,address,uint256,uint256,uint256)", {"owner": indexed(p.address), "spender": indexed(p.address), "shares": p.uint256, "nonce": p.uint256, "deadline": p.uint256}),
    RemoveAdapter: event("0x34f33faa2592bc1f615ec3e91b55b7784665ce46461403c294824d85f9f66458", "RemoveAdapter(address)", {"account": indexed(p.address)}),
    Revoke: event("0x70521cf6a7c2458c5ad406081ad7b3bc4afd31b01b586a157a9780fcee6a77cb", "Revoke(address,bytes4,bytes)", {"sender": indexed(p.address), "selector": indexed(p.bytes4), "data": p.bytes}),
    SetAdapterRegistry: event("0x7c5f71ef3a94efd2804ad9a6eb74b723dae0d26ef7d2a031f7986c96ae55afda", "SetAdapterRegistry(address)", {"newAdapterRegistry": indexed(p.address)}),
    SetCurator: event("0xbd0a63c12948fbc9194a5839019f99c9d71db924e5c70018265bc778b8f1a506", "SetCurator(address)", {"newCurator": indexed(p.address)}),
    SetForceDeallocatePenalty: event("0x1e29a0bf54cf1e929f17cc97a198ff5cf7f8da1df1cb8ff67f7184ce380f3924", "SetForceDeallocatePenalty(address,uint256)", {"adapter": indexed(p.address), "forceDeallocatePenalty": p.uint256}),
    SetIsAllocator: event("0x74dc60cbc81a9472d04ad1d20e151d369c41104d655ed3f2f3091166a502cd8d", "SetIsAllocator(address,bool)", {"account": indexed(p.address), "newIsAllocator": p.bool}),
    SetIsSentinel: event("0x8da69db4003c01b5c7be66a7bb5953423222e5118b6af0aadf54e75feef5bc50", "SetIsSentinel(address,bool)", {"account": indexed(p.address), "newIsSentinel": p.bool}),
    SetLiquidityAdapterAndData: event("0x9deb43d71422af41853c3921fb364b7647f9a9b136e46d66d45c1bf707af706c", "SetLiquidityAdapterAndData(address,address,bytes)", {"sender": indexed(p.address), "newLiquidityAdapter": indexed(p.address), "newLiquidityData": indexed(p.bytes)}),
    SetManagementFee: event("0xd87632b1c6ebfa21acbca0e3279b3cf6385a377cb8fda51e5b866baa6e6012ab", "SetManagementFee(uint256)", {"newManagementFee": p.uint256}),
    SetManagementFeeRecipient: event("0x7f1dd9b78dfeeb8c452333915b2f077f4920fefc4ec7f146767e9ba40303ef1f", "SetManagementFeeRecipient(address)", {"newManagementFeeRecipient": indexed(p.address)}),
    SetMaxRate: event("0x75fef0e2a5e934789b0723129a0d1bbfd4a50f39c5af9919626e4f3603aef5ff", "SetMaxRate(uint256)", {"newMaxRate": p.uint256}),
    SetName: event("0x4df9dcd34ae35f40f2c756fd8ac83210ed0b76d065543ee73d868aec7c7fcf02", "SetName(string)", {"newName": p.string}),
    SetOwner: event("0x167d3e9c1016ab80e58802ca9da10ce5c6a0f4debc46a2e7a2cd9e56899a4fb5", "SetOwner(address)", {"newOwner": indexed(p.address)}),
    SetPerformanceFee: event("0x8b940a95968ad5b511f89b01075446a4fe9f614f2dc5fbb9e9a6b227d6d4fd70", "SetPerformanceFee(uint256)", {"newPerformanceFee": p.uint256}),
    SetPerformanceFeeRecipient: event("0xe59cc3d47f72dbd81f7d5fc40b9b05d9c4374a54addea771648ae24943c26e76", "SetPerformanceFeeRecipient(address)", {"newPerformanceFeeRecipient": indexed(p.address)}),
    SetReceiveAssetsGate: event("0x6b530281a3f54e1c3e430297307183ba1bafca3cdf775404395c208e6cf3e15f", "SetReceiveAssetsGate(address)", {"newReceiveAssetsGate": indexed(p.address)}),
    SetReceiveSharesGate: event("0x004237ebb79833e3e0bc633281452dc9e5c76b92b603140b2a53b0bceb441cae", "SetReceiveSharesGate(address)", {"newReceiveSharesGate": indexed(p.address)}),
    SetSendAssetsGate: event("0x34c1885f043c6c77736fbc402c63a383472347b85868dab73d42b69596a98e94", "SetSendAssetsGate(address)", {"newSendAssetsGate": indexed(p.address)}),
    SetSendSharesGate: event("0x43a3573cf238e4b97d4ffec8e9b8a69cd276b47cf68230dbdbec3a7a98b28723", "SetSendSharesGate(address)", {"newSendSharesGate": indexed(p.address)}),
    SetSymbol: event("0xadf3ae8bd543b3007d464f15cb8ea1db3f44e84d41d203164f40b95e27558ac6", "SetSymbol(string)", {"newSymbol": p.string}),
    Submit: event("0x8b18afeb361b83b025999ed5b42f1d90c68aaa5a0fd49c015f04c3b8b81e80eb", "Submit(bytes4,bytes,uint256)", {"selector": indexed(p.bytes4), "data": p.bytes, "executableAt": p.uint256}),
    Transfer: event("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "Transfer(address,address,uint256)", {"from": indexed(p.address), "to": indexed(p.address), "shares": p.uint256}),
    Withdraw: event("0xfbde797d201c681b91056529119e0b02407c7bb96a4a2c75c01fc9667232c8db", "Withdraw(address,address,address,uint256,uint256)", {"sender": indexed(p.address), "receiver": indexed(p.address), "onBehalf": indexed(p.address), "assets": p.uint256, "shares": p.uint256}),
}

export const functions = {
    DOMAIN_SEPARATOR: viewFun("0x3644e515", "DOMAIN_SEPARATOR()", {}, p.bytes32),
    _totalAssets: viewFun("0xce04bebb", "_totalAssets()", {}, p.uint128),
    abdicate: fun("0xb2e32848", "abdicate(bytes4)", {"selector": p.bytes4}, ),
    abdicated: viewFun("0xe470b8bc", "abdicated(bytes4)", {"selector": p.bytes4}, p.bool),
    absoluteCap: viewFun("0xbc0dd374", "absoluteCap(bytes32)", {"id": p.bytes32}, p.uint256),
    accrueInterest: fun("0xa6afed95", "accrueInterest()", {}, ),
    accrueInterestView: viewFun("0x60a38ac1", "accrueInterestView()", {}, {"_0": p.uint256, "_1": p.uint256, "_2": p.uint256}),
    adapterRegistry: viewFun("0x50b5c16a", "adapterRegistry()", {}, p.address),
    adapters: viewFun("0x4ef501ac", "adapters(uint256)", {"_0": p.uint256}, p.address),
    adaptersLength: viewFun("0x5aa22bc8", "adaptersLength()", {}, p.uint256),
    addAdapter: fun("0x60d54d41", "addAdapter(address)", {"account": p.address}, ),
    allocate: fun("0x5c9ce04d", "allocate(address,bytes,uint256)", {"adapter": p.address, "data": p.bytes, "assets": p.uint256}, ),
    allocation: viewFun("0xc69507dd", "allocation(bytes32)", {"id": p.bytes32}, p.uint256),
    allowance: viewFun("0xdd62ed3e", "allowance(address,address)", {"owner": p.address, "spender": p.address}, p.uint256),
    approve: fun("0x095ea7b3", "approve(address,uint256)", {"spender": p.address, "shares": p.uint256}, p.bool),
    asset: viewFun("0x38d52e0f", "asset()", {}, p.address),
    balanceOf: viewFun("0x70a08231", "balanceOf(address)", {"account": p.address}, p.uint256),
    canReceiveAssets: viewFun("0x0d326b18", "canReceiveAssets(address)", {"account": p.address}, p.bool),
    canReceiveShares: viewFun("0x98c9b49c", "canReceiveShares(address)", {"account": p.address}, p.bool),
    canSendAssets: viewFun("0x20fe8d58", "canSendAssets(address)", {"account": p.address}, p.bool),
    canSendShares: viewFun("0x8e511e4d", "canSendShares(address)", {"account": p.address}, p.bool),
    convertToAssets: viewFun("0x07a2d13a", "convertToAssets(uint256)", {"shares": p.uint256}, p.uint256),
    convertToShares: viewFun("0xc6e6f592", "convertToShares(uint256)", {"assets": p.uint256}, p.uint256),
    curator: viewFun("0xe66f53b7", "curator()", {}, p.address),
    deallocate: fun("0x4b219d16", "deallocate(address,bytes,uint256)", {"adapter": p.address, "data": p.bytes, "assets": p.uint256}, ),
    decimals: viewFun("0x313ce567", "decimals()", {}, p.uint8),
    decreaseAbsoluteCap: fun("0x8c54519b", "decreaseAbsoluteCap(bytes,uint256)", {"idData": p.bytes, "newAbsoluteCap": p.uint256}, ),
    decreaseRelativeCap: fun("0x57975270", "decreaseRelativeCap(bytes,uint256)", {"idData": p.bytes, "newRelativeCap": p.uint256}, ),
    decreaseTimelock: fun("0x5c1a1a4f", "decreaseTimelock(bytes4,uint256)", {"selector": p.bytes4, "newDuration": p.uint256}, ),
    deposit: fun("0x6e553f65", "deposit(uint256,address)", {"assets": p.uint256, "onBehalf": p.address}, p.uint256),
    executableAt: viewFun("0x8639fb07", "executableAt(bytes)", {"data": p.bytes}, p.uint256),
    firstTotalAssets: viewFun("0xf73f8f31", "firstTotalAssets()", {}, p.uint256),
    forceDeallocate: fun("0xe4d38cd8", "forceDeallocate(address,bytes,uint256,address)", {"adapter": p.address, "data": p.bytes, "assets": p.uint256, "onBehalf": p.address}, p.uint256),
    forceDeallocatePenalty: viewFun("0x99e99183", "forceDeallocatePenalty(address)", {"adapter": p.address}, p.uint256),
    increaseAbsoluteCap: fun("0xf6f98fd5", "increaseAbsoluteCap(bytes,uint256)", {"idData": p.bytes, "newAbsoluteCap": p.uint256}, ),
    increaseRelativeCap: fun("0x2438525b", "increaseRelativeCap(bytes,uint256)", {"idData": p.bytes, "newRelativeCap": p.uint256}, ),
    increaseTimelock: fun("0x47966291", "increaseTimelock(bytes4,uint256)", {"selector": p.bytes4, "newDuration": p.uint256}, ),
    isAdapter: viewFun("0x68c18beb", "isAdapter(address)", {"account": p.address}, p.bool),
    isAllocator: viewFun("0x4dedf20e", "isAllocator(address)", {"account": p.address}, p.bool),
    isSentinel: viewFun("0xba03a75f", "isSentinel(address)", {"account": p.address}, p.bool),
    lastUpdate: viewFun("0xc0463711", "lastUpdate()", {}, p.uint64),
    liquidityAdapter: viewFun("0xad468d11", "liquidityAdapter()", {}, p.address),
    liquidityData: viewFun("0x2e029228", "liquidityData()", {}, p.bytes),
    managementFee: viewFun("0xa6f7f5d6", "managementFee()", {}, p.uint96),
    managementFeeRecipient: viewFun("0x6d9a3010", "managementFeeRecipient()", {}, p.address),
    maxDeposit: viewFun("0x402d267d", "maxDeposit(address)", {"_0": p.address}, p.uint256),
    maxMint: viewFun("0xc63d75b6", "maxMint(address)", {"_0": p.address}, p.uint256),
    maxRate: viewFun("0xece1d6e5", "maxRate()", {}, p.uint64),
    maxRedeem: viewFun("0xd905777e", "maxRedeem(address)", {"_0": p.address}, p.uint256),
    maxWithdraw: viewFun("0xce96cb77", "maxWithdraw(address)", {"_0": p.address}, p.uint256),
    mint: fun("0x94bf804d", "mint(uint256,address)", {"shares": p.uint256, "onBehalf": p.address}, p.uint256),
    multicall: fun("0xac9650d8", "multicall(bytes[])", {"data": p.array(p.bytes)}, ),
    name: viewFun("0x06fdde03", "name()", {}, p.string),
    nonces: viewFun("0x7ecebe00", "nonces(address)", {"account": p.address}, p.uint256),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    performanceFee: viewFun("0x87788782", "performanceFee()", {}, p.uint96),
    performanceFeeRecipient: viewFun("0xed27f7c9", "performanceFeeRecipient()", {}, p.address),
    permit: fun("0xd505accf", "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)", {"_owner": p.address, "spender": p.address, "shares": p.uint256, "deadline": p.uint256, "v": p.uint8, "r": p.bytes32, "s": p.bytes32}, ),
    previewDeposit: viewFun("0xef8b30f7", "previewDeposit(uint256)", {"assets": p.uint256}, p.uint256),
    previewMint: viewFun("0xb3d7f6b9", "previewMint(uint256)", {"shares": p.uint256}, p.uint256),
    previewRedeem: viewFun("0x4cdad506", "previewRedeem(uint256)", {"shares": p.uint256}, p.uint256),
    previewWithdraw: viewFun("0x0a28a477", "previewWithdraw(uint256)", {"assets": p.uint256}, p.uint256),
    receiveAssetsGate: viewFun("0x54cde13e", "receiveAssetsGate()", {}, p.address),
    receiveSharesGate: viewFun("0x7e729ac4", "receiveSharesGate()", {}, p.address),
    redeem: fun("0xba087652", "redeem(uint256,address,address)", {"shares": p.uint256, "receiver": p.address, "onBehalf": p.address}, p.uint256),
    relativeCap: viewFun("0xa68bafa3", "relativeCap(bytes32)", {"id": p.bytes32}, p.uint256),
    removeAdapter: fun("0x585cd34b", "removeAdapter(address)", {"account": p.address}, ),
    revoke: fun("0x0b467b9b", "revoke(bytes)", {"data": p.bytes}, ),
    sendAssetsGate: viewFun("0x8eede801", "sendAssetsGate()", {}, p.address),
    sendSharesGate: viewFun("0x93ab2ab7", "sendSharesGate()", {}, p.address),
    setAdapterRegistry: fun("0x5b34b823", "setAdapterRegistry(address)", {"newAdapterRegistry": p.address}, ),
    setCurator: fun("0xe90956cf", "setCurator(address)", {"newCurator": p.address}, ),
    setForceDeallocatePenalty: fun("0x3e9d2ac7", "setForceDeallocatePenalty(address,uint256)", {"adapter": p.address, "newForceDeallocatePenalty": p.uint256}, ),
    setIsAllocator: fun("0xb192a84a", "setIsAllocator(address,bool)", {"account": p.address, "newIsAllocator": p.bool}, ),
    setIsSentinel: fun("0x920ed706", "setIsSentinel(address,bool)", {"account": p.address, "newIsSentinel": p.bool}, ),
    setLiquidityAdapterAndData: fun("0x7fb6caad", "setLiquidityAdapterAndData(address,bytes)", {"newLiquidityAdapter": p.address, "newLiquidityData": p.bytes}, ),
    setManagementFee: fun("0xfe56e232", "setManagementFee(uint256)", {"newManagementFee": p.uint256}, ),
    setManagementFeeRecipient: fun("0x9faae464", "setManagementFeeRecipient(address)", {"newManagementFeeRecipient": p.address}, ),
    setMaxRate: fun("0xaa4abe7f", "setMaxRate(uint256)", {"newMaxRate": p.uint256}, ),
    setName: fun("0xc47f0027", "setName(string)", {"newName": p.string}, ),
    setOwner: fun("0x13af4035", "setOwner(address)", {"newOwner": p.address}, ),
    setPerformanceFee: fun("0x70897b23", "setPerformanceFee(uint256)", {"newPerformanceFee": p.uint256}, ),
    setPerformanceFeeRecipient: fun("0x6a5f1aa2", "setPerformanceFeeRecipient(address)", {"newPerformanceFeeRecipient": p.address}, ),
    setReceiveAssetsGate: fun("0x04dbf0ce", "setReceiveAssetsGate(address)", {"newReceiveAssetsGate": p.address}, ),
    setReceiveSharesGate: fun("0x2cb19f98", "setReceiveSharesGate(address)", {"newReceiveSharesGate": p.address}, ),
    setSendAssetsGate: fun("0x871c979c", "setSendAssetsGate(address)", {"newSendAssetsGate": p.address}, ),
    setSendSharesGate: fun("0xc21ad028", "setSendSharesGate(address)", {"newSendSharesGate": p.address}, ),
    setSymbol: fun("0xb84c8246", "setSymbol(string)", {"newSymbol": p.string}, ),
    submit: fun("0xef7fa71b", "submit(bytes)", {"data": p.bytes}, ),
    symbol: viewFun("0x95d89b41", "symbol()", {}, p.string),
    timelock: viewFun("0xe78ab14e", "timelock(bytes4)", {"selector": p.bytes4}, p.uint256),
    totalAssets: viewFun("0x01e1d114", "totalAssets()", {}, p.uint256),
    totalSupply: viewFun("0x18160ddd", "totalSupply()", {}, p.uint256),
    transfer: fun("0xa9059cbb", "transfer(address,uint256)", {"to": p.address, "shares": p.uint256}, p.bool),
    transferFrom: fun("0x23b872dd", "transferFrom(address,address,uint256)", {"from": p.address, "to": p.address, "shares": p.uint256}, p.bool),
    virtualShares: viewFun("0xc719946c", "virtualShares()", {}, p.uint256),
    withdraw: fun("0xb460af94", "withdraw(uint256,address,address)", {"assets": p.uint256, "receiver": p.address, "onBehalf": p.address}, p.uint256),
}

export class Contract extends ContractBase {

    DOMAIN_SEPARATOR() {
        return this.eth_call(functions.DOMAIN_SEPARATOR, {})
    }

    _totalAssets() {
        return this.eth_call(functions._totalAssets, {})
    }

    abdicated(selector: AbdicatedParams["selector"]) {
        return this.eth_call(functions.abdicated, {selector})
    }

    absoluteCap(id: AbsoluteCapParams["id"]) {
        return this.eth_call(functions.absoluteCap, {id})
    }

    accrueInterestView() {
        return this.eth_call(functions.accrueInterestView, {})
    }

    adapterRegistry() {
        return this.eth_call(functions.adapterRegistry, {})
    }

    adapters(_0: AdaptersParams["_0"]) {
        return this.eth_call(functions.adapters, {_0})
    }

    adaptersLength() {
        return this.eth_call(functions.adaptersLength, {})
    }

    allocation(id: AllocationParams["id"]) {
        return this.eth_call(functions.allocation, {id})
    }

    allowance(owner: AllowanceParams["owner"], spender: AllowanceParams["spender"]) {
        return this.eth_call(functions.allowance, {owner, spender})
    }

    asset() {
        return this.eth_call(functions.asset, {})
    }

    balanceOf(account: BalanceOfParams["account"]) {
        return this.eth_call(functions.balanceOf, {account})
    }

    canReceiveAssets(account: CanReceiveAssetsParams["account"]) {
        return this.eth_call(functions.canReceiveAssets, {account})
    }

    canReceiveShares(account: CanReceiveSharesParams["account"]) {
        return this.eth_call(functions.canReceiveShares, {account})
    }

    canSendAssets(account: CanSendAssetsParams["account"]) {
        return this.eth_call(functions.canSendAssets, {account})
    }

    canSendShares(account: CanSendSharesParams["account"]) {
        return this.eth_call(functions.canSendShares, {account})
    }

    convertToAssets(shares: ConvertToAssetsParams["shares"]) {
        return this.eth_call(functions.convertToAssets, {shares})
    }

    convertToShares(assets: ConvertToSharesParams["assets"]) {
        return this.eth_call(functions.convertToShares, {assets})
    }

    curator() {
        return this.eth_call(functions.curator, {})
    }

    decimals() {
        return this.eth_call(functions.decimals, {})
    }

    executableAt(data: ExecutableAtParams["data"]) {
        return this.eth_call(functions.executableAt, {data})
    }

    firstTotalAssets() {
        return this.eth_call(functions.firstTotalAssets, {})
    }

    forceDeallocatePenalty(adapter: ForceDeallocatePenaltyParams["adapter"]) {
        return this.eth_call(functions.forceDeallocatePenalty, {adapter})
    }

    isAdapter(account: IsAdapterParams["account"]) {
        return this.eth_call(functions.isAdapter, {account})
    }

    isAllocator(account: IsAllocatorParams["account"]) {
        return this.eth_call(functions.isAllocator, {account})
    }

    isSentinel(account: IsSentinelParams["account"]) {
        return this.eth_call(functions.isSentinel, {account})
    }

    lastUpdate() {
        return this.eth_call(functions.lastUpdate, {})
    }

    liquidityAdapter() {
        return this.eth_call(functions.liquidityAdapter, {})
    }

    liquidityData() {
        return this.eth_call(functions.liquidityData, {})
    }

    managementFee() {
        return this.eth_call(functions.managementFee, {})
    }

    managementFeeRecipient() {
        return this.eth_call(functions.managementFeeRecipient, {})
    }

    maxDeposit(_0: MaxDepositParams["_0"]) {
        return this.eth_call(functions.maxDeposit, {_0})
    }

    maxMint(_0: MaxMintParams["_0"]) {
        return this.eth_call(functions.maxMint, {_0})
    }

    maxRate() {
        return this.eth_call(functions.maxRate, {})
    }

    maxRedeem(_0: MaxRedeemParams["_0"]) {
        return this.eth_call(functions.maxRedeem, {_0})
    }

    maxWithdraw(_0: MaxWithdrawParams["_0"]) {
        return this.eth_call(functions.maxWithdraw, {_0})
    }

    name() {
        return this.eth_call(functions.name, {})
    }

    nonces(account: NoncesParams["account"]) {
        return this.eth_call(functions.nonces, {account})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    performanceFee() {
        return this.eth_call(functions.performanceFee, {})
    }

    performanceFeeRecipient() {
        return this.eth_call(functions.performanceFeeRecipient, {})
    }

    previewDeposit(assets: PreviewDepositParams["assets"]) {
        return this.eth_call(functions.previewDeposit, {assets})
    }

    previewMint(shares: PreviewMintParams["shares"]) {
        return this.eth_call(functions.previewMint, {shares})
    }

    previewRedeem(shares: PreviewRedeemParams["shares"]) {
        return this.eth_call(functions.previewRedeem, {shares})
    }

    previewWithdraw(assets: PreviewWithdrawParams["assets"]) {
        return this.eth_call(functions.previewWithdraw, {assets})
    }

    receiveAssetsGate() {
        return this.eth_call(functions.receiveAssetsGate, {})
    }

    receiveSharesGate() {
        return this.eth_call(functions.receiveSharesGate, {})
    }

    relativeCap(id: RelativeCapParams["id"]) {
        return this.eth_call(functions.relativeCap, {id})
    }

    sendAssetsGate() {
        return this.eth_call(functions.sendAssetsGate, {})
    }

    sendSharesGate() {
        return this.eth_call(functions.sendSharesGate, {})
    }

    symbol() {
        return this.eth_call(functions.symbol, {})
    }

    timelock(selector: TimelockParams["selector"]) {
        return this.eth_call(functions.timelock, {selector})
    }

    totalAssets() {
        return this.eth_call(functions.totalAssets, {})
    }

    totalSupply() {
        return this.eth_call(functions.totalSupply, {})
    }

    virtualShares() {
        return this.eth_call(functions.virtualShares, {})
    }
}

/// Event types
export type AbdicateEventArgs = EParams<typeof events.Abdicate>
export type AcceptEventArgs = EParams<typeof events.Accept>
export type AccrueInterestEventArgs = EParams<typeof events.AccrueInterest>
export type AddAdapterEventArgs = EParams<typeof events.AddAdapter>
export type AllocateEventArgs = EParams<typeof events.Allocate>
export type AllowanceUpdatedByTransferFromEventArgs = EParams<typeof events.AllowanceUpdatedByTransferFrom>
export type ApprovalEventArgs = EParams<typeof events.Approval>
export type ConstructorEventArgs = EParams<typeof events.Constructor>
export type DeallocateEventArgs = EParams<typeof events.Deallocate>
export type DecreaseAbsoluteCapEventArgs = EParams<typeof events.DecreaseAbsoluteCap>
export type DecreaseRelativeCapEventArgs = EParams<typeof events.DecreaseRelativeCap>
export type DecreaseTimelockEventArgs = EParams<typeof events.DecreaseTimelock>
export type DepositEventArgs = EParams<typeof events.Deposit>
export type ForceDeallocateEventArgs = EParams<typeof events.ForceDeallocate>
export type IncreaseAbsoluteCapEventArgs = EParams<typeof events.IncreaseAbsoluteCap>
export type IncreaseRelativeCapEventArgs = EParams<typeof events.IncreaseRelativeCap>
export type IncreaseTimelockEventArgs = EParams<typeof events.IncreaseTimelock>
export type PermitEventArgs = EParams<typeof events.Permit>
export type RemoveAdapterEventArgs = EParams<typeof events.RemoveAdapter>
export type RevokeEventArgs = EParams<typeof events.Revoke>
export type SetAdapterRegistryEventArgs = EParams<typeof events.SetAdapterRegistry>
export type SetCuratorEventArgs = EParams<typeof events.SetCurator>
export type SetForceDeallocatePenaltyEventArgs = EParams<typeof events.SetForceDeallocatePenalty>
export type SetIsAllocatorEventArgs = EParams<typeof events.SetIsAllocator>
export type SetIsSentinelEventArgs = EParams<typeof events.SetIsSentinel>
export type SetLiquidityAdapterAndDataEventArgs = EParams<typeof events.SetLiquidityAdapterAndData>
export type SetManagementFeeEventArgs = EParams<typeof events.SetManagementFee>
export type SetManagementFeeRecipientEventArgs = EParams<typeof events.SetManagementFeeRecipient>
export type SetMaxRateEventArgs = EParams<typeof events.SetMaxRate>
export type SetNameEventArgs = EParams<typeof events.SetName>
export type SetOwnerEventArgs = EParams<typeof events.SetOwner>
export type SetPerformanceFeeEventArgs = EParams<typeof events.SetPerformanceFee>
export type SetPerformanceFeeRecipientEventArgs = EParams<typeof events.SetPerformanceFeeRecipient>
export type SetReceiveAssetsGateEventArgs = EParams<typeof events.SetReceiveAssetsGate>
export type SetReceiveSharesGateEventArgs = EParams<typeof events.SetReceiveSharesGate>
export type SetSendAssetsGateEventArgs = EParams<typeof events.SetSendAssetsGate>
export type SetSendSharesGateEventArgs = EParams<typeof events.SetSendSharesGate>
export type SetSymbolEventArgs = EParams<typeof events.SetSymbol>
export type SubmitEventArgs = EParams<typeof events.Submit>
export type TransferEventArgs = EParams<typeof events.Transfer>
export type WithdrawEventArgs = EParams<typeof events.Withdraw>

/// Function types
export type DOMAIN_SEPARATORParams = FunctionArguments<typeof functions.DOMAIN_SEPARATOR>
export type DOMAIN_SEPARATORReturn = FunctionReturn<typeof functions.DOMAIN_SEPARATOR>

export type _totalAssetsParams = FunctionArguments<typeof functions._totalAssets>
export type _totalAssetsReturn = FunctionReturn<typeof functions._totalAssets>

export type AbdicateParams = FunctionArguments<typeof functions.abdicate>
export type AbdicateReturn = FunctionReturn<typeof functions.abdicate>

export type AbdicatedParams = FunctionArguments<typeof functions.abdicated>
export type AbdicatedReturn = FunctionReturn<typeof functions.abdicated>

export type AbsoluteCapParams = FunctionArguments<typeof functions.absoluteCap>
export type AbsoluteCapReturn = FunctionReturn<typeof functions.absoluteCap>

export type AccrueInterestParams = FunctionArguments<typeof functions.accrueInterest>
export type AccrueInterestReturn = FunctionReturn<typeof functions.accrueInterest>

export type AccrueInterestViewParams = FunctionArguments<typeof functions.accrueInterestView>
export type AccrueInterestViewReturn = FunctionReturn<typeof functions.accrueInterestView>

export type AdapterRegistryParams = FunctionArguments<typeof functions.adapterRegistry>
export type AdapterRegistryReturn = FunctionReturn<typeof functions.adapterRegistry>

export type AdaptersParams = FunctionArguments<typeof functions.adapters>
export type AdaptersReturn = FunctionReturn<typeof functions.adapters>

export type AdaptersLengthParams = FunctionArguments<typeof functions.adaptersLength>
export type AdaptersLengthReturn = FunctionReturn<typeof functions.adaptersLength>

export type AddAdapterParams = FunctionArguments<typeof functions.addAdapter>
export type AddAdapterReturn = FunctionReturn<typeof functions.addAdapter>

export type AllocateParams = FunctionArguments<typeof functions.allocate>
export type AllocateReturn = FunctionReturn<typeof functions.allocate>

export type AllocationParams = FunctionArguments<typeof functions.allocation>
export type AllocationReturn = FunctionReturn<typeof functions.allocation>

export type AllowanceParams = FunctionArguments<typeof functions.allowance>
export type AllowanceReturn = FunctionReturn<typeof functions.allowance>

export type ApproveParams = FunctionArguments<typeof functions.approve>
export type ApproveReturn = FunctionReturn<typeof functions.approve>

export type AssetParams = FunctionArguments<typeof functions.asset>
export type AssetReturn = FunctionReturn<typeof functions.asset>

export type BalanceOfParams = FunctionArguments<typeof functions.balanceOf>
export type BalanceOfReturn = FunctionReturn<typeof functions.balanceOf>

export type CanReceiveAssetsParams = FunctionArguments<typeof functions.canReceiveAssets>
export type CanReceiveAssetsReturn = FunctionReturn<typeof functions.canReceiveAssets>

export type CanReceiveSharesParams = FunctionArguments<typeof functions.canReceiveShares>
export type CanReceiveSharesReturn = FunctionReturn<typeof functions.canReceiveShares>

export type CanSendAssetsParams = FunctionArguments<typeof functions.canSendAssets>
export type CanSendAssetsReturn = FunctionReturn<typeof functions.canSendAssets>

export type CanSendSharesParams = FunctionArguments<typeof functions.canSendShares>
export type CanSendSharesReturn = FunctionReturn<typeof functions.canSendShares>

export type ConvertToAssetsParams = FunctionArguments<typeof functions.convertToAssets>
export type ConvertToAssetsReturn = FunctionReturn<typeof functions.convertToAssets>

export type ConvertToSharesParams = FunctionArguments<typeof functions.convertToShares>
export type ConvertToSharesReturn = FunctionReturn<typeof functions.convertToShares>

export type CuratorParams = FunctionArguments<typeof functions.curator>
export type CuratorReturn = FunctionReturn<typeof functions.curator>

export type DeallocateParams = FunctionArguments<typeof functions.deallocate>
export type DeallocateReturn = FunctionReturn<typeof functions.deallocate>

export type DecimalsParams = FunctionArguments<typeof functions.decimals>
export type DecimalsReturn = FunctionReturn<typeof functions.decimals>

export type DecreaseAbsoluteCapParams = FunctionArguments<typeof functions.decreaseAbsoluteCap>
export type DecreaseAbsoluteCapReturn = FunctionReturn<typeof functions.decreaseAbsoluteCap>

export type DecreaseRelativeCapParams = FunctionArguments<typeof functions.decreaseRelativeCap>
export type DecreaseRelativeCapReturn = FunctionReturn<typeof functions.decreaseRelativeCap>

export type DecreaseTimelockParams = FunctionArguments<typeof functions.decreaseTimelock>
export type DecreaseTimelockReturn = FunctionReturn<typeof functions.decreaseTimelock>

export type DepositParams = FunctionArguments<typeof functions.deposit>
export type DepositReturn = FunctionReturn<typeof functions.deposit>

export type ExecutableAtParams = FunctionArguments<typeof functions.executableAt>
export type ExecutableAtReturn = FunctionReturn<typeof functions.executableAt>

export type FirstTotalAssetsParams = FunctionArguments<typeof functions.firstTotalAssets>
export type FirstTotalAssetsReturn = FunctionReturn<typeof functions.firstTotalAssets>

export type ForceDeallocateParams = FunctionArguments<typeof functions.forceDeallocate>
export type ForceDeallocateReturn = FunctionReturn<typeof functions.forceDeallocate>

export type ForceDeallocatePenaltyParams = FunctionArguments<typeof functions.forceDeallocatePenalty>
export type ForceDeallocatePenaltyReturn = FunctionReturn<typeof functions.forceDeallocatePenalty>

export type IncreaseAbsoluteCapParams = FunctionArguments<typeof functions.increaseAbsoluteCap>
export type IncreaseAbsoluteCapReturn = FunctionReturn<typeof functions.increaseAbsoluteCap>

export type IncreaseRelativeCapParams = FunctionArguments<typeof functions.increaseRelativeCap>
export type IncreaseRelativeCapReturn = FunctionReturn<typeof functions.increaseRelativeCap>

export type IncreaseTimelockParams = FunctionArguments<typeof functions.increaseTimelock>
export type IncreaseTimelockReturn = FunctionReturn<typeof functions.increaseTimelock>

export type IsAdapterParams = FunctionArguments<typeof functions.isAdapter>
export type IsAdapterReturn = FunctionReturn<typeof functions.isAdapter>

export type IsAllocatorParams = FunctionArguments<typeof functions.isAllocator>
export type IsAllocatorReturn = FunctionReturn<typeof functions.isAllocator>

export type IsSentinelParams = FunctionArguments<typeof functions.isSentinel>
export type IsSentinelReturn = FunctionReturn<typeof functions.isSentinel>

export type LastUpdateParams = FunctionArguments<typeof functions.lastUpdate>
export type LastUpdateReturn = FunctionReturn<typeof functions.lastUpdate>

export type LiquidityAdapterParams = FunctionArguments<typeof functions.liquidityAdapter>
export type LiquidityAdapterReturn = FunctionReturn<typeof functions.liquidityAdapter>

export type LiquidityDataParams = FunctionArguments<typeof functions.liquidityData>
export type LiquidityDataReturn = FunctionReturn<typeof functions.liquidityData>

export type ManagementFeeParams = FunctionArguments<typeof functions.managementFee>
export type ManagementFeeReturn = FunctionReturn<typeof functions.managementFee>

export type ManagementFeeRecipientParams = FunctionArguments<typeof functions.managementFeeRecipient>
export type ManagementFeeRecipientReturn = FunctionReturn<typeof functions.managementFeeRecipient>

export type MaxDepositParams = FunctionArguments<typeof functions.maxDeposit>
export type MaxDepositReturn = FunctionReturn<typeof functions.maxDeposit>

export type MaxMintParams = FunctionArguments<typeof functions.maxMint>
export type MaxMintReturn = FunctionReturn<typeof functions.maxMint>

export type MaxRateParams = FunctionArguments<typeof functions.maxRate>
export type MaxRateReturn = FunctionReturn<typeof functions.maxRate>

export type MaxRedeemParams = FunctionArguments<typeof functions.maxRedeem>
export type MaxRedeemReturn = FunctionReturn<typeof functions.maxRedeem>

export type MaxWithdrawParams = FunctionArguments<typeof functions.maxWithdraw>
export type MaxWithdrawReturn = FunctionReturn<typeof functions.maxWithdraw>

export type MintParams = FunctionArguments<typeof functions.mint>
export type MintReturn = FunctionReturn<typeof functions.mint>

export type MulticallParams = FunctionArguments<typeof functions.multicall>
export type MulticallReturn = FunctionReturn<typeof functions.multicall>

export type NameParams = FunctionArguments<typeof functions.name>
export type NameReturn = FunctionReturn<typeof functions.name>

export type NoncesParams = FunctionArguments<typeof functions.nonces>
export type NoncesReturn = FunctionReturn<typeof functions.nonces>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type PerformanceFeeParams = FunctionArguments<typeof functions.performanceFee>
export type PerformanceFeeReturn = FunctionReturn<typeof functions.performanceFee>

export type PerformanceFeeRecipientParams = FunctionArguments<typeof functions.performanceFeeRecipient>
export type PerformanceFeeRecipientReturn = FunctionReturn<typeof functions.performanceFeeRecipient>

export type PermitParams = FunctionArguments<typeof functions.permit>
export type PermitReturn = FunctionReturn<typeof functions.permit>

export type PreviewDepositParams = FunctionArguments<typeof functions.previewDeposit>
export type PreviewDepositReturn = FunctionReturn<typeof functions.previewDeposit>

export type PreviewMintParams = FunctionArguments<typeof functions.previewMint>
export type PreviewMintReturn = FunctionReturn<typeof functions.previewMint>

export type PreviewRedeemParams = FunctionArguments<typeof functions.previewRedeem>
export type PreviewRedeemReturn = FunctionReturn<typeof functions.previewRedeem>

export type PreviewWithdrawParams = FunctionArguments<typeof functions.previewWithdraw>
export type PreviewWithdrawReturn = FunctionReturn<typeof functions.previewWithdraw>

export type ReceiveAssetsGateParams = FunctionArguments<typeof functions.receiveAssetsGate>
export type ReceiveAssetsGateReturn = FunctionReturn<typeof functions.receiveAssetsGate>

export type ReceiveSharesGateParams = FunctionArguments<typeof functions.receiveSharesGate>
export type ReceiveSharesGateReturn = FunctionReturn<typeof functions.receiveSharesGate>

export type RedeemParams = FunctionArguments<typeof functions.redeem>
export type RedeemReturn = FunctionReturn<typeof functions.redeem>

export type RelativeCapParams = FunctionArguments<typeof functions.relativeCap>
export type RelativeCapReturn = FunctionReturn<typeof functions.relativeCap>

export type RemoveAdapterParams = FunctionArguments<typeof functions.removeAdapter>
export type RemoveAdapterReturn = FunctionReturn<typeof functions.removeAdapter>

export type RevokeParams = FunctionArguments<typeof functions.revoke>
export type RevokeReturn = FunctionReturn<typeof functions.revoke>

export type SendAssetsGateParams = FunctionArguments<typeof functions.sendAssetsGate>
export type SendAssetsGateReturn = FunctionReturn<typeof functions.sendAssetsGate>

export type SendSharesGateParams = FunctionArguments<typeof functions.sendSharesGate>
export type SendSharesGateReturn = FunctionReturn<typeof functions.sendSharesGate>

export type SetAdapterRegistryParams = FunctionArguments<typeof functions.setAdapterRegistry>
export type SetAdapterRegistryReturn = FunctionReturn<typeof functions.setAdapterRegistry>

export type SetCuratorParams = FunctionArguments<typeof functions.setCurator>
export type SetCuratorReturn = FunctionReturn<typeof functions.setCurator>

export type SetForceDeallocatePenaltyParams = FunctionArguments<typeof functions.setForceDeallocatePenalty>
export type SetForceDeallocatePenaltyReturn = FunctionReturn<typeof functions.setForceDeallocatePenalty>

export type SetIsAllocatorParams = FunctionArguments<typeof functions.setIsAllocator>
export type SetIsAllocatorReturn = FunctionReturn<typeof functions.setIsAllocator>

export type SetIsSentinelParams = FunctionArguments<typeof functions.setIsSentinel>
export type SetIsSentinelReturn = FunctionReturn<typeof functions.setIsSentinel>

export type SetLiquidityAdapterAndDataParams = FunctionArguments<typeof functions.setLiquidityAdapterAndData>
export type SetLiquidityAdapterAndDataReturn = FunctionReturn<typeof functions.setLiquidityAdapterAndData>

export type SetManagementFeeParams = FunctionArguments<typeof functions.setManagementFee>
export type SetManagementFeeReturn = FunctionReturn<typeof functions.setManagementFee>

export type SetManagementFeeRecipientParams = FunctionArguments<typeof functions.setManagementFeeRecipient>
export type SetManagementFeeRecipientReturn = FunctionReturn<typeof functions.setManagementFeeRecipient>

export type SetMaxRateParams = FunctionArguments<typeof functions.setMaxRate>
export type SetMaxRateReturn = FunctionReturn<typeof functions.setMaxRate>

export type SetNameParams = FunctionArguments<typeof functions.setName>
export type SetNameReturn = FunctionReturn<typeof functions.setName>

export type SetOwnerParams = FunctionArguments<typeof functions.setOwner>
export type SetOwnerReturn = FunctionReturn<typeof functions.setOwner>

export type SetPerformanceFeeParams = FunctionArguments<typeof functions.setPerformanceFee>
export type SetPerformanceFeeReturn = FunctionReturn<typeof functions.setPerformanceFee>

export type SetPerformanceFeeRecipientParams = FunctionArguments<typeof functions.setPerformanceFeeRecipient>
export type SetPerformanceFeeRecipientReturn = FunctionReturn<typeof functions.setPerformanceFeeRecipient>

export type SetReceiveAssetsGateParams = FunctionArguments<typeof functions.setReceiveAssetsGate>
export type SetReceiveAssetsGateReturn = FunctionReturn<typeof functions.setReceiveAssetsGate>

export type SetReceiveSharesGateParams = FunctionArguments<typeof functions.setReceiveSharesGate>
export type SetReceiveSharesGateReturn = FunctionReturn<typeof functions.setReceiveSharesGate>

export type SetSendAssetsGateParams = FunctionArguments<typeof functions.setSendAssetsGate>
export type SetSendAssetsGateReturn = FunctionReturn<typeof functions.setSendAssetsGate>

export type SetSendSharesGateParams = FunctionArguments<typeof functions.setSendSharesGate>
export type SetSendSharesGateReturn = FunctionReturn<typeof functions.setSendSharesGate>

export type SetSymbolParams = FunctionArguments<typeof functions.setSymbol>
export type SetSymbolReturn = FunctionReturn<typeof functions.setSymbol>

export type SubmitParams = FunctionArguments<typeof functions.submit>
export type SubmitReturn = FunctionReturn<typeof functions.submit>

export type SymbolParams = FunctionArguments<typeof functions.symbol>
export type SymbolReturn = FunctionReturn<typeof functions.symbol>

export type TimelockParams = FunctionArguments<typeof functions.timelock>
export type TimelockReturn = FunctionReturn<typeof functions.timelock>

export type TotalAssetsParams = FunctionArguments<typeof functions.totalAssets>
export type TotalAssetsReturn = FunctionReturn<typeof functions.totalAssets>

export type TotalSupplyParams = FunctionArguments<typeof functions.totalSupply>
export type TotalSupplyReturn = FunctionReturn<typeof functions.totalSupply>

export type TransferParams = FunctionArguments<typeof functions.transfer>
export type TransferReturn = FunctionReturn<typeof functions.transfer>

export type TransferFromParams = FunctionArguments<typeof functions.transferFrom>
export type TransferFromReturn = FunctionReturn<typeof functions.transferFrom>

export type VirtualSharesParams = FunctionArguments<typeof functions.virtualShares>
export type VirtualSharesReturn = FunctionReturn<typeof functions.virtualShares>

export type WithdrawParams = FunctionArguments<typeof functions.withdraw>
export type WithdrawReturn = FunctionReturn<typeof functions.withdraw>

