import {Codec, address, array, binary, bool, fixedArray, option, struct, sum, tuple, u128, u16, u32, u64, u8, unit} from '@subsquid/borsh'

export interface BaseFeeConfig {
    cliffFeeNumerator: bigint
    secondFactor: bigint
    thirdFactor: bigint
    firstFactor: number
    baseFeeMode: number
    padding0: Array<number>
}

export const BaseFeeConfig: Codec<BaseFeeConfig> = struct({
    cliffFeeNumerator: u64,
    secondFactor: u64,
    thirdFactor: u64,
    firstFactor: u16,
    baseFeeMode: u8,
    padding0: fixedArray(u8, 5),
})

/**
 * Represents basis points (bps) as a wrapper around a `u16`.
 * 1 bps = 0.01%
 * 10_000 bps = 100%
 */
export type Bps = [
    number,
]

/**
 * Represents basis points (bps) as a wrapper around a `u16`.
 * 1 bps = 0.01%
 * 10_000 bps = 100%
 */
export const Bps: Codec<Bps> = tuple([
    u16,
])

/**
 * Stores the protocol version that the telecoin was created with.
 */
export type PrintrProtocolVersion = [
    number,
]

/**
 * Stores the protocol version that the telecoin was created with.
 */
export const PrintrProtocolVersion: Codec<PrintrProtocolVersion> = tuple([
    u8,
])

/**
 * Printr's Token ID is a hash of the ABI-encoded telecoin params.
 */
export type TelecoinId = [
    Array<number>,
]

/**
 * Printr's Token ID is a hash of the ABI-encoded telecoin params.
 */
export const TelecoinId: Codec<TelecoinId> = tuple([
    fixedArray(u8, 32),
])

/**
 * Some Printr related details about the deploy.
 */
export interface DeployTelecoinEvent {
    protocolVersion: PrintrProtocolVersion
    telecoinId: TelecoinId
    devOnSolana: string
}

/**
 * Some Printr related details about the deploy.
 */
export const DeployTelecoinEvent: Codec<DeployTelecoinEvent> = struct({
    protocolVersion: PrintrProtocolVersion,
    telecoinId: TelecoinId,
    devOnSolana: address,
})

/**
 * A token amount in its smallest denomination as seen in a token account.
 */
export interface TokenAmount {
    amount: bigint
}

/**
 * A token amount in its smallest denomination as seen in a token account.
 */
export const TokenAmount: Codec<TokenAmount> = struct({
    amount: u64,
})

/**
 * Configuration for a dev of a telecoin token.
 */
export interface DevConfig {
    devWallet: string
    protocolVersion: PrintrProtocolVersion
    telecoinId: TelecoinId
    devQuoteFee: TokenAmount
    _padding: Array<number>
}

/**
 * Configuration for a dev of a telecoin token.
 */
export const DevConfig: Codec<DevConfig> = struct({
    devWallet: address,
    protocolVersion: PrintrProtocolVersion,
    telecoinId: TelecoinId,
    devQuoteFee: TokenAmount,
    _padding: fixedArray(u8, 8),
})

export interface DynamicFeeConfig {
    initialized: number
    padding: Array<number>
    maxVolatilityAccumulator: number
    variableFeeControl: number
    binStep: number
    filterPeriod: number
    decayPeriod: number
    reductionFactor: number
    padding2: Array<number>
    binStepU128: bigint
}

export const DynamicFeeConfig: Codec<DynamicFeeConfig> = struct({
    initialized: u8,
    padding: fixedArray(u8, 7),
    maxVolatilityAccumulator: u32,
    variableFeeControl: u32,
    binStep: u16,
    filterPeriod: u16,
    decayPeriod: u16,
    reductionFactor: u16,
    padding2: fixedArray(u8, 8),
    binStepU128: u128,
})

/**
 * This is a sqrt and bitshifted price ready to be compared to Meteora prices.
 */
export interface SqrtBitshiftedPrice {
    price: bigint
}

/**
 * This is a sqrt and bitshifted price ready to be compared to Meteora prices.
 */
export const SqrtBitshiftedPrice: Codec<SqrtBitshiftedPrice> = struct({
    price: u128,
})

export interface SwapEstimate {
    actualInput: TokenAmount
    inputFee: TokenAmount
    outputFee: TokenAmount
    output: TokenAmount
    nextPrice: SqrtBitshiftedPrice
    currentPrice: SqrtBitshiftedPrice
}

