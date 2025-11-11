import { Block, Log, Transaction } from '../eprocessorBuilder.ts';
import { logger } from '../utils/logger.ts';
import * as z from 'zod';
import { formatZodError } from '../utils/zod-error.ts';
import { UnifiedBaseSchema } from '../types/unified-chain-events.ts';

// =============================================================================
// UNIFIED EVM TYPES (defined once in Zod)
// =============================================================================

/**
 * UnifiedEvmLog schema - validates and transforms SQD log data to our unified format.
 * All fields are JSON-serializable (no BigInt, Date, etc).
 */

// TODO: Generalize it with UnifiedBase
export const UnifiedEvmLogSchema = UnifiedBaseSchema.extend({
  // Event identification
  address: z.string(),
  topic0: z.string(),
  topics: z.array(z.string()),
  data: z.string(),

  // Chain context
  chainId: z.number(),

  // Transaction context
  transactionFrom: z.string(),
  transactionTo: z.string().nullable(),
  gasUsed: z.string(),
  effectiveGasPrice: z.string(),
});

/**
 * UnifiedEvmTransaction schema - validates and transforms SQD transaction data to our unified format.
 * All fields are JSON-serializable (no BigInt, Date, etc).
 */
//TODO: Generalize it with UnifiedBase (or not , confirm with team + think equivalent in solana, then generalize)
export const UnifiedEvmTransactionSchema = UnifiedBaseSchema.extend({
  // Transaction data
  transactionFrom: z.string(),
  transactionTo: z.string().nullable(),
  value: z.string(),
  input: z.string(),
  // Chain context
  chainId: z.number(),

  // Gas and status
  gasUsed: z.string(),
  effectiveGasPrice: z.string(),
  status: z.number().optional(),
});

// Infer TypeScript types from Zod schemas
export type UnifiedEvmLog = z.infer<typeof UnifiedEvmLogSchema>;
export type UnifiedEvmTransaction = z.infer<typeof UnifiedEvmTransactionSchema>;

// =============================================================================
// FILTER FUNCTIONS - simple functions, no registry
// =============================================================================

/**
 * Returns a filtered subset of UnifiedEvmLog suitable for compact storage/display.
 * Includes UnifiedBase fields + key identifiers.
 */
export function filterEvmLog(data: UnifiedEvmLog) {
  return {
    tsMs: data.tsMs,
    height: data.height,
    txRef: data.txRef,
    address: data.address,
    index: data.index,
    transactionFrom: data.transactionFrom,
    transactionTo: data.transactionTo,
  };
}

/**
 * Returns a filtered subset of UnifiedEvmTransaction suitable for compact storage/display.
 * Includes UnifiedBase fields + key transaction data.
 */
export function filterEvmTransaction(data: UnifiedEvmTransaction) {
  return {
    tsMs: data.tsMs,
    height: data.height,
    txRef: data.txRef,
    transactionFrom: data.transactionFrom,
    transactionTo: data.transactionTo,
    value: data.value,
    gasUsed: data.gasUsed,
    effectiveGasPrice: data.effectiveGasPrice,
    index: data.index,
  };
}

// =============================================================================
// SQD DATA VALIDATION SCHEMAS (for input validation only)
// =============================================================================

const BlockHeaderSchema = z.object({
  height: z.number(),
  hash: z.string(),
  timestamp: z.number(),
});

const TransactionForLogSchema = z.object({
  from: z.string().min(1, 'Transaction from address is required'),
  // Note: .optional() required to handle contract creation transactions (to === undefined)

  to: z.string().optional(),
  gasUsed: z
    .union([z.bigint(), z.string()])
    .transform((val) => (typeof val === 'bigint' ? val.toString() : val)),
  effectiveGasPrice: z
    .union([z.bigint(), z.string()])
    .transform((val) => (typeof val === 'bigint' ? val.toString() : val)),
  value: z
    .union([z.bigint(), z.string()])
    .transform((val) => (typeof val === 'bigint' ? val.toString() : val))
    .optional(),
  hash: z.string().optional(),
  status: z.number().optional(),
});

