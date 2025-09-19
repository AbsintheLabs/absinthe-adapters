// enrichers/base/add-protocol-metadata.ts
import { Enricher } from '../core.ts';
import type { MetadataValue } from '../../types/core.ts';

type ProtocolMetadataFields = {
  protocolMetadata: Record<string, string>; // CSV-friendly strings
  metadataJson: string; // exact, canonical JSON
};

function canonicalFlatJson(meta: Record<string, MetadataValue>): string {
  // Flat keys only. Sort keys for determinism.
  const sorted: Record<string, MetadataValue> = {};
  for (const k of Object.keys(meta).sort()) sorted[k] = meta[k];
  return JSON.stringify(sorted);
}

function toStringValue(v: MetadataValue): string {
  return typeof v === 'number' ? String(v) : v;
}

export const addProtocolMetadata = <
  T extends { meta?: Record<string, MetadataValue> } = any,
>(): Enricher<T, T & Partial<ProtocolMetadataFields>> => {
  return (item) => {
    const meta = item.meta;
    if (!meta || Object.keys(meta).length === 0) {
      // no op when meta is absent or empty
      return { ...item };
    }

    const protocolMetadata: Record<string, string> = {};
    for (const [k, v] of Object.entries(meta)) {
      protocolMetadata[k] = toStringValue(v);
    }

    const metadataJson = canonicalFlatJson(meta);

    return {
      ...item,
      protocolMetadata,
      metadataJson,
    };
  };
};
