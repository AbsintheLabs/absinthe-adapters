// src/types/unified-events.ts

// =============================================================================
// EVM UNIFIED TYPES
// =============================================================================

/**
 * UnifiedBase provides a minimal, chain-agnostic reference to a blockchain event or record.
 * This interface is intended to be embedded in all unified event types (EVM, Solana, etc.)
 * to standardize the core identifying fields across chains.
 *
 * Fields:
 *   - tsMs:   The timestamp of the event in milliseconds since Unix epoch (UTC).
 *   - height: The block height (EVM) or slot (Solana) at which the event occurred.
 *   - txRef:  A chain-agnostic transaction reference (e.g., EVM tx hash, Solana tx signature).
 */
export interface UnifiedBase {
  /** Timestamp in milliseconds since Unix epoch (UTC) */
  tsMs: number;
  /** Block height (EVM) or slot (Solana) where the event occurred */
  height: number;
  /** Chain-agnostic transaction reference (EVM tx hash, Solana tx signature, etc.) */
  txRef: string;
}

/**
 * IMPORTANT: All fields in types extending UnifiedBase must be JSON-serializable.
 *
 * The engine stores UnifiedBase-derived event contexts in Redis as JSON strings.
 * Non-serializable types (e.g., BigInt, Date, custom class instances) will cause
 * serialization failures. Use primitive types (string, number, boolean) or plain
 * objects/arrays only.
 *
 * Examples:
 *   ✓ Good: string, number, boolean, string[], Record<string, string>
 *   ✗ Bad:  BigInt, Date, Map, Set, class instances
 */

export interface UnifiedEvmLog extends UnifiedBase {
  // Event identification
  address: string; // lowercase, normalized
  topic0: string;
  topics: string[]; // topics[0] is the event signature
  data: string; // hex-encoded log data

  // Position in the block
  logIndex: number;

  // Chain context
  chainId: number;

  // Transaction context (optional - may not always be available)
  transactionFrom: string;
  transactionTo: string | null;
  gasUsed: string;
  effectiveGasPrice: string;
}

export interface UnifiedEvmTransaction extends UnifiedBase {
  transactionFrom: string;
  transactionTo: string | null;
  value: string;
  input: string; // calldata

  // Block
  transactionIndex: number;

  chainId: number;

  gasUsed: string;
  effectiveGasPrice: string;
  status: number; // 1 = success, 0 = failure
}

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
