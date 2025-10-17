import { addAdapterProtocolMeta } from '../base/add-adapter-protocol.ts';
import { addWindowing } from '../base/add-windowing.ts';
import { addRunnerMeta } from '../base/add-runner-meta.ts';
import { addProtocolMetadata } from '../base/add-protocol-metadata.ts';
import { addTWBEventType } from '../base/add-event-type.ts';
import { addChainMetadata } from '../base/add-chain-metadata.ts';
import { addRawWindowFields } from '../base/add-raw-window-fields.ts';
import { enrichAssetMetadataForTokenBased } from '../pricing/asset-metadata.ts';
import { Pipe, requireShape, validateAndPickShape } from '../core.ts';
import { RawWindow } from '../../types/enrichment.ts';
import { EnrichedWindowSchema } from '../../types/events.ts';
import { excludeContractAccounts } from '../filters/exclude-contracts.ts';
import { addQuantityBasis } from '../pricing/quantity-basis.ts';
import { calculatePositionQuantity } from '../pricing/quantity-calculator.ts';
/**
 * Window enrichment pipeline.
 *
 * Uses the composable Pipe API for type-safe enrichment chains.
 */
export const windowsPipeline = () =>
  Pipe.start(requireShape<RawWindow>())
    // field mapping (convert camelCase to snake_case)
    .pipe(addRawWindowFields())
    // filters
    .pipe(excludeContractAccounts())
    // metadata (runner, chain, event type, adapter protocol)
    .pipe(addRunnerMeta())
    .pipe(addChainMetadata())
    .pipe(addTWBEventType())
    .pipe(addProtocolMetadata())
    .pipe(addAdapterProtocolMeta())
    // windowing (start/end/before/after/delta)
    .pipe(addWindowing())
    // pricing
    .pipe(enrichAssetMetadataForTokenBased())
    .pipe(addQuantityBasis())
    .pipe(calculatePositionQuantity())
    // validate and pick shape
    .pipe(validateAndPickShape(EnrichedWindowSchema));
