/**
 * @fileoverview Enricher for adding protocol metadata as JSON to data items.
 *
 * This module provides functionality to transform raw metadata objects into
 * canonical JSON format suitable for Avro export.
 */

import { Enricher } from '../core.ts';
import type { MetadataValue, NormalizedMetadataValue } from '../../types/core.ts';

/**
 * Fields added by the protocol metadata enricher.
 *
 * @interface ProtocolMetadataFields
 */
type ProtocolMetadataFields = {
  /** Canonical JSON representation of metadata in Avro-compatible format */
  metadata_json: string | null;
};

/**
 * Normalizes a metadata value to the Avro format.
 *
 * @param value - The metadata value (string, number, or typed object)
 * @returns Normalized metadata value with explicit type
 */
function normalizeMetadataValue(value: MetadataValue): NormalizedMetadataValue {
  // Already typed object
  if (typeof value === 'object' && 'value' in value && 'type' in value) {
    // Map address types to generic "address"
    const type =
      value.type === 'evm_address' || value.type === 'sol_address' ? 'address' : value.type;

    return {
      value: value.value,
      type,
    };
  }

  // Auto-type based on JavaScript type
  if (typeof value === 'number') {
    return {
      value: String(value),
      type: 'number',
    };
  }

  // Default to string
  return {
    value: String(value),
    type: 'string',
  };
}

/**
 * Enricher that adds protocol metadata as JSON to data items.
 *
 * This enricher extracts metadata from the 'meta' property of input items
 * and creates a canonical JSON representation in Avro-compatible format.
 *
 * Each metadata entry is transformed into:
 * ```
 * {
 *   "key": {
 *     "value": "string-encoded-value",
 *     "type": "string" | "number" | "bigint" | "address" | "boolean"
 *   }
 * }
 * ```
 *
 * If no metadata exists or the metadata object is empty, the enricher
 * returns the item unchanged.
 *
 * @template T - Base type of the data item
 * @returns Enricher function that adds metadata_json field
 *
 * @example
 * ```typescript
 * const enricher = addProtocolMetadata();
 * const result = enricher({
 *   id: '123',
 *   meta: {
 *     blockNumber: 1000,
 *     txHash: '0xabc',
 *     liquidity: { value: "999999999999", type: "bigint" }
 *   }
 * });
 * // Result includes metadata_json with Avro-formatted data
 * ```
 */
export const addProtocolMetadata = <
  T extends { meta: Record<string, MetadataValue> | null },
>(): Enricher<T, T & ProtocolMetadataFields> => {
  return (item) => {
    // no-op when meta is absent or empty
    const meta = item.meta;
    if (!meta || Object.keys(meta).length === 0) return { ...item, metadata_json: null };

    // Transform and sort metadata into Avro format
    const normalized: Record<string, NormalizedMetadataValue> = {};
    for (const k of Object.keys(meta).sort()) {
      normalized[k] = normalizeMetadataValue(meta[k]);
    }

    return {
      ...item,
      metadata_json: JSON.stringify(normalized),
    };
  };
};
