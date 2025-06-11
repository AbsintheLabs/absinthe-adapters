import { TypeormDatabase } from '@subsquid/typeorm-store';
import { processor } from './processor';

import { logger } from '@absinthe/common';
// Validate environment variables at the start
// const env = validateEnv();
// Create Absinthe API client for sending data
// const apiClient = new AbsintheApiClient({
//   baseUrl: env.absintheApiUrl,
//   apiKey: env.absintheApiKey,
// });

const db = new TypeormDatabase({ supportHotBlocks: false });
processor.run(db, async (ctx) => {
  // [INIT] batch state

  // [LOOP] process each block
  for (const block of ctx.blocks) {
    for (const log of block.logs) {
      logger.info(log.toString());
    }
  }

  // [FINAL] save state
  // send events to API
});
