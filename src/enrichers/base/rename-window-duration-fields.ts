import { RawPosition } from '../../types/enrichment.ts';
import { Enricher } from '../core.ts';

interface WindowDurationFields {
  windowUtcStartTsMs: number;
  windowUtcEndTsMs: number;
  windowDurationMs: number;
  startHeight: number;
  endHeight?: number;
}

export const renameWindowDurationFields = <T extends RawPosition>(): Enricher<
  T,
  T & WindowDurationFields
> => {
  return (item) => {
    return {
      ...item,
      windowUtcStartTsMs: item.startTs,
      windowUtcEndTsMs: item.endTs,
      windowDurationMs: item.endTs - item.startTs,
      startHeight: item.startHeight,
      ...(item.endHeight && { endHeight: item.endHeight }),
    };
  };
};
