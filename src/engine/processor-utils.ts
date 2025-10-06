/**
 * Utilities for configuring and manipulating Subsquid processor instances
 */

import { EvmBatchProcessor } from '@subsquid/evm-processor';

/**
 * HACK: Ensures all log requests include transaction data
 * This modifies the processor's internal request configuration to always fetch transaction details
 * when processing logs, which is needed for gas calculations and transaction context.
 *
 * @param sqdProcessor - The Subsquid processor instance to modify
 */
export function ensureTransactionDataForLogs(sqdProcessor: EvmBatchProcessor): EvmBatchProcessor {
  for (const request of sqdProcessor['requests']) {
    if (request.request.logs) {
      request.request.logs.forEach((log: any) => {
        log.transaction = true;
      });
    }
  }
  return sqdProcessor;
}
