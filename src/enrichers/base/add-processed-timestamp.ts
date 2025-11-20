// enrichers/base/add-processed-timestamp.ts
import { Enricher } from '../core.ts';

type ProcessedTimestampField = {
  processed_at_ms: number;
};

/**
 * Adds processed_at_ms field to track when the event was processed by the system.
 * This is different from ts_ms which represents the on-chain timestamp.
 * processed_at_ms is useful for monitoring processing latency and debugging.
 */
export const addProcessedTimestamp = <T extends object>(): Enricher<
  T,
  T & ProcessedTimestampField
> => {
  return (item) => {
    return {
      ...item,
      processed_at_ms: Date.now(),
    };
  };
};
