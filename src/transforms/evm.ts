// fixme: we probably want to create better typing rather than relying on eproccessorBuilder.ts
import { Block, Log, Transaction } from '../eprocessorBuilder.ts';
import { UnifiedEvmLog, UnifiedEvmTransaction } from '../types/unified-chain-events.ts';

export function transformEvmLog(block: Block, log: Log, chainId: number): UnifiedEvmLog {
  return {
    address: log.address.toLowerCase(),
    topics: log.topics,
    data: log.data,

    blockNumber: block.header.height,
    blockTimestampMs: block.header.timestamp,
    transactionHash: log.transactionHash,
    logIndex: log.logIndex,

    chainId,

    // fixme: can we ensure that transaction is always available?
    transactionFrom: log.transaction?.from,
    transactionTo: log.transaction?.to,
    gasUsed: log.transaction?.gasUsed,
    effectiveGasPrice: log.transaction?.effectiveGasPrice,
  };
}

export function transformEvmTransaction(
  block: Block,
  tx: Transaction,
  chainId: number,
): UnifiedEvmTransaction {
  return {
    hash: tx.hash,
    transactionFrom: tx.from.toLowerCase(),
    transactionTo: tx.to.toLowerCase(),
    value: tx.value,
    input: tx.input,

    blockNumber: block.header.height,
    blockTimestampMs: block.header.timestamp,
    transactionIndex: tx.transactionIndex,

    chainId,

    gasUsed: tx.gasUsed,
    effectiveGasPrice: tx.effectiveGasPrice,
    status: tx.status,
  };
}
