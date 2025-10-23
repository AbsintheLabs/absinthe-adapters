import { addAdapterProtocolInfo } from '../base/add-adapter-protocol.ts';
import { addRunnerMeta } from '../base/add-runner-meta.ts';
import { addProtocolMetadata } from '../base/add-protocol-metadata.ts';
import { addActionEventType } from '../base/add-event-type.ts';
import { addChainMetadata } from '../base/add-chain-metadata.ts';
import { addRawActionFields } from '../base/add-raw-action-fields.ts';
import { addEventIdForAction } from '../base/add-base-event-id.ts';
import { stringifyCtx } from '../base/stringify-ctx.ts';
import { enrichAssetMetadataConditional } from '../pricing/asset-metadata.ts';
import { addDenomination } from '../pricing/quantity-basis.ts';
import { calculateActionQuantity } from '../pricing/quantity-calculator.ts';
import { excludeContractAccounts } from '../filters/exclude-contracts.ts';

import { Pipe, requireShape, validateAndPickShape } from '../core.ts';
import { RawAction } from '../../types/enrichment.ts';
import { dedupeActions } from '../utils/dedupe-actions.ts';
import { EnrichedActionSchema } from '../../types/events.ts';

/**
 * Action enrichment pipeline.
 *
 * Uses the composable Pipe API for type-safe enrichment chains.
 * TypeScript validates that each step produces the shape expected by the next,
 * and that the final output matches EnrichedAction.
 *
 * The validateAndPickShape step at the end:
 * - Validates all field types at runtime using Zod
 * - Automatically strips extra fields via .strip()
 * - Throws if any required fields are missing or wrong type
 *
 * To verify type safety: try removing a field from EnrichedActionSchema—
 * the pipeline will fail to compile at the validatePipeline call.
 */
export const actionPipeline = () =>
  Pipe.start(requireShape<RawAction>())
    // field mapping (convert camelCase to snake_case)
    .pipe(addRawActionFields())
    // filters
    .pipe(excludeContractAccounts())
    .pipe(dedupeActions())
    // metadata (runner, chain, event type, protocol, adapter protocol)
    .pipe(addRunnerMeta())
    .pipe(addChainMetadata())
    .pipe(addActionEventType())
    .pipe(addProtocolMetadata())
    .pipe(addAdapterProtocolInfo())
    // backwards compatibility: base_eventId (must run before stringifyCtx to read ctx.logIndex)
    .pipe(addEventIdForAction())
    // stringify ctx for database compatibility (after base_eventId which needs to read ctx)
    .pipe(stringifyCtx())
    // pricing (asset metadata, quantity basis, calculate quantity)
    .pipe(enrichAssetMetadataConditional())
    .pipe(addDenomination())
    .pipe(calculateActionQuantity())
    // assert, validate, and pick shape
    // DO NOT REMOVE THESE 2 STEPS! THEY ARE ESSENTIAL FOR TYPE SAFETY!
    .pipe(validateAndPickShape(EnrichedActionSchema));
