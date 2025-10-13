import {struct, binary, address, unit, fixedArray, u8} from '@subsquid/borsh'
import {instruction} from '../abi.support'
import {SqrtBitshiftedPrice, PrintrConfigParams, TokenParams, TokenParamsCompact, SwapIntent, LzQuoteSendParams, LzReceiveParams, LzSendMemeParams, SetPeerConfParams} from './types'

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
         * The mint of this token account determines what's being sold, whether $MEME or quote.
         */
        swapOutputWallet: 5,
        swapMemeMint: 6,
        swapQuoteMint: 7,
        swapDbcPoolAuthority: 8,
        swapDbcConfig: 9,
        swapDbcPool: 10,
        swapDbcMemeVault: 11,
        swapDbcQuoteVault: 12,
        swapDbcEventAuthority: 13,
        swapDbcMigrationMetadata: 14,
        swapDammPrintrPartnerConfig: 15,
        swapDammPool: 16,
        swapDammPoolAuthority: 17,
        swapDammMemeVault: 18,
        swapDammQuoteVault: 19,
        swapDammPositionNftMint: 20,
        swapDammPositionNftAccount: 21,
        swapDammPosition: 22,
        swapDammEventAuthority: 23,
        /**
         * We'll need this to init the mint and init the token account.
         */
        swapMemeTokenProgram: 24,
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
    memeMint: string
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
         * The quote mint that was meant to be swapped against the $MEME token.
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
        memeMint: address,
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
        memeMint: 3,
        /**
         * The quote mint is the token that will be used to buy $MEME tokens.
         */
        quoteMint: 4,
        printrIntermediaryAuthority: 5,
        /**
         * Has to be always present because meteora CPI requires it.
         */
        printrIntermediaryMemeWallet: 6,
        printrIntermediaryQuoteWallet: 7,
        printrTeamTreasuryMemeWallet: 8,
        printrGrowthFundMemeWallet: 9,
        printrBuybackMemeWallet: 10,
        printrStakingMemeWallet: 11,
        printrTeamTreasuryQuoteWallet: 12,
        printrGrowthFundQuoteWallet: 13,
        printrBuybackQuoteWallet: 14,
        printrStakingQuoteWallet: 15,
        /**
         * The creator config stores information about the creator and must match the DBC pool.
         */
        creatorConfig: 16,
        creatorOnSolana: 17,
        creatorMemeWallet: 18,
        creatorQuoteWallet: 19,
        dammPositionNftAccount: 20,
        dammPosition: 21,
        dammPoolAuthority: 22,
        dammPool: 23,
        dammBaseVault: 24,
        dammQuoteVault: 25,
        dammEventAuthority: 26,
        /**
         * We'll need this to transfer.
         */
        memeTokenProgram: 27,
        /**
         * We'll need this to do transfers.
         */
        quoteTokenProgram: 28,
        /**
         * Used to create creator's $MEME ATA.
         */
        associatedTokenProgram: 29,
        /**
         * Necessary for creating new accounts.
         */
        systemProgram: 30,
        /**
         * The DAMM program that abstracts the bonding curve logic.
         */
        dammV2Program: 31,
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
        memeMint: 3,
        /**
         * The quote mint is the token that will be used to buy $MEME tokens.
         */
        quoteMint: 4,
        printrIntermediaryAuthority: 5,
        printrIntermediaryQuoteWallet: 6,
        printrTeamTreasuryQuoteWallet: 7,
        printrGrowthFundQuoteWallet: 8,
        printrBuybackQuoteWallet: 9,
        printrStakingQuoteWallet: 10,
        /**
         * 
         */
        dbcConfig: 11,
        dbcPoolAuthority: 12,
        dbcPool: 13,
        dbcBaseVault: 14,
        dbcQuoteVault: 15,
        dbcEventAuthority: 16,
        /**
         * The creator config stores information about the creator and must match the DBC pool.
         */
        creatorConfig: 17,
        creatorOnSolana: 18,
        creatorMemeWallet: 19,
        creatorQuoteWallet: 20,
        /**
         * We'll need this to transfer.
         */
        memeTokenProgram: 21,
        /**
         * We'll need this to do transfers.
         */
        quoteTokenProgram: 22,
        /**
         * Used to create creator's $MEME ATA.
         */
        associatedTokenProgram: 23,
        /**
         * Necessary for creating new accounts.
         */
        systemProgram: 24,
        /**
         * The DBC program that abstracts the bonding curve logic.
         */
        dbcProgram: 25,
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
        printrTeamTreasuryWallet: 1,
        printrGrowthFundWallet: 2,
        printrBuybackWallet: 3,
        printrStakingWallet: 4,
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

export interface CreatePrintrDbc {
    tokenParams: TokenParams
}

