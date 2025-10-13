import {Codec, unit, sum, struct, array, ref, u16, address, u64, bool, fixedArray, u8, i64, i16, string, hashMap, u32} from '@subsquid/borsh'

export type AccountState_Uninitialized = undefined

export const AccountState_Uninitialized = unit

export type AccountState_Initialized = undefined

export const AccountState_Initialized = unit

export type AccountState_Frozen = undefined

export const AccountState_Frozen = unit

export type AccountState = 
    | {
        kind: 'Uninitialized'
        value?: AccountState_Uninitialized
      }
    | {
        kind: 'Initialized'
        value?: AccountState_Initialized
      }
    | {
        kind: 'Frozen'
        value?: AccountState_Frozen
      }

export const AccountState: Codec<AccountState> = sum(1, {
    Uninitialized: {
        discriminator: 0,
        value: AccountState_Uninitialized,
    },
    Initialized: {
        discriminator: 1,
        value: AccountState_Initialized,
    },
    Frozen: {
        discriminator: 2,
        value: AccountState_Frozen,
    },
})

export type AccountType_Uninitialized = undefined

export const AccountType_Uninitialized = unit

export type AccountType_Mint = undefined

export const AccountType_Mint = unit

export type AccountType_Account = undefined

export const AccountType_Account = unit

export type AccountType = 
    | {
        kind: 'Uninitialized'
        value?: AccountType_Uninitialized
      }
    | {
        kind: 'Mint'
        value?: AccountType_Mint
      }
    | {
        kind: 'Account'
        value?: AccountType_Account
      }

export const AccountType: Codec<AccountType> = sum(1, {
    Uninitialized: {
        discriminator: 0,
        value: AccountType_Uninitialized,
    },
    Mint: {
        discriminator: 1,
        value: AccountType_Mint,
    },
    Account: {
        discriminator: 2,
        value: AccountType_Account,
    },
})

export type AuthorityType_MintTokens = undefined

export const AuthorityType_MintTokens = unit

export type AuthorityType_FreezeAccount = undefined

export const AuthorityType_FreezeAccount = unit

export type AuthorityType_AccountOwner = undefined

export const AuthorityType_AccountOwner = unit

export type AuthorityType_CloseAccount = undefined

export const AuthorityType_CloseAccount = unit

export type AuthorityType_TransferFeeConfig = undefined

export const AuthorityType_TransferFeeConfig = unit

export type AuthorityType_WithheldWithdraw = undefined

export const AuthorityType_WithheldWithdraw = unit

export type AuthorityType_CloseMint = undefined

export const AuthorityType_CloseMint = unit

export type AuthorityType_InterestRate = undefined

export const AuthorityType_InterestRate = unit

export type AuthorityType_PermanentDelegate = undefined

export const AuthorityType_PermanentDelegate = unit

export type AuthorityType_ConfidentialTransferMint = undefined

export const AuthorityType_ConfidentialTransferMint = unit

export type AuthorityType_TransferHookProgramId = undefined

export const AuthorityType_TransferHookProgramId = unit

export type AuthorityType_ConfidentialTransferFeeConfig = undefined

export const AuthorityType_ConfidentialTransferFeeConfig = unit

export type AuthorityType_MetadataPointer = undefined

export const AuthorityType_MetadataPointer = unit

export type AuthorityType_GroupPointer = undefined

export const AuthorityType_GroupPointer = unit

export type AuthorityType_GroupMemberPointer = undefined

export const AuthorityType_GroupMemberPointer = unit

