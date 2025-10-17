import { RawWindow } from '../../types/enrichment.ts';
import { Enricher } from '../core.ts';
import Big from 'big.js';

export interface WindowDurationFields {
  window_utc_start_ts_ms: number;
  window_utc_end_ts_ms: number;
  window_duration_ms: number;
  start_height: number;
  end_height: number | null;
  start_tx_ref: string;
  end_tx_ref: string | null;
  raw_before: string;
  raw_after: string;
  raw_delta: string;
  start_value: string;
  end_value: string;
}

export const addWindowing = <T extends RawWindow>(): Enricher<T, T & WindowDurationFields> => {
  return (item) => {
    return {
      ...item,
      window_utc_start_ts_ms: item.startTs,
      window_utc_end_ts_ms: item.endTs,
      window_duration_ms: item.endTs - item.startTs,
      start_height: item.startHeight,
      end_height: item.endHeight,
      start_tx_ref: item.startTxRef,
      end_tx_ref: item.endTxRef,
      raw_before: item.startValue,
      raw_after: item.endValue,
      raw_delta: new Big(item.endValue).minus(new Big(item.startValue)).toString(),
      start_value: item.startValue,
      end_value: item.endValue,
    };
  };
};
