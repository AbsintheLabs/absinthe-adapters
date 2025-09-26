// manifest.ts
import { z } from 'zod';
import { SEMVER_RE } from '../adapter-core.js';

export const QuantityType = z.enum(['token_based', 'raw_number', 'none']);
export const TrackableKind = z.enum(['action', 'position']);

// minimal field types, can expand later
const FieldTypes = {
  EvmAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/i, 'Invalid EVM address'),
  String: z.string(),
  Number: z.number(),
  Boolean: z.boolean(),
} as const;
type FieldTypeId = keyof typeof FieldTypes;

const Param = z.object({
  role: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(['EvmAddress', 'String', 'Number', 'Boolean']).optional(),
});

const Filter = Param.extend({
  requiredForPricing: z.boolean().optional(),
});

const Trackable = z.object({
  id: z.string().min(1),
  kind: TrackableKind,
  quantityType: QuantityType,
  params: z.array(Param).default([]),
  filters: z.array(Filter).default([]),
  requiredPricer: z.string().optional(), // for positions that require NAV scheme, etc.
});

export const ManifestZ = z
  .object({
    name: z.string().min(1),
    semver: z.string().regex(SEMVER_RE, 'Invalid SemVer'),
    trackables: z.array(Trackable).min(1),
  })
  .strict();

export type Manifest = z.infer<typeof ManifestZ>;
export { FieldTypes, type FieldTypeId };