export type AuthorityType = 
    | {
        kind: 'MintTokens'
        value?: AuthorityType_MintTokens
      }
    | {
        kind: 'FreezeAccount'
        value?: AuthorityType_FreezeAccount
      }
    | {
        kind: 'AccountOwner'
        value?: AuthorityType_AccountOwner
      }
    | {
        kind: 'CloseAccount'
        value?: AuthorityType_CloseAccount
      }
    | {
        kind: 'TransferFeeConfig'
        value?: AuthorityType_TransferFeeConfig
      }
    | {
        kind: 'WithheldWithdraw'
        value?: AuthorityType_WithheldWithdraw
      }
    | {
        kind: 'CloseMint'
        value?: AuthorityType_CloseMint
      }
    | {
        kind: 'InterestRate'
        value?: AuthorityType_InterestRate
      }
    | {
        kind: 'PermanentDelegate'
        value?: AuthorityType_PermanentDelegate
      }
    | {
        kind: 'ConfidentialTransferMint'
        value?: AuthorityType_ConfidentialTransferMint
      }
    | {
        kind: 'TransferHookProgramId'
        value?: AuthorityType_TransferHookProgramId
      }
    | {
        kind: 'ConfidentialTransferFeeConfig'
        value?: AuthorityType_ConfidentialTransferFeeConfig
      }
    | {
        kind: 'MetadataPointer'
        value?: AuthorityType_MetadataPointer
      }
    | {
        kind: 'GroupPointer'
        value?: AuthorityType_GroupPointer
      }
    | {
        kind: 'GroupMemberPointer'
        value?: AuthorityType_GroupMemberPointer
      }

export const AuthorityType: Codec<AuthorityType> = sum(1, {
    MintTokens: {
        discriminator: 0,
        value: AuthorityType_MintTokens,
    },
    FreezeAccount: {
        discriminator: 1,
        value: AuthorityType_FreezeAccount,
    },
    AccountOwner: {
        discriminator: 2,
        value: AuthorityType_AccountOwner,
    },
    CloseAccount: {
        discriminator: 3,
        value: AuthorityType_CloseAccount,
    },
    TransferFeeConfig: {
        discriminator: 4,
        value: AuthorityType_TransferFeeConfig,
    },
    WithheldWithdraw: {
        discriminator: 5,
        value: AuthorityType_WithheldWithdraw,
    },
    CloseMint: {
        discriminator: 6,
        value: AuthorityType_CloseMint,
    },
    InterestRate: {
        discriminator: 7,
        value: AuthorityType_InterestRate,
    },
    PermanentDelegate: {
        discriminator: 8,
        value: AuthorityType_PermanentDelegate,
    },
    ConfidentialTransferMint: {
        discriminator: 9,
        value: AuthorityType_ConfidentialTransferMint,
    },
    TransferHookProgramId: {
        discriminator: 10,
        value: AuthorityType_TransferHookProgramId,
    },
    ConfidentialTransferFeeConfig: {
        discriminator: 11,
        value: AuthorityType_ConfidentialTransferFeeConfig,
    },
    MetadataPointer: {
        discriminator: 12,
        value: AuthorityType_MetadataPointer,
    },
    GroupPointer: {
        discriminator: 13,
        value: AuthorityType_GroupPointer,
    },
    GroupMemberPointer: {
        discriminator: 14,
        value: AuthorityType_GroupMemberPointer,
    },
})

export interface ExtensionTypeArray {
    extensionType: Array<ExtensionType>
}

export const ExtensionTypeArray: Codec<ExtensionTypeArray> = struct({
    extensionType: array(ref(() => ExtensionType)),
})

export type ExtensionTypeWithFields_Uninitialized = undefined

export const ExtensionTypeWithFields_Uninitialized = unit

export type ExtensionTypeWithFields_TransferFeeConfig = {
    extensionLength: number
    transferFeeConfigAuthority: string
    withdrawWithheldAuthority: string
    withheldAmount: bigint
    olderTransferFee: TransferFee
    newerTransferFee: TransferFee
}

export const ExtensionTypeWithFields_TransferFeeConfig = struct({
    extensionLength: u16,
    transferFeeConfigAuthority: address,
    withdrawWithheldAuthority: address,
    withheldAmount: u64,
    olderTransferFee: ref(() => TransferFee),
    newerTransferFee: ref(() => TransferFee),
})

export type ExtensionTypeWithFields_TransferFeeAmount = {
    extensionLength: number
    withheldAmount: bigint
}

export const ExtensionTypeWithFields_TransferFeeAmount = struct({
    extensionLength: u16,
    withheldAmount: u64,
})

export type ExtensionTypeWithFields_MintCloseAuthority = {
    extensionLength: number
    closeAuthority: string
}

