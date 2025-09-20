// enrichers/base/add-window-computations.ts
import Big from 'big.js';
import { Enricher } from '../core.ts';

type WindowComputationFields = {
  rawDelta?: string;
  windowDurationMs: number;
  windowUtcStartTsMs: number;
  windowUtcEndTsMs: number;
};

function safeJsonStringify(meta: any | undefined): string | undefined {
  if (meta == null) return undefined;
  try {
    return JSON.stringify(meta);
  } catch {
    return undefined;
  }
}

export const addWindowComputations = <
  T extends {
    startTs: number;
    endTs: number;
    rawBefore?: string;
    rawAfter?: string;
    meta?: any;
  },
>(): Enricher<T, T & WindowComputationFields> => {
  return (item) => {
    const startTs = Number(item.startTs);
    const endTs = Number(item.endTs);
    const windowDurationMs = isFinite(endTs - startTs) ? endTs - startTs : 0;

    let rawDelta: string | undefined;
    if (item.rawAfter != null && item.rawBefore != null) {
      try {
        rawDelta = new Big(item.rawAfter).minus(new Big(item.rawBefore)).toString();
      } catch {
        rawDelta = undefined;
      }
    }

    return {
      ...item,
      ...(rawDelta != null ? { rawDelta } : {}),
      windowDurationMs,
      windowUtcStartTsMs: startTs,
      windowUtcEndTsMs: endTs,
    };
  };
};
