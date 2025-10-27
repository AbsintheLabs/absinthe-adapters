import {address, binary, fixedArray, struct, u8, unit} from '@subsquid/borsh'
import {instruction} from '../abi.support'
import {EstimateTeleportWithLzParams, LzReceiveParams, PrintrConfigParams, SetPeerConfParams, SetTelecoinTeleportConfParams, SqrtBitshiftedPrice, SwapIntent, TelecoinId, TelecoinParams, TelecoinParamsCompact, TeleportWithLzParams} from './types'

export interface AuthorizedSpendAllQuote {
    maxPrice: SqrtBitshiftedPrice
    extraSeed: Uint8Array
}

export const authorizedSpendAllQuote = instruction(
    {
        d8: '0x376aee0e98f6ba81',
    },
    {
        /**
         * This is a Printr PDA.
         * You can see the expected seed in the [Self::apply] static function.
         */
        authorizor: 0,
        authorizorWallet: 1,
        /**
         * The user performing the swap
         */
        swapPayer: 2,
        /**
         * This is the account that funds the graduation process.
         * 
         */
        swapPrintrAuthority: 3,
        swapInputWallet: 4,
        /**
         * The mint of this token account determines what's being sold, whether telecoin or quote.
         */
        swapOutputWallet: 5,
        swapTelecoinMint: 6,
        swapQuoteMint: 7,
        swapDbcPoolAuthority: 8,
        swapDbcConfig: 9,
        swapDbcPool: 10,
        swapDbcTelecoinVault: 11,
        swapDbcQuoteVault: 12,
        swapDbcEventAuthority: 13,
        swapDbcMigrationMetadata: 14,
        swapDammPrintrPartnerConfig: 15,
        swapDammPool: 16,
        swapDammPoolAuthority: 17,
        swapDammTelecoinVault: 18,
        swapDammQuoteVault: 19,
        swapDammPositionNftMint: 20,
        swapDammPositionNftAccount: 21,
        swapDammPosition: 22,
        swapDammEventAuthority: 23,
        /**
         * We'll need this to init the mint and init the token account.
         */
        swapTelecoinTokenProgram: 24,
        /**
         * We'll need this to do transfers.
         */
        swapQuoteTokenProgram: 25,
        /**
         * The DBC program that abstracts the bonding curve logic.
         */
        swapDbcProgram: 26,
        /**
         * The DAMM V2 program that abstracts the AMM logic.
         */
        swapDammProgram: 27,
        /**
         * New accounts, native transfers, etc.
         */
        swapSystemProgram: 28,
    },
    struct({
        maxPrice: SqrtBitshiftedPrice,
        extraSeed: binary,
    }),
)

export interface CancelAuthorizedSpendAllQuote {
    maxPrice: SqrtBitshiftedPrice
    telecoinMint: string
    extraSeed: Uint8Array
}

export const cancelAuthorizedSpendAllQuote = instruction(
    {
        d8: '0xa701b845f2abf0cf',
    },
    {
        /**
         * This is a Printr PDA.
         * You can see the expected seed in the [Self::apply] static function.
         */
        authorizor: 0,
        /**
         * The SPL token account associated with the authorizor.
         */
        authorizorWallet: 1,
        /**
         * The quote mint that was meant to be swapped against the telecoin token.
         */
        quoteMint: 2,
        /**
         * The authorizor's recipient can cancel their own swap order.
         */
        recipient: 3,
        /**
         * The recipient's wallet if applicable.
         */
        recipientWallet: 4,
        /**
         * Allows us to swap.
         */
        quoteTokenProgram: 5,
        /**
         * We need to transfer.
         */
        systemProgram: 6,
    },
    struct({
        maxPrice: SqrtBitshiftedPrice,
        telecoinMint: address,
        extraSeed: binary,
    }),
)

export type ClaimDammFees = undefined