export const ExtensionTypeWithFields_MintCloseAuthority = struct({
    extensionLength: u16,
    closeAuthority: address,
})

export type ExtensionTypeWithFields_ConfidentialTransferMint = {
    extensionLength: number
    authority: string
    autoApproveNewAccounts: boolean
    auditorElgamalPubkey: string
}

export const ExtensionTypeWithFields_ConfidentialTransferMint = struct({
    extensionLength: u16,
    authority: address,
    autoApproveNewAccounts: bool,
    auditorElgamalPubkey: address,
})

export type ExtensionTypeWithFields_ConfidentialTransferAccount = {
    extensionLength: number
    approved: boolean
    elgamalPubkey: string
    pendingBalanceLo: Array<number>
    pendingBalanceHi: Array<number>
    availableBalance: Array<number>
    decryptableAvailableBalance: Array<number>
    allowConfidentialCredits: boolean
    allowNonConfidentialCredits: boolean
    pendingBalanceCreditCounter: bigint
    maximumPendingBalanceCreditCounter: bigint
    expectedPendingBalanceCreditCounter: bigint
    actualPendingBalanceCreditCounter: bigint
}

export const ExtensionTypeWithFields_ConfidentialTransferAccount = struct({
    extensionLength: u16,
    approved: bool,
    elgamalPubkey: address,
    pendingBalanceLo: fixedArray(u8, 64),
    pendingBalanceHi: fixedArray(u8, 64),
    availableBalance: fixedArray(u8, 64),
    decryptableAvailableBalance: fixedArray(u8, 36),
    allowConfidentialCredits: bool,
    allowNonConfidentialCredits: bool,
    pendingBalanceCreditCounter: u64,
    maximumPendingBalanceCreditCounter: u64,
    expectedPendingBalanceCreditCounter: u64,
    actualPendingBalanceCreditCounter: u64,
})

export type ExtensionTypeWithFields_DefaultAccountState = {
    extensionLength: number
    defaultAccountState: AccountState
}

export const ExtensionTypeWithFields_DefaultAccountState = struct({
    extensionLength: u16,
    defaultAccountState: ref(() => AccountState),
})

export type ExtensionTypeWithFields_ImmutableOwner = {
    extensionLength: number
}

export const ExtensionTypeWithFields_ImmutableOwner = struct({
    extensionLength: u16,
})

export type ExtensionTypeWithFields_MemoTransfer = {
    extensionLength: number
    requireIncomingTransferMemos: boolean
}

export const ExtensionTypeWithFields_MemoTransfer = struct({
    extensionLength: u16,
    requireIncomingTransferMemos: bool,
})

export type ExtensionTypeWithFields_NonTransferable = {
    extensionLength: number
}

export const ExtensionTypeWithFields_NonTransferable = struct({
    extensionLength: u16,
})

export type ExtensionTypeWithFields_InterestBearingConfig = {
    extensionLength: number
    rateAuthority: string
    initializationTimestamp: bigint
    preUpdateAverageRate: number
    lastUpdateTimestamp: bigint
    currentRate: number
}

export const ExtensionTypeWithFields_InterestBearingConfig = struct({
    extensionLength: u16,
    rateAuthority: address,
    initializationTimestamp: i64,
    preUpdateAverageRate: i16,
    lastUpdateTimestamp: i64,
    currentRate: i16,
})

export type ExtensionTypeWithFields_CpiGuard = {
    extensionLength: number
    lockCpi: boolean
}

export const ExtensionTypeWithFields_CpiGuard = struct({
    extensionLength: u16,
    lockCpi: bool,
})

export type ExtensionTypeWithFields_PermanentDelegate = {
    extensionLength: number
    delegate: string
}

export const ExtensionTypeWithFields_PermanentDelegate = struct({
    extensionLength: u16,
    delegate: address,
})

export type ExtensionTypeWithFields_NonTransferableAccount = {
    extensionLength: number
}

export const ExtensionTypeWithFields_NonTransferableAccount = struct({
    extensionLength: u16,
})

export type ExtensionTypeWithFields_TransferHook = {
    extensionLength: number
    authority: string
    programId: string
}

