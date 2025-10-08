import { addAdapterProtocolMeta } from '../base/add-adapter-protocol.ts';
import { addRunnerMeta } from '../base/add-runner-meta.ts';
import { addProtocolMetadata } from '../base/add-protocol-metadata.ts';
import { addActionEventType } from '../base/add-event-type.ts';
import { addChainMetadata } from '../base/add-chain-metadata.ts';
import { enrichAssetMetadata } from '../pricing/asset-metadata.ts';

import { requireShape } from '../core.ts';
import { pipeline } from '../pipeline-overloads.ts';
import { RawAction } from '../../types/enrichment.ts';
import { dedupeActions } from '../utils/dedupe-actions.ts';

// Any object that extends position base can be enriched with this pipeline
export const actionPipeline = <T extends RawAction>() =>
  pipeline(
    requireShape<T>(),
    dedupeActions(),
    addRunnerMeta(),
    addChainMetadata(),
    addActionEventType(),
    addProtocolMetadata(),
    addAdapterProtocolMeta(),
  );