export const claimDammFees = instruction(
    {
        d8: '0xddc0a723b46e6b72',
    },
    {
        payer: 0,
        printrAuthority: 1,
        printrConfig: 2,
        telecoinMint: 3,
        /**
         * The quote mint is the token that will be used to buy telecoin tokens.
         */
        quoteMint: 4,
        /**
         * Stores all protocol quote fees.
         */
        printrProtocolQuoteFeeVault: 5,
        /**
         * Stores all protocol telecoin fees.
         */
        stakingWallet: 6,
        /**
         * The dev config stores information about the dev and must match the damm pool.
         * 
         * We know this is the right dev config because its seed matches the telecoin mint which in
         * turn matches the dammv2 pool.
         */
        devConfig: 7,
        /**
         * Stores all quote fees across all telecoins for all devs.
         * How much a dev can claim is tracked in their `DevConfig`.
         */
        devsQuoteFeeVault: 8,
        dammPositionNftAccount: 9,
        dammPosition: 10,
        dammPoolAuthority: 11,
        dammPool: 12,
        dammBaseVault: 13,
        dammQuoteVault: 14,
        dammEventAuthority: 15,
        /**
         * We'll need this to transfer.
         */
        telecoinTokenProgram: 16,
        /**
         * For the telecoin fees.
         */
        associatedTokenProgram: 17,
        /**
         * We'll need this to do transfers.
         */
        quoteTokenProgram: 18,
        /**
         * Necessary for creating new accounts.
         */
        systemProgram: 19,
        /**
         * The DAMM program that abstracts the bonding curve logic.
         */
        dammV2Program: 20,
    },
    unit,
)

export type ClaimDbcFees = undefined

export const claimDbcFees = instruction(
    {
        d8: '0xa2de805a3b732282',
    },
    {
        payer: 0,
        printrAuthority: 1,
        printrConfig: 2,
        telecoinMint: 3,
        /**
         * The quote mint is the token that is be used to buy telecoin tokens.
         */
        quoteMint: 4,
        /**
         * Stores all protocol fees.
         */
        printrProtocolQuoteFeeVault: 5,
        /**
         * Therefore any old telecoin wallet will do, it will not be used.
         */
        anyTelecoinWallet: 6,
        printrIntermediaryAuthority: 7,
        /**
         * Useful only for $wSOL quote token.
         * We will collect some fee amount to support smart graduation in swap ix.
         */
        printrIntermediaryQuoteWallet: 8,
        /**
         * 
         */
        dbcConfig: 9,
        dbcPoolAuthority: 10,
        dbcPool: 11,
        dbcBaseVault: 12,
        dbcQuoteVault: 13,
        dbcEventAuthority: 14,
        /**
         * The dev config stores information about the dev and must match the DBC pool.
         * 
         * We know this is the right dev config because its seed matches the telecoin mint which in
         * turn matches the dbc pool.
         */
        devConfig: 15,
        /**
         * Stores all quote fees across all telecoins for all devs.
         * How much a dev can claim is tracked in their DevConfig.
         */
        devsQuoteFeeVault: 16,
        /**
         * We'll need this to transfer.
         */
        telecoinTokenProgram: 17,
        /**
         * We'll need this to do transfers.
         */
        quoteTokenProgram: 18,
        /**
         * Used to create dev's telecoin ATA.
         */
        associatedTokenProgram: 19,
        /**
         * Necessary for creating new accounts.
         */
        systemProgram: 20,
        /**
         * The DBC program that abstracts the bonding curve logic.
         */
        dbcProgram: 21,
    },
    unit,
)

export type ClaimPrintrAuthorityLamports = undefined

export const claimPrintrAuthorityLamports = instruction(
    {
        d8: '0x340e8c7229690030',
    },
    {
        admin: 0,
        printrAuthority: 1,
        /**
         * Necessary for creating new accounts.
         */
        systemProgram: 2,
    },
    unit,
)

export interface CreatePrintrConfig {
    params: PrintrConfigParams
}

export const createPrintrConfig = instruction(
    {
        d8: '0xa0bf42d4056a14d7',
    },
    {
        admin: 0,
        printrTeamTreasuryAuthority: 1,
        printrGrowthFundAuthority: 2,
        printrBuybackAuthority: 3,
        printrStakingAuthority: 4,
        /**
         * We use `init_if_needed` purposefully.
         * Call this ix again to update the config.
         */
        printrConfig: 5,
        /**
         * Necessary for creating new accounts.
         */
        systemProgram: 6,
    },
    struct({
        params: PrintrConfigParams,
    }),
)