export const ExtensionTypeWithFields_TransferHook = struct({
    extensionLength: u16,
    authority: address,
    programId: address,
})

export type ExtensionTypeWithFields_TransferHookAccount = {
    extensionLength: number
    transferring: boolean
}

export const ExtensionTypeWithFields_TransferHookAccount = struct({
    extensionLength: u16,
    transferring: bool,
})

export type ExtensionTypeWithFields_ConfidentialTransferFeeConfig = {
    extensionLength: number
    authority: string
    withdrawWithheldAuthorityElgamalPubkey: string
    harvestToMintEnabled: boolean
    withheldAmount: Array<number>
}

export const ExtensionTypeWithFields_ConfidentialTransferFeeConfig = struct({
    extensionLength: u16,
    authority: address,
    withdrawWithheldAuthorityElgamalPubkey: address,
    harvestToMintEnabled: bool,
    withheldAmount: fixedArray(u8, 64),
})

export type ExtensionTypeWithFields_ConfidentialTransferFeeAmount = {
    extensionLength: number
    withheldAmount: Array<number>
}

export const ExtensionTypeWithFields_ConfidentialTransferFeeAmount = struct({
    extensionLength: u16,
    withheldAmount: fixedArray(u8, 64),
})

export type ExtensionTypeWithFields_MetadataPointer = {
    extensionLength: number
    authority: string
    metadataAddress: string
}

export const ExtensionTypeWithFields_MetadataPointer = struct({
    extensionLength: u16,
    authority: address,
    metadataAddress: address,
})

export type ExtensionTypeWithFields_TokenMetadata = {
    extensionLength: number
    updateAuthority: string
    mint: string
    name: string
    symbol: string
    uri: string
    additionalMetadata: Map<
        string,
        string
    >
}

export const ExtensionTypeWithFields_TokenMetadata = struct({
    extensionLength: u16,
    updateAuthority: address,
    mint: address,
    name: string,
    symbol: string,
    uri: string,
    additionalMetadata: hashMap(
        string,
        string
    ),
})

export type ExtensionTypeWithFields_GroupPointer = {
    extensionLength: number
    authority: string
    groupAddress: string
}

export const ExtensionTypeWithFields_GroupPointer = struct({
    extensionLength: u16,
    authority: address,
    groupAddress: address,
})

export type ExtensionTypeWithFields_TokenGroup = {
    extensionLength: number
    updateAuthority: string
    mint: string
    size: number
    maxSize: number
}

export const ExtensionTypeWithFields_TokenGroup = struct({
    extensionLength: u16,
    updateAuthority: address,
    mint: address,
    size: u32,
    maxSize: u32,
})

export type ExtensionTypeWithFields_GroupMemberPointer = {
    extensionLength: number
    authority: string
    memberAddress: string
}

export const ExtensionTypeWithFields_GroupMemberPointer = struct({
    extensionLength: u16,
    authority: address,
    memberAddress: address,
})

export type ExtensionTypeWithFields_TokenGroupMember = {
    extensionLength: number
    mint: string
    group: string
    memberNumber: number
}

export const ExtensionTypeWithFields_TokenGroupMember = struct({
    extensionLength: u16,
    mint: address,
    group: address,
    memberNumber: u32,
})

