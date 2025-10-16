import { RawWindow } from '../../types/enrichment.ts';
import { Enricher } from '../core.ts';
import Big from 'big.js';

export interface WindowDurationFields {
  windowUtcStartTsMs: number;
  windowUtcEndTsMs: number;
  windowDurationMs: number;
  startHeight: number;
  // endHeight: number | null;
  rawBefore: string;
  rawAfter: string;
  rawDelta: string;
}

export const addWindowing = <T extends RawWindow>(): Enricher<T, T & WindowDurationFields> => {
  return (item) => {
    return {
      ...item,
      windowUtcStartTsMs: item.startTs,
      windowUtcEndTsMs: item.endTs,
      windowDurationMs: item.endTs - item.startTs,
      startHeight: item.startHeight,
      // fixme: well, this is a weird hack
      ...(item.endHeight && { endHeight: item.endHeight }),
      rawBefore: item.startValue,
      rawAfter: item.endValue,
      rawDelta: new Big(item.endValue).minus(new Big(item.startValue)).toString(),
    };
  };
};