export interface DeployTelecoin {
    telecoinParamsCompact: TelecoinParamsCompact
}

export const deployTelecoin = instruction(
    {
        d8: '0x04f814017d3f0f00',
    },
    {
        /**
         * Creating a launch is a permission-less operation.
         * This could be a Printr user or a BE.
         */
        payer: 0,
        printrAuthority: 1,
        devConfig: 2,
        /**
         * This is the telecoin mint which we initialize according to the telecoin params.
         */
        telecoinMint: 3,
        /**
         * We'll need this to init the mint.
         */
        telecoinTokenProgram: 4,
        /**
         * Necessary for creating new accounts.
         */
        systemProgram: 5,
        eventAuthority: 6,
        program: 7,
    },
    struct({
        telecoinParamsCompact: TelecoinParamsCompact,
    }),
)

export interface DeployTelecoin2 {
    telecoinParams: TelecoinParams
}

export const deployTelecoin2 = instruction(
    {
        d8: '0x259b36ecbae1c989',
    },
    {
        /**
         * Creating a launch is a permission-less operation.
         * This could be a Printr user or a BE.
         */
        payer: 0,
        printrAuthority: 1,
        devConfig: 2,
        /**
         * This is the telecoin mint which we initialize according to the telecoin params.
         */
        telecoinMint: 3,
        /**
         * We'll need this to init the mint.
         */
        telecoinTokenProgram: 4,
        /**
         * Necessary for creating new accounts.
         */
        systemProgram: 5,
        eventAuthority: 6,
        program: 7,
    },
    struct({
        telecoinParams: TelecoinParams,
    }),
)

export type DistributeDevQuoteFees = undefined

export const distributeDevQuoteFees = instruction(
    {
        d8: '0xe82300a5c3ca3a0b',
    },
    {
        payer: 0,
        printrAuthority: 1,
        printrConfig: 2,
        /**
         * The quote mint is the token that is be used to buy telecoin tokens.
         */
        quoteMint: 3,
        telecoinMint: 4,
        /**
         * Stores all quote fees across all telecoins for all devs.
         * How much a dev can claim is tracked in their dev config.
         */
        devsQuoteFeeVault: 5,
        /**
         * The dev config stores information about how much a dev can claim.
         * The existence of this account implies that the telecoin mint was created by Printr.
         */
        devConfig: 6,
        dev: 7,
        devQuoteWallet: 8,
        dbcPool: 9,
        dbcConfig: 10,
        /**
         * We'll need this to do transfers.
         */
        quoteTokenProgram: 11,
        /**
         * Used to create dev's quote ATA.
         */
        associatedTokenProgram: 12,
        /**
         * Necessary for creating new accounts.
         */
        systemProgram: 13,
    },
    unit,
)

export type DistributeProtocolQuoteFees = undefined

export const distributeProtocolQuoteFees = instruction(
    {
        d8: '0xebdfd13b49885177',
    },
    {
        printrConfig: 0,
        /**
         * The quote mint is the token that is be used to buy telecoin tokens.
         */
        quoteMint: 1,
        /**
         * Stores all protocol fees.
         */
        printrProtocolQuoteFeeVault: 2,
        printrTeamTreasuryQuoteWallet: 3,
        printrGrowthFundQuoteWallet: 4,
        printrBuybackQuoteWallet: 5,
        /**
         * We'll need this to do transfers.
         */
        quoteTokenProgram: 6,
        /**
         * Necessary for creating new accounts.
         */
        systemProgram: 7,
    },
    unit,
)

export interface EstimateSwap {
    params: SwapIntent
}

export const estimateSwap = instruction(
    {
        d8: '0xdbc4b7523b25a63b',
    },
    {
        dbcConfig: 0,
        dbcPool: 1,
        /**
         * Might be uninitialized if the pool is not yet graduated.
         */
        dammPool: 2,
    },
    struct({
        params: SwapIntent,
    }),
)

export interface EstimateTeleportWithLz {
    params: EstimateTeleportWithLzParams
}

