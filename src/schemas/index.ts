/**
 * @absinthe/adapters - Schema Exports
 *
 * This module exports Zod schemas for Actions and Positions that can be
 * imported by other repositories via git dependency.
 *
 * Usage in other repos:
 *   import { ActionSchema, PositionSchema } from '@absinthe/adapters/schemas';
 */

// Re-export the main event schemas
export {
  EnrichedActionSchema as ActionSchema,
  EnrichedPositionSchema as PositionSchema,
  type EnrichedAction as Action,
  type EnrichedPosition as Position,
  CommonFieldsSchema,
  AssetFieldsSchema,
  AssetFieldsSchemaOptional,
} from '../types/events.ts';

// Re-export supporting schemas that users might need
export {
  MeasurementTypeSchema,
  DenominationSchema,
  TrackableKindSchema,
  type MeasurementType,
  type Denomination,
  type TrackableKind,
} from '../types/manifest.ts';

export { ChainArchSchema, type ChainArch } from '../config/schema.ts';

export { AssetEnum, type Asset, type AssetType } from '../types/asset.ts';