export type ExtensionTypeWithFields = 
    | {
        kind: 'Uninitialized'
        value?: ExtensionTypeWithFields_Uninitialized
      }
    | {
        kind: 'TransferFeeConfig'
        value: ExtensionTypeWithFields_TransferFeeConfig
      }
    | {
        kind: 'TransferFeeAmount'
        value: ExtensionTypeWithFields_TransferFeeAmount
      }
    | {
        kind: 'MintCloseAuthority'
        value: ExtensionTypeWithFields_MintCloseAuthority
      }
    | {
        kind: 'ConfidentialTransferMint'
        value: ExtensionTypeWithFields_ConfidentialTransferMint
      }
    | {
        kind: 'ConfidentialTransferAccount'
        value: ExtensionTypeWithFields_ConfidentialTransferAccount
      }
    | {
        kind: 'DefaultAccountState'
        value: ExtensionTypeWithFields_DefaultAccountState
      }
    | {
        kind: 'ImmutableOwner'
        value: ExtensionTypeWithFields_ImmutableOwner
      }
    | {
        kind: 'MemoTransfer'
        value: ExtensionTypeWithFields_MemoTransfer
      }
    | {
        kind: 'NonTransferable'
        value: ExtensionTypeWithFields_NonTransferable
      }
    | {
        kind: 'InterestBearingConfig'
        value: ExtensionTypeWithFields_InterestBearingConfig
      }
    | {
        kind: 'CpiGuard'
        value: ExtensionTypeWithFields_CpiGuard
      }
    | {
        kind: 'PermanentDelegate'
        value: ExtensionTypeWithFields_PermanentDelegate
      }
    | {
        kind: 'NonTransferableAccount'
        value: ExtensionTypeWithFields_NonTransferableAccount
      }
    | {
        kind: 'TransferHook'
        value: ExtensionTypeWithFields_TransferHook
      }
    | {
        kind: 'TransferHookAccount'
        value: ExtensionTypeWithFields_TransferHookAccount
      }
    | {
        kind: 'ConfidentialTransferFeeConfig'
        value: ExtensionTypeWithFields_ConfidentialTransferFeeConfig
      }
    | {
        kind: 'ConfidentialTransferFeeAmount'
        value: ExtensionTypeWithFields_ConfidentialTransferFeeAmount
      }
    | {
        kind: 'MetadataPointer'
        value: ExtensionTypeWithFields_MetadataPointer
      }
    | {
        kind: 'TokenMetadata'
        value: ExtensionTypeWithFields_TokenMetadata
      }
    | {
        kind: 'GroupPointer'
        value: ExtensionTypeWithFields_GroupPointer
      }
    | {
        kind: 'TokenGroup'
        value: ExtensionTypeWithFields_TokenGroup
      }
    | {
        kind: 'GroupMemberPointer'
        value: ExtensionTypeWithFields_GroupMemberPointer
      }
    | {
        kind: 'TokenGroupMember'
        value: ExtensionTypeWithFields_TokenGroupMember
      }

export const ExtensionTypeWithFields: Codec<ExtensionTypeWithFields> = sum(1, {
    Uninitialized: {
        discriminator: 0,
        value: ExtensionTypeWithFields_Uninitialized,
    },
    TransferFeeConfig: {
        discriminator: 1,
        value: ExtensionTypeWithFields_TransferFeeConfig,
    },
    TransferFeeAmount: {
        discriminator: 2,
        value: ExtensionTypeWithFields_TransferFeeAmount,
    },
    MintCloseAuthority: {
        discriminator: 3,
        value: ExtensionTypeWithFields_MintCloseAuthority,
    },
    ConfidentialTransferMint: {
        discriminator: 4,
        value: ExtensionTypeWithFields_ConfidentialTransferMint,
    },
    ConfidentialTransferAccount: {
        discriminator: 5,
        value: ExtensionTypeWithFields_ConfidentialTransferAccount,
    },
    DefaultAccountState: {
        discriminator: 6,
        value: ExtensionTypeWithFields_DefaultAccountState,
    },
    ImmutableOwner: {
        discriminator: 7,
        value: ExtensionTypeWithFields_ImmutableOwner,
    },
    MemoTransfer: {
        discriminator: 8,
        value: ExtensionTypeWithFields_MemoTransfer,
    },
    NonTransferable: {
        discriminator: 9,
        value: ExtensionTypeWithFields_NonTransferable,
    },
    InterestBearingConfig: {
        discriminator: 10,
        value: ExtensionTypeWithFields_InterestBearingConfig,
    },
    CpiGuard: {
        discriminator: 11,
        value: ExtensionTypeWithFields_CpiGuard,
    },
    PermanentDelegate: {
        discriminator: 12,
        value: ExtensionTypeWithFields_PermanentDelegate,
    },
    NonTransferableAccount: {
        discriminator: 13,
        value: ExtensionTypeWithFields_NonTransferableAccount,
    },
    TransferHook: {
        discriminator: 14,
        value: ExtensionTypeWithFields_TransferHook,
    },
    TransferHookAccount: {
        discriminator: 15,
        value: ExtensionTypeWithFields_TransferHookAccount,
    },
    ConfidentialTransferFeeConfig: {
        discriminator: 16,
        value: ExtensionTypeWithFields_ConfidentialTransferFeeConfig,
    },
    ConfidentialTransferFeeAmount: {
        discriminator: 17,
        value: ExtensionTypeWithFields_ConfidentialTransferFeeAmount,
    },
    MetadataPointer: {
        discriminator: 18,
        value: ExtensionTypeWithFields_MetadataPointer,
    },
    TokenMetadata: {
        discriminator: 19,
        value: ExtensionTypeWithFields_TokenMetadata,
    },
    GroupPointer: {
        discriminator: 20,
        value: ExtensionTypeWithFields_GroupPointer,
    },
    TokenGroup: {
        discriminator: 21,
        value: ExtensionTypeWithFields_TokenGroup,
    },
    GroupMemberPointer: {
        discriminator: 22,
        value: ExtensionTypeWithFields_GroupMemberPointer,
    },
    TokenGroupMember: {
        discriminator: 23,
        value: ExtensionTypeWithFields_TokenGroupMember,
    },
})