export const createPrintrDbc = instruction(
    {
        d8: '0x6f304b9988712193',
    },
    {
        /**
         * Creating a launch is a permission-less operation.
         * This could be a Printr user or a BE.
         */
        payer: 0,
        printrAuthority: 1,
        creatorConfig: 2,
        /**
         * This is the $MEME mint which we initialize according to the token params in the Meteora
         * CPI.
         * 
         */
        memeMint: 3,
        /**
         * The quote mint is the token that will be used to buy $MEME tokens.
         */
        quoteMint: 4,
        /**
         * When a $MEME is created we perform an initial buy on behalf of the creator.
         * 
         * There are three options how the initial buy can happen:
         * 1. No deposit PDA
         * 2. Deposit PDA of native $SOL
         * 3. Deposit PDA with an associated token account.
         * 
         * See `DepositPda` enum for more details.
         * 
         * If this is a PDA then we assign the ownership to the Printr program.
         * Clients can query the deposit address to check if the launch was created by checking the
         * owner of the deposit address.
         * Note that the client can choose the deposit authority bump.
         * 
         */
        initialBuyAuthority: 5,
        initialBuySource: 6,
        creatorOnSolana: 7,
        /**
         * Associated token account cannot exist because we've just created the $MEME mint.
         * 
         */
        creatorDestinationMemeWallet: 8,
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
        dbcMemeVault: 12,
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
        memeTokenProgram: 16,
        /**
         * We'll need this to do transfers.
         */
        quoteTokenProgram: 17,
        /**
         * Used to create creator's $MEME ATA.
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
        tokenParams: TokenParams,
    }),
)

export interface CreatePrintrDbcFromCompact {
    tokenParamsCompact: TokenParamsCompact
}

export const createPrintrDbcFromCompact = instruction(
    {
        d8: '0xb0ab31947b33c2a1',
    },
    {
        /**
         * Creating a launch is a permission-less operation.
         * This could be a Printr user or a BE.
         */
        payer: 0,
        printrAuthority: 1,
        creatorConfig: 2,
        /**
         * This is the $MEME mint which we initialize according to the token params in the Meteora
         * CPI.
         * 
         */
        memeMint: 3,
        /**
         * The quote mint is the token that will be used to buy $MEME tokens.
         */
        quoteMint: 4,
        /**
         * When a $MEME is created we perform an initial buy on behalf of the creator.
         * 
         * There are three options how the initial buy can happen:
         * 1. No deposit PDA
         * 2. Deposit PDA of native $SOL
         * 3. Deposit PDA with an associated token account.
         * 
         * See `DepositPda` enum for more details.
         * 
         * If this is a PDA then we assign the ownership to the Printr program.
         * Clients can query the deposit address to check if the launch was created by checking the
         * owner of the deposit address.
         * Note that the client can choose the deposit authority bump.
         * 
         */
        initialBuyAuthority: 5,
        initialBuySource: 6,
        creatorOnSolana: 7,
        /**
         * Associated token account cannot exist because we've just created the $MEME mint.
         * 
         */
        creatorDestinationMemeWallet: 8,
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
        dbcMemeVault: 12,
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
        memeTokenProgram: 16,
        /**
         * We'll need this to do transfers.
         */
        quoteTokenProgram: 17,
        /**
         * Used to create creator's $MEME ATA.
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
        tokenParamsCompact: TokenParamsCompact,
    }),
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

export interface LzQuote {
    params: LzQuoteSendParams
}

export const lzQuote = instruction(
    {
        d8: '0x6fc1c39a7005b074',
    },
    {
        peer: 0,
    },
    struct({
        params: LzQuoteSendParams,
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
         * Global Printr $MEME mint authority
         */
        printrAuthority: 2,
        /**
         * We'll mint these tokens.
         * 
         */
        memeMint: 3,
        recipient: 4,
        recipientDestinationMemeWallet: 5,
        /**
         * $MEME mint is always token program 2022.
         */
        memeTokenProgram: 6,
        /**
         * In case we need to create the ATA
         */
        associatedTokenProgram: 7,
        /**
         * In case we need to create the ATA
         */
        systemProgram: 8,
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

export interface LzSendMeme {
    params: LzSendMemeParams
}

export const lzSendMeme = instruction(
    {
        d8: '0x82fa898867702627',
    },
    {
        /**
         * This is the user that wants to send $MEME tokens.
         */
        payer: 0,
        /**
         * The $MEME mint that we burn here.
         */
        memeMint: 1,
        peer: 2,
        /**
         * Where to burn from.
         */
        userSourceMemeWallet: 3,
        /**
         * Needed to burn $MEME tokens.
         */
        memeTokenProgram: 4,
        eventAuthority: 5,
        program: 6,
    },
    struct({
        params: LzSendMemeParams,
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
         * We will use everything that's in this token account to buy as much $MEME as possible.
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
        outputMemeWallet: 6,
        memeMint: 7,
        quoteMint: 8,
        dbcPoolAuthority: 9,
        dbcConfig: 10,
        dbcPool: 11,
        dbcMemeVault: 12,
        dbcQuoteVault: 13,
        dbcEventAuthority: 14,
        dammPool: 15,
        dammPoolAuthority: 16,
        dammMemeVault: 17,
        dammQuoteVault: 18,
        dammEventAuthority: 19,
        /**
         * We'll need this to init the mint and init the token account.
         */
        memeTokenProgram: 20,
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
         * The mint of this token account determines what's being sold, whether $MEME or quote.
         */
        outputWallet: 3,
        memeMint: 4,
        quoteMint: 5,
        dbcPoolAuthority: 6,
        dbcConfig: 7,
        dbcPool: 8,
        dbcMemeVault: 9,
        dbcQuoteVault: 10,
        dbcEventAuthority: 11,
        dbcMigrationMetadata: 12,
        dammPrintrPartnerConfig: 13,
        dammPool: 14,
        dammPoolAuthority: 15,
        dammMemeVault: 16,
        dammQuoteVault: 17,
        dammPositionNftMint: 18,
        dammPositionNftAccount: 19,
        dammPosition: 20,
        dammEventAuthority: 21,
        /**
         * We'll need this to init the mint and init the token account.
         */
        memeTokenProgram: 22,
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
