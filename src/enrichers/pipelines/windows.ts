import { addRunnerMeta } from '../base/add-runner-meta.ts';
import { addProtocolMetadata } from '../base/add-protocol-metadata.ts';
import { addAdapterProtocolMeta } from '../base/add-adapter-protocol.ts';

import { pipeline } from '../core.ts';

export const windowsPipeline = pipeline(
  addRunnerMeta(),
  addProtocolMetadata(),
  addAdapterProtocolMeta(),
);
