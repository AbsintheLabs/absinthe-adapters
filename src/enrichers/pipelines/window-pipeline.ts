import { addAdapterProtocolMeta } from '../base/add-adapter-protocol.ts';
import { addWindowComputations } from '../base/add-window-computations.ts';
import { addRunnerMeta } from '../base/add-runner-meta.ts';
import { addProtocolMetadata } from '../base/add-protocol-metadata.ts';
import { addTWBEventType } from '../base/add-event-type.ts';
import { addChainMetadata } from '../base/add-chain-metadata.ts';
import { enrichAssetMetadata } from '../pricing/asset-metadata.ts';

import { requireShape } from '../core.ts';
import { pipeline } from '../pipeline-overloads.ts';
import { RawWindow } from '../../types/enrichment.ts';

// Any object that extends position base can be enriched with this pipeline
export const windowsPipeline = <T extends RawWindow>() =>
  pipeline(
    requireShape<T>(),
    addRunnerMeta(),
    addChainMetadata(),
    enrichAssetMetadata(),
    addTWBEventType(),
    addProtocolMetadata(),
    addWindowComputations(),
    addAdapterProtocolMeta(),
  );