export const SwapEstimate: Codec<SwapEstimate> = struct({
    actualInput: TokenAmount,
    inputFee: TokenAmount,
    outputFee: TokenAmount,
    output: TokenAmount,
    nextPrice: SqrtBitshiftedPrice,
    currentPrice: SqrtBitshiftedPrice,
})

/**
 * This is the returned value from this ix.
 */
export interface EstimateSwapOutput {
    estimate: SwapEstimate
    whichRemainingAccountsAreOwnedBySystemProgram: Array<boolean>
}

/**
 * This is the returned value from this ix.
 */
export const EstimateSwapOutput: Codec<EstimateSwapOutput> = struct({
    estimate: SwapEstimate,
    whichRemainingAccountsAreOwnedBySystemProgram: array(bool),
})

/**
 * Parameters for the [TeleportWithLz] instruction.
 */
export interface EstimateTeleportWithLzParams {
    messageLen: number
    lzOptions: Uint8Array
    lzDestinationEndpointId: number
}

/**
 * Parameters for the [TeleportWithLz] instruction.
 */
export const EstimateTeleportWithLzParams: Codec<EstimateTeleportWithLzParams> = struct({
    messageLen: u16,
    lzOptions: binary,
    lzDestinationEndpointId: u32,
})

/**
 * Fee claiming endpoints return how much fees were claimed - in total - for each token.
 */
export interface FeesClaimed {
    inTelecoin: TokenAmount
    inQuote: TokenAmount
}

/**
 * Fee claiming endpoints return how much fees were claimed - in total - for each token.
 */
export const FeesClaimed: Codec<FeesClaimed> = struct({
    inTelecoin: TokenAmount,
    inQuote: TokenAmount,
})

export interface LiquidityDistributionConfig {
    sqrtPrice: bigint
    liquidity: bigint
}

export const LiquidityDistributionConfig: Codec<LiquidityDistributionConfig> = struct({
    sqrtPrice: u128,
    liquidity: u128,
})

export interface LockedVestingConfig {
    amountPerPeriod: bigint
    cliffDurationFromMigrationTime: bigint
    frequency: bigint
    numberOfPeriod: bigint
    cliffUnlockAmount: bigint
    _padding: bigint
}

export const LockedVestingConfig: Codec<LockedVestingConfig> = struct({
    amountPerPeriod: u64,
    cliffDurationFromMigrationTime: u64,
    frequency: u64,
    numberOfPeriod: u64,
    cliffUnlockAmount: u64,
    _padding: u64,
})

/**
 * same to anchor_lang::prelude::AccountMeta
 */
export interface LzAccount {
    pubkey: string
    isSigner: boolean
    isWritable: boolean
}

/**
 * same to anchor_lang::prelude::AccountMeta
 */
export const LzAccount: Codec<LzAccount> = struct({
    pubkey: address,
    isSigner: bool,
    isWritable: bool,
})

export interface LzReceiveParams {
    srcEid: number
    sender: Array<number>
    nonce: bigint
    guid: Array<number>
    message: Uint8Array
    extraData: Uint8Array
}

export const LzReceiveParams: Codec<LzReceiveParams> = struct({
    srcEid: u32,
    sender: fixedArray(u8, 32),
    nonce: u64,
    guid: fixedArray(u8, 32),
    message: binary,
    extraData: binary,
})

/**
 * A peer in omnichain network is a connection living on another chain,
 * typically a smart contract.
 * 
 * A peer is authorized by the Printr staff to send and receive messages
 * authoritatively.
 * This suggests a reciprocal relationship between the two peers.
 * 
 * To trust a message we must validate that it was sent by a peer.
 * Validation is done by relaying networks such as Axelar or LayerZero.
 * Acts as a connection to another chain.
 */
export interface Peer {
    bump: number
    address: Array<number>
    isLzEnabled: boolean
    isLzDefault: boolean
}

/**
 * A peer in omnichain network is a connection living on another chain,
 * typically a smart contract.
 * 
 * A peer is authorized by the Printr staff to send and receive messages
 * authoritatively.
 * This suggests a reciprocal relationship between the two peers.
 * 
 * To trust a message we must validate that it was sent by a peer.
 * Validation is done by relaying networks such as Axelar or LayerZero.
 * Acts as a connection to another chain.
 */
export const Peer: Codec<Peer> = struct({
    bump: u8,
    address: fixedArray(u8, 32),
    isLzEnabled: bool,
    isLzDefault: bool,
})

