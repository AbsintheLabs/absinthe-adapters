import { Asset } from '../../types/asset.ts';
import { Enricher } from '../core.ts';

/**
 * Drops temporary fields that were used during the enrichment pipeline
 * but are not part of the final EnrichedWindow schema.
 *
 * These fields include:
 * - startTs, endTs: Raw timestamps (converted to windowUtcStartTsMs/windowUtcEndTsMs)
 *
 * This enricher provides both compile-time and runtime safety by explicitly
 * removing these fields from the type and the runtime object.
 */
export const dropWindowExtraFields = <
  T extends {
    startTs: number;
    endTs: number;
    asset: Asset;
  },
>(): Enricher<T, Omit<T, 'asset' | 'startTs' | 'endTs'>> => {
  return (item) => {
    // Destructure to drop the unwanted fields at runtime
    const { startTs, endTs, asset, ...rest } = item;

    // TypeScript knows the returned object doesn't have startTs or endTs
    return rest;
  };
};