export const estimateTeleportWithLz = instruction(
    {
        d8: '0x0b8da67699ff3e84',
    },
    {
        peer: 0,
    },
    struct({
        params: EstimateTeleportWithLzParams,
    }),
)

export interface LzReceive {
    params: LzReceiveParams
}

export const lzReceive = instruction(
    {
        d8: '0x08b3786d2176bd50',
    },
    {
        /**
         * The LZ executor.
         */
        payer: 0,
        /**
         * Represents where did the message come from.
         */
        peer: 1,
        /**
         * If this account does not exist then the provided peer must be set as a default peer.
         * Otherwise we parse this account's configuration and assert it's been upheld.
         */
        telecoinTeleportConfig: 2,
        /**
         * Global Printr telecoin mint authority
         */
        printrAuthority: 3,
        /**
         * We'll mint these tokens.
         * 
         */
        telecoinMint: 4,
        recipient: 5,
        recipientDestinationTelecoinWallet: 6,
        /**
         * Telecoin mint is always token program 2022.
         */
        telecoinTokenProgram: 7,
        /**
         * In case we need to create the ATA
         */
        associatedTokenProgram: 8,
        /**
         * In case we need to create the ATA
         */
        systemProgram: 9,
    },
    struct({
        params: LzReceiveParams,
    }),
)

export interface LzReceiveTypes {
    params: LzReceiveParams
}

export const lzReceiveTypes = instruction(
    {
        d8: '0xdd11f69ff8801f60',
    },
    {
    },
    struct({
        params: LzReceiveParams,
    }),
)

export interface LzSetPeer {
    peerAddress: Array<number>
}

export const lzSetPeer = instruction(
    {
        d8: '0xc77b5174d031d5e8',
    },
    {
        /**
         * Printr staff.
         */
        admin: 0,
        peer: 1,
        lzOappRegistry: 2,
        endpointEmitCpiEventAuthority: 3,
        endpointProgram: 4,
        systemProgram: 5,
    },
    struct({
        peerAddress: fixedArray(u8, 32),
    }),
)

export interface PrintTelecoin {
    telecoinParamsCompact: TelecoinParamsCompact
}

export const printTelecoin = instruction(
    {
        d8: '0xd61e0466cf496c23',
    },
    {
        /**
         * Creating a launch is a permission-less operation.
         * This could be a Printr user or a BE.
         */
        payer: 0,
        printrAuthority: 1,
        devConfig: 2,
        /**
         * This is the telecoin mint which we initialize according to the telecoin params in the
         * Meteora CPI.
         * 
         */
        telecoinMint: 3,
        /**
         * The quote mint is the token that will be used to buy telecoin tokens.
         */
        quoteMint: 4,
        /**
         * When a telecoin is printed we perform an initial buy on behalf of the dev.
         * 
         * There are three options how the initial buy can happen:
         * 1. No deposit PDA
         * 2. Deposit PDA of native $SOL
         * 3. Deposit PDA with an associated token account.
         * 
         * See `DepositPda` enum for more details.
         * 
         */
        initialBuyAuthority: 5,
        initialBuySource: 6,
        devOnSolana: 7,
        /**
         * Associated token account cannot exist because we've just created the telecoin mint.
         * Will not be initialized if initial spend is zero.
         * 
         */
        devDestinationTelecoinWallet: 8,
        /**
         * We'll init the config first.
         * 
         */
        dbcConfig: 9,
        dbcPoolAuthority: 10,
        /**
         * The bonding curve state, initialized after the config.
         * 
         */
        dbcPool: 11,
        dbcTelecoinVault: 12,
        dbcQuoteVault: 13,
        dbcEventAuthority: 14,
        /**
         * If provided then we create a migration metadata account for the DBC pool.
         * 
         */
        dbcMigrationMetadata: 15,
        /**
         * We'll need this to init the mint and init the token account.
         */
        telecoinTokenProgram: 16,
        /**
         * We'll need this to do transfers.
         */
        quoteTokenProgram: 17,
        /**
         * Used to create dev's telecoin ATA.
         */
        associatedTokenProgram: 18,
        /**
         * Necessary for creating new accounts.
         */
        systemProgram: 19,
        /**
         * The DBC program that abstracts the bonding curve logic.
         */
        dbcProgram: 20,
        eventAuthority: 21,
        program: 22,
    },
    struct({
        telecoinParamsCompact: TelecoinParamsCompact,
    }),
)

