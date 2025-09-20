/**
 * @fileoverview Enricher for adding protocol metadata as JSON to data items.
 *
 * This module provides functionality to transform raw metadata objects into
 * canonical JSON format suitable for CSV export.
 */

import { Enricher } from '../core.ts';
import type { MetadataValue } from '../../types/core.ts';

/**
 * Fields added by the protocol metadata enricher.
 *
 * @interface ProtocolMetadataFields
 */
type ProtocolMetadataFields = {
  /** Canonical JSON representation of metadata for exact comparison */
  metadataJson: string;
};

/**
 * Enricher that adds protocol metadata as JSON to data items.
 *
 * This enricher extracts metadata from the 'meta' property of input items
 * and creates a canonical JSON representation suitable for CSV export.
 *
 * If no metadata exists or the metadata object is empty, the enricher
 * returns the item unchanged.
 *
 * @template T - Base type of the data item
 * @returns Enricher function that adds metadataJson field
 *
 * @example
 * ```typescript
 * const enricher = addProtocolMetadata();
 * const result = enricher({
 *   id: '123',
 *   meta: { blockNumber: 1000, txHash: '0xabc' }
 * });
 * // Result includes metadataJson field
 * ```
 */
export const addProtocolMetadata = <T extends object>(): Enricher<
  T,
  T & Partial<ProtocolMetadataFields>
> => {
  return (item) => {
    // no-op when meta is absent or empty
    const meta = (item as any).meta as Record<string, MetadataValue> | undefined;
    if (!meta || Object.keys(meta).length === 0) return { ...item };

    // sort meta and convert to canonical JSON string
    const sorted: Record<string, MetadataValue> = {};
    for (const k of Object.keys(meta).sort()) sorted[k] = meta[k];

    return {
      ...item,
      metadataJson: JSON.stringify(sorted),
    };
  };
};