export type ExtensionType_Uninitialized = undefined

export const ExtensionType_Uninitialized = unit

export type ExtensionType_TransferFeeConfig = undefined

export const ExtensionType_TransferFeeConfig = unit

export type ExtensionType_TransferFeeAmount = undefined

export const ExtensionType_TransferFeeAmount = unit

export type ExtensionType_MintCloseAuthority = undefined

export const ExtensionType_MintCloseAuthority = unit

export type ExtensionType_ConfidentialTransferMint = undefined

export const ExtensionType_ConfidentialTransferMint = unit

export type ExtensionType_ConfidentialTransferAccount = undefined

export const ExtensionType_ConfidentialTransferAccount = unit

export type ExtensionType_DefaultAccountState = undefined

export const ExtensionType_DefaultAccountState = unit

export type ExtensionType_ImmutableOwner = undefined

export const ExtensionType_ImmutableOwner = unit

export type ExtensionType_MemoTransfer = undefined

export const ExtensionType_MemoTransfer = unit

export type ExtensionType_NonTransferable = undefined

export const ExtensionType_NonTransferable = unit

export type ExtensionType_InterestBearingConfig = undefined

export const ExtensionType_InterestBearingConfig = unit

export type ExtensionType_CpiGuard = undefined

export const ExtensionType_CpiGuard = unit

export type ExtensionType_PermanentDelegate = undefined

export const ExtensionType_PermanentDelegate = unit

export type ExtensionType_NonTransferableAccount = undefined

export const ExtensionType_NonTransferableAccount = unit

export type ExtensionType_TransferHook = undefined

export const ExtensionType_TransferHook = unit

export type ExtensionType_TransferHookAccount = undefined

export const ExtensionType_TransferHookAccount = unit

export type ExtensionType_ConfidentialTransferFeeConfig = undefined

export const ExtensionType_ConfidentialTransferFeeConfig = unit

export type ExtensionType_ConfidentialTransferFeeAmount = undefined

export const ExtensionType_ConfidentialTransferFeeAmount = unit

export type ExtensionType_MetadataPointer = undefined

export const ExtensionType_MetadataPointer = unit

export type ExtensionType_TokenMetadata = undefined

export const ExtensionType_TokenMetadata = unit

export type ExtensionType_GroupPointer = undefined

export const ExtensionType_GroupPointer = unit

export type ExtensionType_TokenGroup = undefined

export const ExtensionType_TokenGroup = unit

export type ExtensionType_GroupMemberPointer = undefined

export const ExtensionType_GroupMemberPointer = unit

export type ExtensionType_TokenGroupMember = undefined

export const ExtensionType_TokenGroupMember = unit

