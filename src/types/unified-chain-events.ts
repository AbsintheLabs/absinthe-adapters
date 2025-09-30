// src/types/unified-events.ts

// =============================================================================
// EVM UNIFIED TYPES
// =============================================================================

export type UnifiedEvmLog = {
  // Event identification
  address: string; // lowercase, normalized
  topics: string[]; // topics[0] is the event signature
  data: string; // hex-encoded log data

  // Position in blockchain
  blockNumber: number;
  blockTimestampMs: number; // Unix timestamp in milliseconds
  transactionHash: string;
  logIndex: number;

  // Chain context
  chainId: number;

  // Transaction context (optional - may not always be available)
  transactionFrom?: string;
  transactionTo?: string;
  gasUsed?: bigint;
  effectiveGasPrice?: bigint;
};

export type UnifiedEvmTransaction = {
  hash: string;
  transactionFrom: string;
  transactionTo: string | null; // null for contract creation
  value: bigint;
  input: string; // calldata

  // Block
  blockNumber: number;
  blockTimestampMs: number; // Unix timestamp in milliseconds
  transactionIndex: number;

  chainId: number;

  gasUsed?: bigint;
  effectiveGasPrice?: bigint;
  gasLimit?: bigint;
  status?: number; // 1 = success, 0 = failure
};

// // =============================================================================
// // SOLANA UNIFIED TYPES (future)
// // =============================================================================

// export type UnifiedSolanaInstruction = {
//   programId: string;
//   accounts: string[];
//   data: string; // base58 encoded

//   slot: number;
//   blockTime: number;
//   signature: string;
//   instructionIndex: number;

//   // Solana-specific
//   innerInstructions?: any[];
// };

// export type UnifiedSolanaTransaction = {
//   signature: string;
//   slot: number;
//   blockTime: number;
//   fee: bigint;
//   // ... etc
// };

// // =============================================================================
// // STELLAR UNIFIED TYPES (future)
// // =============================================================================

// export type UnifiedStellarOperation = {
//   type: string;
//   sourceAccount: string;

//   ledger: number;
//   closedAt: number;
//   transactionHash: string;
//   operationIndex: number;

//   // ... etc
// };

// // =============================================================================
// // CHAIN TYPE UNIONS
// // =============================================================================

// export type UnifiedLog = UnifiedEvmLog | UnifiedSolanaInstruction | UnifiedStellarOperation;
// export type UnifiedTransaction = UnifiedEvmTransaction | UnifiedSolanaTransaction;
// export type UnifiedBlock = UnifiedEvmBlock; // extend as needed