export interface PrintTelecoin2 {
    telecoinParams: TelecoinParams
}

export const printTelecoin2 = instruction(
    {
        d8: '0xa63c262bee2002a0',
    },
    {
        /**
         * Creating a launch is a permission-less operation.
         * This could be a Printr user or a BE.
         */
        payer: 0,
        printrAuthority: 1,
        devConfig: 2,
        /**
         * This is the telecoin mint which we initialize according to the telecoin params in the
         * Meteora CPI.
         * 
         */
        telecoinMint: 3,
        /**
         * The quote mint is the token that will be used to buy telecoin tokens.
         */
        quoteMint: 4,
        /**
         * When a telecoin is printed we perform an initial buy on behalf of the dev.
         * 
         * There are three options how the initial buy can happen:
         * 1. No deposit PDA
         * 2. Deposit PDA of native $SOL
         * 3. Deposit PDA with an associated token account.
         * 
         * See `DepositPda` enum for more details.
         * 
         */
        initialBuyAuthority: 5,
        initialBuySource: 6,
        devOnSolana: 7,
        /**
         * Associated token account cannot exist because we've just created the telecoin mint.
         * Will not be initialized if initial spend is zero.
         * 
         */
        devDestinationTelecoinWallet: 8,
        /**
         * We'll init the config first.
         * 
         */
        dbcConfig: 9,
        dbcPoolAuthority: 10,
        /**
         * The bonding curve state, initialized after the config.
         * 
         */
        dbcPool: 11,
        dbcTelecoinVault: 12,
        dbcQuoteVault: 13,
        dbcEventAuthority: 14,
        /**
         * If provided then we create a migration metadata account for the DBC pool.
         * 
         */
        dbcMigrationMetadata: 15,
        /**
         * We'll need this to init the mint and init the token account.
         */
        telecoinTokenProgram: 16,
        /**
         * We'll need this to do transfers.
         */
        quoteTokenProgram: 17,
        /**
         * Used to create dev's telecoin ATA.
         */
        associatedTokenProgram: 18,
        /**
         * Necessary for creating new accounts.
         */
        systemProgram: 19,
        /**
         * The DBC program that abstracts the bonding curve logic.
         */
        dbcProgram: 20,
        eventAuthority: 21,
        program: 22,
    },
    struct({
        telecoinParams: TelecoinParams,
    }),
)

export interface SetPeerConf {
    params: SetPeerConfParams
}

export const setPeerConf = instruction(
    {
        d8: '0x51d35198d4993a47',
    },
    {
        /**
         * Printr staff.
         */
        admin: 0,
        peer: 1,
    },
    struct({
        params: SetPeerConfParams,
    }),
)

export interface SetTelecoinTeleportConf {
    telecoinId: TelecoinId
    params: SetTelecoinTeleportConfParams
}

export const setTelecoinTeleportConf = instruction(
    {
        d8: '0x642f3d94c68a3e31',
    },
    {
        payer: 0,
        /**
         * Printr staff.
         */
        admin: 1,
        telecoinTeleportConfig: 2,
        systemProgram: 3,
    },
    struct({
        telecoinId: TelecoinId,
        params: SetTelecoinTeleportConfParams,
    }),
)

export interface SpendAllQuoteNoGraduation {
    maxPrice: SqrtBitshiftedPrice
}