export type ExtensionType = 
    | {
        kind: 'Uninitialized'
        value?: ExtensionType_Uninitialized
      }
    | {
        kind: 'TransferFeeConfig'
        value?: ExtensionType_TransferFeeConfig
      }
    | {
        kind: 'TransferFeeAmount'
        value?: ExtensionType_TransferFeeAmount
      }
    | {
        kind: 'MintCloseAuthority'
        value?: ExtensionType_MintCloseAuthority
      }
    | {
        kind: 'ConfidentialTransferMint'
        value?: ExtensionType_ConfidentialTransferMint
      }
    | {
        kind: 'ConfidentialTransferAccount'
        value?: ExtensionType_ConfidentialTransferAccount
      }
    | {
        kind: 'DefaultAccountState'
        value?: ExtensionType_DefaultAccountState
      }
    | {
        kind: 'ImmutableOwner'
        value?: ExtensionType_ImmutableOwner
      }
    | {
        kind: 'MemoTransfer'
        value?: ExtensionType_MemoTransfer
      }
    | {
        kind: 'NonTransferable'
        value?: ExtensionType_NonTransferable
      }
    | {
        kind: 'InterestBearingConfig'
        value?: ExtensionType_InterestBearingConfig
      }
    | {
        kind: 'CpiGuard'
        value?: ExtensionType_CpiGuard
      }
    | {
        kind: 'PermanentDelegate'
        value?: ExtensionType_PermanentDelegate
      }
    | {
        kind: 'NonTransferableAccount'
        value?: ExtensionType_NonTransferableAccount
      }
    | {
        kind: 'TransferHook'
        value?: ExtensionType_TransferHook
      }
    | {
        kind: 'TransferHookAccount'
        value?: ExtensionType_TransferHookAccount
      }
    | {
        kind: 'ConfidentialTransferFeeConfig'
        value?: ExtensionType_ConfidentialTransferFeeConfig
      }
    | {
        kind: 'ConfidentialTransferFeeAmount'
        value?: ExtensionType_ConfidentialTransferFeeAmount
      }
    | {
        kind: 'MetadataPointer'
        value?: ExtensionType_MetadataPointer
      }
    | {
        kind: 'TokenMetadata'
        value?: ExtensionType_TokenMetadata
      }
    | {
        kind: 'GroupPointer'
        value?: ExtensionType_GroupPointer
      }
    | {
        kind: 'TokenGroup'
        value?: ExtensionType_TokenGroup
      }
    | {
        kind: 'GroupMemberPointer'
        value?: ExtensionType_GroupMemberPointer
      }
    | {
        kind: 'TokenGroupMember'
        value?: ExtensionType_TokenGroupMember
      }

export const ExtensionType: Codec<ExtensionType> = sum(1, {
    Uninitialized: {
        discriminator: 0,
        value: ExtensionType_Uninitialized,
    },
    TransferFeeConfig: {
        discriminator: 1,
        value: ExtensionType_TransferFeeConfig,
    },
    TransferFeeAmount: {
        discriminator: 2,
        value: ExtensionType_TransferFeeAmount,
    },
    MintCloseAuthority: {
        discriminator: 3,
        value: ExtensionType_MintCloseAuthority,
    },
    ConfidentialTransferMint: {
        discriminator: 4,
        value: ExtensionType_ConfidentialTransferMint,
    },
    ConfidentialTransferAccount: {
        discriminator: 5,
        value: ExtensionType_ConfidentialTransferAccount,
    },
    DefaultAccountState: {
        discriminator: 6,
        value: ExtensionType_DefaultAccountState,
    },
    ImmutableOwner: {
        discriminator: 7,
        value: ExtensionType_ImmutableOwner,
    },
    MemoTransfer: {
        discriminator: 8,
        value: ExtensionType_MemoTransfer,
    },
    NonTransferable: {
        discriminator: 9,
        value: ExtensionType_NonTransferable,
    },
    InterestBearingConfig: {
        discriminator: 10,
        value: ExtensionType_InterestBearingConfig,
    },
    CpiGuard: {
        discriminator: 11,
        value: ExtensionType_CpiGuard,
    },
    PermanentDelegate: {
        discriminator: 12,
        value: ExtensionType_PermanentDelegate,
    },
    NonTransferableAccount: {
        discriminator: 13,
        value: ExtensionType_NonTransferableAccount,
    },
    TransferHook: {
        discriminator: 14,
        value: ExtensionType_TransferHook,
    },
    TransferHookAccount: {
        discriminator: 15,
        value: ExtensionType_TransferHookAccount,
    },
    ConfidentialTransferFeeConfig: {
        discriminator: 16,
        value: ExtensionType_ConfidentialTransferFeeConfig,
    },
    ConfidentialTransferFeeAmount: {
        discriminator: 17,
        value: ExtensionType_ConfidentialTransferFeeAmount,
    },
    MetadataPointer: {
        discriminator: 18,
        value: ExtensionType_MetadataPointer,
    },
    TokenMetadata: {
        discriminator: 19,
        value: ExtensionType_TokenMetadata,
    },
    GroupPointer: {
        discriminator: 20,
        value: ExtensionType_GroupPointer,
    },
    TokenGroup: {
        discriminator: 21,
        value: ExtensionType_TokenGroup,
    },
    GroupMemberPointer: {
        discriminator: 22,
        value: ExtensionType_GroupMemberPointer,
    },
    TokenGroupMember: {
        discriminator: 23,
        value: ExtensionType_TokenGroupMember,
    },
})