export interface PoolFeesConfig {
    baseFee: BaseFeeConfig
    dynamicFee: DynamicFeeConfig
    padding0: Array<bigint>
    padding1: Array<number>
    protocolFeePercent: number
    referralFeePercent: number
}

export const PoolFeesConfig: Codec<PoolFeesConfig> = struct({
    baseFee: BaseFeeConfig,
    dynamicFee: DynamicFeeConfig,
    padding0: fixedArray(u64, 5),
    padding1: fixedArray(u8, 6),
    protocolFeePercent: u8,
    referralFeePercent: u8,
})

export interface PoolConfig {
    quoteMint: string
    feeClaimer: string
    leftoverReceiver: string
    poolFees: PoolFeesConfig
    collectFeeMode: number
    migrationOption: number
    activationType: number
    tokenDecimal: number
    version: number
    tokenType: number
    quoteTokenFlag: number
    partnerLockedLpPercentage: number
    partnerLpPercentage: number
    creatorLockedLpPercentage: number
    creatorLpPercentage: number
    migrationFeeOption: number
    fixedTokenSupplyFlag: number
    creatorTradingFeePercentage: number
    tokenUpdateAuthority: number
    migrationFeePercentage: number
    creatorMigrationFeePercentage: number
    _padding0: Array<number>
    swapBaseAmount: bigint
    migrationQuoteThreshold: bigint
    migrationBaseThreshold: bigint
    migrationSqrtPrice: bigint
    lockedVestingConfig: LockedVestingConfig
    preMigrationTokenSupply: bigint
    postMigrationTokenSupply: bigint
    migratedCollectFeeMode: number
    migratedDynamicFee: number
    migratedPoolFeeBps: number
    _padding1: Array<number>
    _padding2: bigint
    sqrtStartPrice: bigint
    curve: Array<LiquidityDistributionConfig>
}

export const PoolConfig: Codec<PoolConfig> = struct({
    quoteMint: address,
    feeClaimer: address,
    leftoverReceiver: address,
    poolFees: PoolFeesConfig,
    collectFeeMode: u8,
    migrationOption: u8,
    activationType: u8,
    tokenDecimal: u8,
    version: u8,
    tokenType: u8,
    quoteTokenFlag: u8,
    partnerLockedLpPercentage: u8,
    partnerLpPercentage: u8,
    creatorLockedLpPercentage: u8,
    creatorLpPercentage: u8,
    migrationFeeOption: u8,
    fixedTokenSupplyFlag: u8,
    creatorTradingFeePercentage: u8,
    tokenUpdateAuthority: u8,
    migrationFeePercentage: u8,
    creatorMigrationFeePercentage: u8,
    _padding0: fixedArray(u8, 7),
    swapBaseAmount: u64,
    migrationQuoteThreshold: u64,
    migrationBaseThreshold: u64,
    migrationSqrtPrice: u128,
    lockedVestingConfig: LockedVestingConfig,
    preMigrationTokenSupply: u64,
    postMigrationTokenSupply: u64,
    migratedCollectFeeMode: u8,
    migratedDynamicFee: u8,
    migratedPoolFeeBps: u16,
    _padding1: fixedArray(u8, 12),
    _padding2: u128,
    sqrtStartPrice: u128,
    curve: fixedArray(LiquidityDistributionConfig, 20),
})

export interface PoolMetrics {
    totalProtocolBaseFee: bigint
    totalProtocolQuoteFee: bigint
    totalTradingBaseFee: bigint
    totalTradingQuoteFee: bigint
}

export const PoolMetrics: Codec<PoolMetrics> = struct({
    totalProtocolBaseFee: u64,
    totalProtocolQuoteFee: u64,
    totalTradingBaseFee: u64,
    totalTradingQuoteFee: u64,
})

/**
 * Some Printr related details about the launch on top of meteora events.
 */
export interface PrintTelecoinEvent {
    protocolVersion: PrintrProtocolVersion
    telecoinId: TelecoinId
    quoteMint: string
    devOnSolana: string
}

/**
 * Some Printr related details about the launch on top of meteora events.
 */
export const PrintTelecoinEvent: Codec<PrintTelecoinEvent> = struct({
    protocolVersion: PrintrProtocolVersion,
    telecoinId: TelecoinId,
    quoteMint: address,
    devOnSolana: address,
})

