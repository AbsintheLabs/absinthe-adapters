import { addAdapterProtocolMeta } from '../base/add-adapter-protocol.ts';
import { addWindowComputations } from '../base/add-window-computations.ts';
import { addRunnerMeta } from '../base/add-runner-meta.ts';
import { addProtocolMetadata } from '../base/add-protocol-metadata.ts';
import { addTWBEventType } from '../base/add-event-type.ts';
import { addChainMetadata } from '../base/add-chain-metadata.ts';
import { enrichAssetMetadata } from '../pricing/asset-metadata.ts';

import { Pipe, requireShape } from '../core.ts';
import { RawWindow } from '../../types/enrichment.ts';

/**
 * Window enrichment pipeline.
 *
 * Uses the composable Pipe API for type-safe enrichment chains.
 */
export const windowsPipeline = () =>
  Pipe.start(requireShape<RawWindow>())
    .pipe(addRunnerMeta())
    .pipe(addChainMetadata())
    .pipe(enrichAssetMetadata())
    .pipe(addTWBEventType())
    .pipe(addProtocolMetadata())
    .pipe(addWindowComputations())
    .pipe(addAdapterProtocolMeta());
