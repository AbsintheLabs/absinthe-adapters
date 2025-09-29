// manifest.ts
import { z } from 'zod';
import { PROTOCOL_FAMILY_VALUES } from '../constants.ts';

// Simple version type using template literal
export type Version = `${number}.${number}.${number}`;

export const QuantityTypeSchema = z.enum(['token_based', 'count', 'none']);
export const TrackableKindSchema = z.enum(['action', 'position']);

export type QuantityType = z.infer<typeof QuantityTypeSchema>;
export type TrackableKind = z.infer<typeof TrackableKindSchema>;

// 1) Generic FieldDef for TypeScript (separate from Zod)
export type FieldDef<T extends z.ZodTypeAny = z.ZodTypeAny> = {
  description: string;
  schema: T;
};

export type FilterDef<T extends z.ZodTypeAny = z.ZodTypeAny> = FieldDef<T> & {
  requiredForPricing?: boolean;
};

// 2) Helper functions return FieldDef<T> with proper generics
export const evmAddress = (description: string): FieldDef<z.ZodType<string>> => ({
  description,
  schema: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/i, 'Invalid EVM address')
    .transform((val) => val.toLowerCase()),
});

export const solAddress = (description: string): FieldDef<z.ZodString> => ({
  description,
  schema: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/i, 'Invalid Solana address'),
});

export const stringField = (description: string): FieldDef<z.ZodString> => ({
  description,
  schema: z.string(),
});

export const numberField = (description: string): FieldDef<z.ZodNumber> => ({
  description,
  schema: z.number(),
});

export const booleanField = (description: string): FieldDef<z.ZodBoolean> => ({
  description,
  schema: z.boolean(),
});

// Keep Zod Field for runtime validation (but don't use for TS inference)
const Field = z.object({
  description: z.string().min(1),
  schema: z.any(), // ZodSchema - this is fine for runtime validation
});

const Filter = Field.extend({
  requiredForPricing: z.boolean().default(false).optional(),
});

// 3) Define TS manifest shape that uses FieldDef (separate from Zod)
export type TrackableDef = {
  kind: TrackableKind;
  quantityType: TrackableKind extends 'position'
    ? 'token_based'
    : TrackableKind extends 'action'
      ? 'token_based' | 'count' | 'none'
      : QuantityType;
  params: Record<string, FieldDef>; // required
  filters?: Record<string, FilterDef>; // optional
  requiredPricer?: string;
} & (
  | { kind: 'position'; quantityType: 'token_based' }
  | { kind: 'action'; quantityType: 'token_based' | 'count' | 'none' }
);

export type Manifest = {
  name: string;
  version: Version;
  forkOf?: (typeof PROTOCOL_FAMILY_VALUES)[number];
  trackables: Record<string, TrackableDef>;
};

// Keep Zod schema for runtime validation (but don't use z.infer for TS types)
const Trackable = z.object({
  kind: TrackableKindSchema,
  quantityType: QuantityTypeSchema,
  params: z.record(z.string(), Field).optional(),
  filters: z.record(z.string(), Filter).optional(),
  requiredPricer: z.string().optional(), // for positions that require NAV scheme, etc.
});

// 4) Infer config type from TS manifest (not from Zod)
type InferField<F extends FieldDef<any>> = z.infer<F['schema']>;

type ParamsFrom<T extends TrackableDef> = {
  [K in keyof T['params']]: InferField<T['params'][K]>;
};

type FiltersFrom<T extends TrackableDef> =
  T['filters'] extends Record<string, FilterDef<any>>
    ? { [K in keyof T['filters']]: InferField<T['filters'][K]> }
    : never;

type PricingFrom<T extends TrackableDef> = T['requiredPricer'] extends string
  ? { pricing?: { kind: T['requiredPricer'] } & Record<string, unknown> }
  : { pricing?: Record<string, unknown> };

export type InstanceFrom<T extends TrackableDef> = {
  params: ParamsFrom<T>;
} & (T['filters'] extends Record<string, FilterDef<any>> ? { filters?: FiltersFrom<T> } : {}) &
  PricingFrom<T>;

export type ConfigFromManifest<M extends Manifest> = {
  [K in keyof M['trackables']]: InstanceFrom<M['trackables'][K]>[];
};

export const ManifestZ = z
  .object({
    name: z.string().min(1),
    version: z.string() as z.ZodType<Version>,
    forkOf: z.enum(PROTOCOL_FAMILY_VALUES).optional(),
    trackables: z.record(z.string(), Trackable),
  })
  .strict();
