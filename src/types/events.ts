// Asset information interface
import { z } from 'zod';
// import { ChainArchSchema } from '../config/schema.ts';
// // import { DenominationSchema, MeasurementTypeSchema } from './manifest.ts';
// // import { POSITION_REASONS } from './adapter.ts';
// // import { AssetEnum } from './asset.ts';

export const ChainArchSchema = z.enum(['evm', 'solana']);
export const MeasurementTypeSchema = z.enum(['token_based', 'count', 'none']);
export const DenominationSchema = z.enum(['usd', /*'raw_token',*/ 'scaled_token', 'none']); // 'raw_token' is deprecated
export const POSITION_REASONS = [
  'BALANCE_CHANGED',
  'POSITION_REVALUED',
  'POSITION_DEACTIVATED',
  'PERIOD_ELAPSED',
  'INDEXER_STOPPED',
] as const;
export const AssetEnum = z.enum(['erc20', 'erc721', 'spl', 'custom']);

export const CommonFieldsSchema = z.object({
  runner_commit_sha: z.string(),
  runner_api_key_hash: z.string().nullable(),
  runner_config_hash: z.string(),
  runner_runner_id: z.string(),

  // Added by addAdapterProtocolMeta
  adapter_version: z.string(),
  protocol_name: z.string(),

  // Added by addChainMetadata
  chain_id: z.string(),
  chain_short_name: z.string(),
  chain_arch: ChainArchSchema,

  measurement_type: MeasurementTypeSchema,
  denomination: DenominationSchema,

  // Added by calculateQuantity
  quantity: z.number(),
  activity: z.string(), // Activity is a union with string fallback
  trackable_instance_id: z.string(),

  // Added by addBaseEventId (backwards compatibility)
  event_id: z.string(),
});

export const AssetFieldsSchema = z.object({
  asset_key: z.string(),
  decimals: z.number(),
  // FIXME: this needs a bit of a better solution
  asset_type: AssetEnum,
});

// For actions where asset fields can be null/absent, make each field optional
export const AssetFieldsSchemaOptional = z.object({
  asset_key: z.string().nullable(),
  decimals: z.number().nullable(),
  asset_type: AssetEnum.nullable(),
});

export const EnrichedPositionSchema = z
  .object({
    user: z.string(),
    // asset: z.string(),

    // window fields
    window_utc_start_ts_ms: z.number(),
    // even if there is no end block, we still need to have an end ts
    window_utc_end_ts_ms: z.number(),
    window_duration_ms: z.number(),
    start_height: z.number(),
    // when exhausted, there is no end height
    end_height: z.number().nullable(),
    start_tx_ref: z.string(),
    // when exhausted, there is no end tx ref
    end_tx_ref: z.string().nullable(),

    emit_cause: z.enum(POSITION_REASONS),

    // todo: make this DRY rather than hardcoding the name of this here
    topic_type: z.literal('position'),

    // raw position
    raw_before: z.string(),
    raw_after: z.string(),
    raw_delta: z.string(),

    start_value: z.string(),
    end_value: z.string(),

    // Added by addProtocolMetadata
    metadata_json: z.string().nullable(),

    // Context fields (stringified JSON, always present but nullable)
    start_ctx_json: z.string().nullable(),
    end_ctx_json: z.string().nullable(),
  })
  .extend(CommonFieldsSchema.shape)
  .extend(AssetFieldsSchema.shape); // required bc window is always a token_based

export type EnrichedPosition = z.infer<typeof EnrichedPositionSchema>;
/**
 * Zod schema for the final enriched action shape.
 * Single source of truth - both runtime validation and TypeScript type.
 *
 * .strip() automatically removes any extra fields not defined in the schema.
 * This means the pipeline can add temporary fields during enrichment,
 * and they'll be automatically cleaned up when parsed.
 */
export const EnrichedActionSchema = z
  .object({
    // Original RawAction fields
    user: z.string(),
    ts_ms: z.number(),
    height: z.number(),
    tx_ref: z.string(),
    pricing_handler_id: z.string().nullable(),
    ctx_json: z.string().nullable(), // JSON stringified object

    // Added by addActionEventType
    // todo: make this DRY rather than hardcoding the name of this here
    topic_type: z.literal('action'),

    // Added by addProtocolMetadata
    metadata_json: z.string().nullable(),
  })
  .extend(CommonFieldsSchema.shape)
  .extend(AssetFieldsSchemaOptional.shape) // optional bc action can be non token-based
  .strip(); // Automatically remove extra fields

/**
 * Final enriched action type after all pipeline transformations.
 * Inferred directly from the Zod schema - single source of truth.
 */
export type EnrichedAction = z.infer<typeof EnrichedActionSchema>;
