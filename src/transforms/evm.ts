import { Block, Log, Transaction } from '../eprocessorBuilder.ts';
import { UnifiedEvmLog, UnifiedEvmTransaction } from '../types/unified-chain-events.ts';
import { logger } from '../utils/logger.ts';
import * as z from 'zod';

// Zod schemas for validating SQD data structures
const BlockHeaderSchema = z.object({
  height: z.number(),
  hash: z.string(),
  timestamp: z.number(),
});

const TransactionForLogSchema = z.object({
  from: z.string().min(1, 'Transaction from address is required'),
  to: z.string().min(1, 'Transaction to address is required').nullable(),
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
  to: z.string().min(1, 'Transaction to address is required').nullable(),
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

function formatZodError(error: z.ZodError, context: Record<string, unknown>): string {
  const prettyError = z.prettifyError(error);
  const contextStr = JSON.stringify(
    context,
    (key, value) => (typeof value === 'bigint' ? value.toString() : value),
    2,
  );
  return `${prettyError}\n\nContext: ${contextStr}`;
}

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
    logIndex: log.logIndex,

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
        transactionIndex: tx.transactionIndex,
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

    transactionIndex: tx.transactionIndex,

    chainId,

    gasUsed: tx.gasUsed.toString(),
    effectiveGasPrice: tx.effectiveGasPrice.toString(),
    status: tx.status,
  };
}