/**
 * Configuration struct holding the public keys for various Printr program wallets.
 * 
 * BPS shares must add to 100%.
 * 
 * # Fields
 * - `growth_fund_authority`: Public key for the growth fund wallet.
 * - `buyback_authority`: Public key for the buyback wallet.
 * - `team_treasury_authority`: Public key for the team treasury wallet.
 * - `staking_authority`: Public key for the staking wallet which collects telecoin fees.
 * 
 * # Authority
 * 
 * This account is an authority over several token account vaults that hold protocol and dev fees.
 */
export interface PrintrConfig {
    growthFundAuthority: string
    buybackAuthority: string
    teamTreasuryAuthority: string
    stakingAuthority: string
    growthFundShare: Bps
    buybackShare: Bps
    teamTreasuryShare: Bps
    devShare: Bps
    _padding: Array<number>
}

/**
 * Configuration struct holding the public keys for various Printr program wallets.
 * 
 * BPS shares must add to 100%.
 * 
 * # Fields
 * - `growth_fund_authority`: Public key for the growth fund wallet.
 * - `buyback_authority`: Public key for the buyback wallet.
 * - `team_treasury_authority`: Public key for the team treasury wallet.
 * - `staking_authority`: Public key for the staking wallet which collects telecoin fees.
 * 
 * # Authority
 * 
 * This account is an authority over several token account vaults that hold protocol and dev fees.
 */
export const PrintrConfig: Codec<PrintrConfig> = struct({
    growthFundAuthority: address,
    buybackAuthority: address,
    teamTreasuryAuthority: address,
    stakingAuthority: address,
    growthFundShare: Bps,
    buybackShare: Bps,
    teamTreasuryShare: Bps,
    devShare: Bps,
    _padding: fixedArray(u8, 2),
})

/**
 * BPS shares that must add up to 10_000.
 */
export interface PrintrConfigParams {
    devShare: Bps
    growthFundShare: Bps
    buybackShare: Bps
    teamTreasuryShare: Bps
}

/**
 * BPS shares that must add up to 10_000.
 */
export const PrintrConfigParams: Codec<PrintrConfigParams> = struct({
    devShare: Bps,
    growthFundShare: Bps,
    buybackShare: Bps,
    teamTreasuryShare: Bps,
})

/**
 * Parameters for the [SetPeerConf] instruction.
 */
export interface SetPeerConfParams {
    enableLz?: boolean | undefined
    setAsDefault?: boolean | undefined
}

/**
 * Parameters for the [SetPeerConf] instruction.
 */
export const SetPeerConfParams: Codec<SetPeerConfParams> = struct({
    enableLz: option(bool),
    setAsDefault: option(bool),
})

export type TeleportPathConfig_Default = undefined

export const TeleportPathConfig_Default = unit

export type TeleportPathConfig_Disabled = undefined

export const TeleportPathConfig_Disabled = unit

export type TeleportPathConfig_Peers = {
    /**
     * This peer can be used for teleports in any direction: mint and burn.
     */
    teleportAnyDirection1: string
    /**
     * This peer can be used for teleports in any direction: mint and burn.
     */
    teleportAnyDirection2: string
    /**
     * This peer can be used for teleports in only: mint
     */
    teleportInOnly: string
}

export const TeleportPathConfig_Peers = struct({
    /**
     * This peer can be used for teleports in any direction: mint and burn.
     */
    teleportAnyDirection1: address,
    /**
     * This peer can be used for teleports in any direction: mint and burn.
     */
    teleportAnyDirection2: address,
    /**
     * This peer can be used for teleports in only: mint
     */
    teleportInOnly: address,
})

/**
 * Defines how teleports should be handled.
 */
export type TeleportPathConfig = 
    | {
        kind: 'Default'
        value?: TeleportPathConfig_Default
      }
    | {
        kind: 'Disabled'
        value?: TeleportPathConfig_Disabled
      }
    | {
        kind: 'Peers'
        value: TeleportPathConfig_Peers
      }

/**
 * Defines how teleports should be handled.
 */
export const TeleportPathConfig: Codec<TeleportPathConfig> = sum(1, {
    Default: {
        discriminator: 0,
        value: TeleportPathConfig_Default,
    },
    Disabled: {
        discriminator: 1,
        value: TeleportPathConfig_Disabled,
    },
    Peers: {
        discriminator: 2,
        value: TeleportPathConfig_Peers,
    },
})

/**
 * Parameters for the [SetTelecoinTeleportConf] instruction.
 */
export interface SetTelecoinTeleportConfParams {
    setLzPeerConfig?: TeleportPathConfig | undefined
}