export interface TransferFee {
    epoch: bigint
    maximumFee: bigint
    transferFeeBasisPoints: number
}

export const TransferFee: Codec<TransferFee> = struct({
    epoch: u64,
    maximumFee: u64,
    transferFeeBasisPoints: u16,
})

export interface BasisPoints {
    basisPoints: Array<number>
}

export const BasisPoints: Codec<BasisPoints> = struct({
    basisPoints: fixedArray(u8, 2),
})

export interface MintAccount {
    mintAuthority: 
        | {
            kind: 'None'
            value?: undefined
          }
        | {
            kind: 'Some'
            value: string
          }
    supply: bigint
    decimals: number
    isInitialized: boolean
    freezeAuthority: 
        | {
            kind: 'None'
            value?: undefined
          }
        | {
            kind: 'Some'
            value: string
          }
}

export const MintAccount: Codec<MintAccount> = struct({
    mintAuthority: sum(4, {
        None: {
            discriminator: 0,
            value: unit,
        },
        Some: {
            discriminator: 1,
            value: address,
        },
    }),
    supply: u64,
    decimals: u8,
    isInitialized: bool,
    freezeAuthority: sum(4, {
        None: {
            discriminator: 0,
            value: unit,
        },
        Some: {
            discriminator: 1,
            value: address,
        },
    }),
})

export interface TokenAccount {
    mint: string
    owner: string
    amount: bigint
    delegate: 
        | {
            kind: 'None'
            value?: undefined
          }
        | {
            kind: 'Some'
            value: string
          }
    state: AccountState
    isNative: 
        | {
            kind: 'None'
            value?: undefined
          }
        | {
            kind: 'Some'
            value: bigint
          }
    delegatedAmount: bigint
    closeAuthority: 
        | {
            kind: 'None'
            value?: undefined
          }
        | {
            kind: 'Some'
            value: string
          }
}

export const TokenAccount: Codec<TokenAccount> = struct({
    mint: address,
    owner: address,
    amount: u64,
    delegate: sum(4, {
        None: {
            discriminator: 0,
            value: unit,
        },
        Some: {
            discriminator: 1,
            value: address,
        },
    }),
    state: ref(() => AccountState),
    isNative: sum(4, {
        None: {
            discriminator: 0,
            value: unit,
        },
        Some: {
            discriminator: 1,
            value: u64,
        },
    }),
    delegatedAmount: u64,
    closeAuthority: sum(4, {
        None: {
            discriminator: 0,
            value: unit,
        },
        Some: {
            discriminator: 1,
            value: address,
        },
    }),
})

export interface MultisigAccount {
    numOfSignersRequired: number
    numOfValidSignersRequired: number
    isInitialized: boolean
    signers: Array<string>
}

export const MultisigAccount: Codec<MultisigAccount> = struct({
    numOfSignersRequired: u8,
    numOfValidSignersRequired: u8,
    isInitialized: bool,
    signers: fixedArray(address, 11),
})
