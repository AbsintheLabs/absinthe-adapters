import { RawAction } from '../../types/enrichment.ts';
import { Enricher } from '../core.ts';

/**
 * Deduplicates actions based on their key property
 */
const seenKeys = new Set<string>();

export const dedupeActions = <T extends RawAction>(): Enricher<T, T | undefined> => {
  return (item) => {
    const key = item.key;
    if (seenKeys.has(key)) return undefined; // signal to pipeline to filter out
    seenKeys.add(key);
    return item;
  };
};