export const spendAllQuoteNoGraduation = instruction(
    {
        d8: '0xc6aad9f53b49723c',
    },
    {
        /**
         * The entity performing the swap.
         * Owner of the input token account.
         * 
         * If the quote token is $wSOL then we transfer everything from this account to the
         * intermediary token account.
         */
        payer: 0,
        printrIntermediaryAuthority: 1,
        /**
         * To support post hooks with native $SOL we need to create an intermediate ATA for the quote
         * token.
         * All the quote tokens will be transferred to this account first before being swapped.
         * The account is not closed so that it can be reused in the future without paying rent.
         */
        printrIntermediaryQuoteWallet: 2,
        /**
         * We will use everything that's in this token account to buy as much telecoin as possible.
         * 
         * Can be none for $wSOL quote if wrapping is needed.
         */
        inputQuoteWallet: 3,
        recipient: 4,
        recipientQuoteWallet: 5,
        /**
         * The owner of the output account will not match the payer for a posthook ix.
         * 
         */
        outputTelecoinWallet: 6,
        telecoinMint: 7,
        quoteMint: 8,
        dbcPoolAuthority: 9,
        dbcConfig: 10,
        dbcPool: 11,
        dbcTelecoinVault: 12,
        dbcQuoteVault: 13,
        dbcEventAuthority: 14,
        dammPool: 15,
        dammPoolAuthority: 16,
        dammTelecoinVault: 17,
        dammQuoteVault: 18,
        dammEventAuthority: 19,
        /**
         * We'll need this to init the mint and init the token account.
         */
        telecoinTokenProgram: 20,
        /**
         * We'll need this to do transfers.
         */
        quoteTokenProgram: 21,
        /**
         * The DBC program that abstracts the bonding curve logic.
         */
        dbcProgram: 22,
        /**
         * The DAMM V2 program that abstracts the AMM logic.
         */
        dammProgram: 23,
        /**
         * Used to create ATA if needed.
         */
        associatedTokenProgram: 24,
        /**
         * We might need to refill the input token account with $wSOL.
         */
        systemProgram: 25,
    },
    struct({
        maxPrice: SqrtBitshiftedPrice,
    }),
)

export interface Swap {
    params: SwapIntent
}

export const swap = instruction(
    {
        d8: '0xf8c69e91e17587c8',
    },
    {
        /**
         * The user performing the swap
         */
        payer: 0,
        /**
         * This is the account that funds the graduation process.
         * 
         */
        printrAuthority: 1,
        inputWallet: 2,
        /**
         * The mint of this token account determines what's being sold, whether telecoin or quote.
         */
        outputWallet: 3,
        telecoinMint: 4,
        quoteMint: 5,
        dbcPoolAuthority: 6,
        dbcConfig: 7,
        dbcPool: 8,
        dbcTelecoinVault: 9,
        dbcQuoteVault: 10,
        dbcEventAuthority: 11,
        dbcMigrationMetadata: 12,
        dammPrintrPartnerConfig: 13,
        dammPool: 14,
        dammPoolAuthority: 15,
        dammTelecoinVault: 16,
        dammQuoteVault: 17,
        dammPositionNftMint: 18,
        dammPositionNftAccount: 19,
        dammPosition: 20,
        dammEventAuthority: 21,
        /**
         * We'll need this to init the mint and init the token account.
         */
        telecoinTokenProgram: 22,
        /**
         * We'll need this to do transfers.
         */
        quoteTokenProgram: 23,
        /**
         * The DBC program that abstracts the bonding curve logic.
         */
        dbcProgram: 24,
        /**
         * The DAMM V2 program that abstracts the AMM logic.
         */
        dammProgram: 25,
        /**
         * New accounts, native transfers, etc.
         */
        systemProgram: 26,
    },
    struct({
        params: SwapIntent,
    }),
)

export interface TeleportWithLz {
    params: TeleportWithLzParams
}

export const teleportWithLz = instruction(
    {
        d8: '0xa679e9087d28b32f',
    },
    {
        /**
         * This is the user that wants to send telecoin tokens.
         */
        payer: 0,
        /**
         * The telecoin mint that we burn here.
         */
        telecoinMint: 1,
        /**
         * If this account does not exist then the provided peer must be set as a default peer.
         * Otherwise we parse this account's configuration and assert it's been upheld.
         */
        telecoinTeleportConfig: 2,
        peer: 3,
        /**
         * Where to burn from.
         */
        userSourceTelecoinWallet: 4,
        /**
         * Needed to burn telecoin tokens.
         */
        telecoinTokenProgram: 5,
        eventAuthority: 6,
        program: 7,
    },
    struct({
        params: TeleportWithLzParams,
    }),
)
