// fixme: we probably want to create better typing rather than relying on eproccessorBuilder.ts
import { Block, Log, Transaction } from '../eprocessorBuilder.ts';
import { UnifiedEvmLog, UnifiedEvmTransaction } from '../types/unified-chain-events.ts';

export function transformSqdLogToUnified(block: Block, log: Log, chainId: number): UnifiedEvmLog {
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

    // fixme: can we ensure that transaction is always available?
    transactionFrom: log.transaction?.from,
    transactionTo: log.transaction?.to,
    gasUsed: log.transaction?.gasUsed,
    effectiveGasPrice: log.transaction?.effectiveGasPrice,
  };
}

export function transformSqdTransactionToUnified(
  block: Block,
  tx: Transaction,
  chainId: number,
): UnifiedEvmTransaction {
  return {
    height: block.header.height,
    tsMs: block.header.timestamp,
    txRef: tx.hash,
    transactionFrom: tx.from.toLowerCase(),
    transactionTo: tx.to.toLowerCase(),
    value: tx.value,
    input: tx.input,

    transactionIndex: tx.transactionIndex,

    chainId,

    gasUsed: tx.gasUsed,
    effectiveGasPrice: tx.effectiveGasPrice,
    status: tx.status,
  };
}