/**
 * Parameters for the [SetTelecoinTeleportConf] instruction.
 */
export const SetTelecoinTeleportConfParams: Codec<SetTelecoinTeleportConfParams> = struct({
    setLzPeerConfig: option(TeleportPathConfig),
})

export type SwapIntent_SpendQuote = {
    /**
     * Quote amount
     */
    sell: TokenAmount
    /**
     * In Printr we apply slippage to price.
     */
    maxPrice: SqrtBitshiftedPrice
}

export const SwapIntent_SpendQuote = struct({
    /**
     * Quote amount
     */
    sell: TokenAmount,
    /**
     * In Printr we apply slippage to price.
     */
    maxPrice: SqrtBitshiftedPrice,
})

export type SwapIntent_SellTelecoin = {
    /**
     * telecoin amount
     */
    sell: TokenAmount
    /**
     * In Printr we apply slippage to price.
     */
    minPrice: SqrtBitshiftedPrice
}

export const SwapIntent_SellTelecoin = struct({
    /**
     * telecoin amount
     */
    sell: TokenAmount,
    /**
     * In Printr we apply slippage to price.
     */
    minPrice: SqrtBitshiftedPrice,
})

export type SwapIntent_SpendAllQuote = {
    /**
     * Must be equal to [printr_sdk::consts::SPEND_ALL_SPECIAL_VALUE].
     */
    specialValue: bigint
    /**
     * In Printr we apply slippage to price.
     */
    maxPrice: SqrtBitshiftedPrice
}

export const SwapIntent_SpendAllQuote = struct({
    /**
     * Must be equal to [printr_sdk::consts::SPEND_ALL_SPECIAL_VALUE].
     */
    specialValue: u64,
    /**
     * In Printr we apply slippage to price.
     */
    maxPrice: SqrtBitshiftedPrice,
})

/**
 * Represents user's intent to swap tokens in Printr ecosystem.
 * We translate this intent to specific Meteora CPIs.
 */
export type SwapIntent = 
    | {
        kind: 'SpendQuote'
        value: SwapIntent_SpendQuote
      }
    | {
        kind: 'SellTelecoin'
        value: SwapIntent_SellTelecoin
      }
    | {
        kind: 'SpendAllQuote'
        value: SwapIntent_SpendAllQuote
      }

/**
 * Represents user's intent to swap tokens in Printr ecosystem.
 * We translate this intent to specific Meteora CPIs.
 */
export const SwapIntent: Codec<SwapIntent> = sum(1, {
    SpendQuote: {
        discriminator: 0,
        value: SwapIntent_SpendQuote,
    },
    SellTelecoin: {
        discriminator: 1,
        value: SwapIntent_SellTelecoin,
    },
    SpendAllQuote: {
        discriminator: 2,
        value: SwapIntent_SpendAllQuote,
    },
})

/**
 * The core primitive of the Printr protocol.
 * 
 * These telecoin params uniquely identify a token launched with Printr.
 */
export interface TelecoinParams {
    salt: Array<number>
    devAddresses: Uint8Array
    name: Array<number>
    symbol: Array<number>
    packedParams: Array<number>
    chains: Array<Array<number>>
    quotePairs: Array<Array<number>>
    quotePrices: Uint8Array
}

/**
 * The core primitive of the Printr protocol.
 * 
 * These telecoin params uniquely identify a token launched with Printr.
 */
export const TelecoinParams: Codec<TelecoinParams> = struct({
    salt: fixedArray(u8, 32),
    devAddresses: binary,
    name: fixedArray(u8, 32),
    symbol: fixedArray(u8, 32),
    packedParams: fixedArray(u8, 32),
    chains: array(fixedArray(u8, 32)),
    quotePairs: array(fixedArray(u8, 32)),
    quotePrices: binary,
})

/**
 * On Solana we're dealing with txs size limits.
 * Being able to compress the telecoin params into a smaller structure helps us submit smaller txs.
 * 
 * You can always convert this back to [TelecoinParams].
 */
export interface TelecoinParamsCompact {
    version: number
    data: Uint8Array
}

/**
 * On Solana we're dealing with txs size limits.
 * Being able to compress the telecoin params into a smaller structure helps us submit smaller txs.
 * 
 * You can always convert this back to [TelecoinParams].
 */
export const TelecoinParamsCompact: Codec<TelecoinParamsCompact> = struct({
    version: u8,
    data: binary,
})

/**
 * Overrides default configuration for a specific telecoin with respect to omnichain transfers.
 */
