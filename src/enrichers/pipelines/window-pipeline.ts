import { addAdapterProtocolInfo } from '../base/add-adapter-protocol.ts';
import { addWindowing } from '../base/add-windowing.ts';
import { addRunnerMeta } from '../base/add-runner-meta.ts';
import { addProtocolMetadata } from '../base/add-protocol-metadata.ts';
import { addTWBEventType } from '../base/add-event-type.ts';
import { addChainMetadata } from '../base/add-chain-metadata.ts';
import { addRawPositionFields } from '../base/add-raw-window-fields.ts';
import { addBaseEventIdForPosition } from '../base/add-base-event-id.ts';
import { stringifyWindowCtx } from '../base/stringify-window-ctx.ts';
import { enrichAssetMetadataForTokenBased } from '../pricing/asset-metadata.ts';
import { Pipe, requireShape, validateAndPickShape } from '../core.ts';
import { RawPosition } from '../../types/enrichment.ts';
import { EnrichedPositionSchema } from '../../types/events.ts';
import { excludeContractAccounts } from '../filters/exclude-contracts.ts';
import { addDenomination } from '../pricing/quantity-basis.ts';
import { calculatePositionQuantity } from '../pricing/quantity-calculator.ts';
/**
 * Window enrichment pipeline.
 *
 * Uses the composable Pipe API for type-safe enrichment chains.
 */
export const positionsPipeline = () =>
  Pipe.start(requireShape<RawPosition>())
    // field mapping (convert camelCase to snake_case)
    .pipe(addRawPositionFields())
    // filters
    .pipe(excludeContractAccounts())
    // metadata (runner, chain, event type, adapter protocol)
    .pipe(addRunnerMeta())
    .pipe(addChainMetadata())
    .pipe(addTWBEventType())
    .pipe(addProtocolMetadata())
    .pipe(addAdapterProtocolInfo())
    // windowing (start/end/before/after/delta)
    .pipe(addWindowing())
    // backwards compatibility: base_eventId
    .pipe(addBaseEventIdForPosition())
    // stringify context for database compatibility
    .pipe(stringifyWindowCtx())
    // pricing
    .pipe(enrichAssetMetadataForTokenBased())
    .pipe(addDenomination())
    .pipe(calculatePositionQuantity())
    // validate and pick shape
    .pipe(validateAndPickShape(EnrichedPositionSchema));