const LogSchema = z.object({
  address: z.string().min(1, 'Log address is required'),
  topics: z.array(z.string()).min(1, 'Log must have at least one topic'),
  data: z.string(),
  transactionHash: z.string().min(1, 'Transaction hash is required'),
  logIndex: z.number(),
  transaction: TransactionForLogSchema.nullable(),
});

const TransactionSchema = z.object({
  hash: z.string().min(1, 'Transaction hash is required'),
  from: z.string().min(1, 'Transaction from address is required'),
  // Note: .optional() required to handle contract creation transactions (to === undefined)

  to: z.string().optional(),
  value: z
    .union([z.bigint(), z.string()])
    .transform((val) => (typeof val === 'bigint' ? val.toString() : val)),
  sighash: z.string(),
  transactionIndex: z.number(),
  gasUsed: z
    .union([z.bigint(), z.string()])
    .transform((val) => (typeof val === 'bigint' ? val.toString() : val)),
  effectiveGasPrice: z
    .union([z.bigint(), z.string()])
    .transform((val) => (typeof val === 'bigint' ? val.toString() : val)),
  status: z.number().optional(),
});

export function transformSqdLogToUnified(block: Block, log: Log, chainId: number): UnifiedEvmLog {
  if (!log.transaction) {
    logger.error('Log has no transaction', { log });
    throw new Error('Log has no transaction');
  }

  // Validate block header
  const blockHeaderResult = BlockHeaderSchema.safeParse(block.header);
  if (!blockHeaderResult.success) {
    const errorMsg = formatZodError(blockHeaderResult.error, {
      blockHeader: block.header,
      chainId,
    });
    logger.error('Invalid block header structure', { error: errorMsg });
    throw new Error(`Block header validation failed: ${errorMsg}`);
  }

  // Validate log structure
  const logResult = LogSchema.safeParse(log);
  if (!logResult.success) {
    const errorMsg = formatZodError(logResult.error, {
      block,
      log,
      chainId,
    });
    logger.error('Invalid log structure', { error: errorMsg });
    throw new Error(`Log validation failed at block ${block.header.height}: ${errorMsg}`);
  }

  return {
    address: log.address.toLowerCase(),
    topic0: log.topics[0],
    topics: log.topics,
    data: log.data,

    height: block.header.height,
    tsMs: block.header.timestamp,
    txRef: log.transactionHash,
    index: log.logIndex,

    chainId,

    transactionFrom: log.transaction.from,
    transactionTo: log.transaction.to ?? null,
    gasUsed: log.transaction.gasUsed.toString(),
    effectiveGasPrice: log.transaction.effectiveGasPrice.toString(),
  };
}

export function transformSqdTransactionToUnified(
  block: Block,
  tx: Transaction,
  chainId: number,
): UnifiedEvmTransaction {
  // Validate block header
  const blockHeaderResult = BlockHeaderSchema.safeParse(block.header);
  if (!blockHeaderResult.success) {
    const errorMsg = formatZodError(blockHeaderResult.error, {
      block,
      tx,
    });
    logger.error('Invalid block header structure for transaction', { error: errorMsg });
    throw new Error(`Block header validation failed: ${errorMsg}`);
  }

  // Validate transaction structure
  const txResult = TransactionSchema.safeParse(tx);
  if (!txResult.success) {
    const errorMsg = formatZodError(txResult.error, {
      block: {
        height: block.header.height,
        hash: block.header.hash,
        timestamp: block.header.timestamp,
      },
      transaction: {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        gasUsed: tx.gasUsed,
        effectiveGasPrice: tx.effectiveGasPrice,
        status: tx.status,
        index: tx.transactionIndex,
      },
      chainId,
    });
    logger.error('Invalid transaction structure', { error: errorMsg });
    throw new Error(`Transaction validation failed at block ${block.header.height}: ${errorMsg}`);
  }

  return {
    height: block.header.height,
    tsMs: block.header.timestamp,
    txRef: tx.hash,
    transactionFrom: tx.from.toLowerCase(),
    transactionTo: tx.to?.toLowerCase() ?? null,
    value: tx.value.toString(),
    input: tx.input,

    index: tx.transactionIndex,

    chainId,

    gasUsed: tx.gasUsed.toString(),
    effectiveGasPrice: tx.effectiveGasPrice.toString(),
    status: tx.status,
  };
}