export interface TelecoinTeleportConfig {
    lzPeer: TeleportPathConfig
}

/**
 * Overrides default configuration for a specific telecoin with respect to omnichain transfers.
 */
export const TelecoinTeleportConfig: Codec<TelecoinTeleportConfig> = struct({
    lzPeer: TeleportPathConfig,
})

/**
 * Event emitted by the [TeleportWithLz] instruction.
 */
export interface TeleportWithLzEvent {
    guid: Array<number>
    nonce: bigint
    lzDestinationEndpointId: number
    telecoinId: TelecoinId
    destinationRecipientAddress: Array<number>
    destinationPeerAddress: Array<number>
    sourceUserAddress: string
    teleporting: TokenAmount
}

/**
 * Event emitted by the [TeleportWithLz] instruction.
 */
export const TeleportWithLzEvent: Codec<TeleportWithLzEvent> = struct({
    guid: fixedArray(u8, 32),
    nonce: u64,
    lzDestinationEndpointId: u32,
    telecoinId: TelecoinId,
    destinationRecipientAddress: fixedArray(u8, 32),
    destinationPeerAddress: fixedArray(u8, 32),
    sourceUserAddress: address,
    teleporting: TokenAmount,
})

/**
 * Parameters for the [TeleportWithLz] instruction.
 * Used to construct [OutgoingMessage].
 */
export interface TeleportWithLzParams {
    toSend: TokenAmount
    destinationRecipientAddress: Array<number>
    telecoinId: TelecoinId
    lamportsGas: TokenAmount
    lzOptions: Uint8Array
    lzDestinationEndpointId: number
}

/**
 * Parameters for the [TeleportWithLz] instruction.
 * Used to construct [OutgoingMessage].
 */
export const TeleportWithLzParams: Codec<TeleportWithLzParams> = struct({
    toSend: TokenAmount,
    destinationRecipientAddress: fixedArray(u8, 32),
    telecoinId: TelecoinId,
    lamportsGas: TokenAmount,
    lzOptions: binary,
    lzDestinationEndpointId: u32,
})

export interface VolatilityTracker {
    lastUpdateTimestamp: bigint
    padding: Array<number>
    sqrtPriceReference: bigint
    volatilityAccumulator: bigint
    volatilityReference: bigint
}

export const VolatilityTracker: Codec<VolatilityTracker> = struct({
    lastUpdateTimestamp: u64,
    padding: fixedArray(u8, 8),
    sqrtPriceReference: u128,
    volatilityAccumulator: u128,
    volatilityReference: u128,
})

export interface VirtualPool {
    volatilityTracker: VolatilityTracker
    config: string
    creator: string
    baseMint: string
    baseVault: string
    quoteVault: string
    baseReserve: bigint
    quoteReserve: bigint
    protocolBaseFee: bigint
    protocolQuoteFee: bigint
    partnerBaseFee: bigint
    partnerQuoteFee: bigint
    sqrtPrice: bigint
    activationPoint: bigint
    poolType: number
    isMigrated: number
    isPartnerWithdrawSurplus: number
    isProtocolWithdrawSurplus: number
    migrationProgress: number
    isWithdrawLeftover: number
    isCreatorWithdrawSurplus: number
    migrationFeeWithdrawStatus: number
    metrics: PoolMetrics
    finishCurveTimestamp: bigint
    creatorBaseFee: bigint
    creatorQuoteFee: bigint
    _padding1: Array<bigint>
}

export const VirtualPool: Codec<VirtualPool> = struct({
    volatilityTracker: VolatilityTracker,
    config: address,
    creator: address,
    baseMint: address,
    baseVault: address,
    quoteVault: address,
    baseReserve: u64,
    quoteReserve: u64,
    protocolBaseFee: u64,
    protocolQuoteFee: u64,
    partnerBaseFee: u64,
    partnerQuoteFee: u64,
    sqrtPrice: u128,
    activationPoint: u64,
    poolType: u8,
    isMigrated: u8,
    isPartnerWithdrawSurplus: u8,
    isProtocolWithdrawSurplus: u8,
    migrationProgress: u8,
    isWithdrawLeftover: u8,
    isCreatorWithdrawSurplus: u8,
    migrationFeeWithdrawStatus: u8,
    metrics: PoolMetrics,
    finishCurveTimestamp: u64,
    creatorBaseFee: u64,
    creatorQuoteFee: u64,
    _padding1: fixedArray(u64, 7),
})
