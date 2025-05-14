import { TypeormDatabase } from "@subsquid/typeorm-store";
import { processor } from "./processor";

import { validateEnv } from "@absinthe/common/src/utils/validateEnv";
import { AbsintheApiClient } from "@absinthe/common/src/services/apiClient";

// Validate environment variables at the start
const env = validateEnv();

// Create Absinthe API client for sending data
const apiClient = new AbsintheApiClient({
    baseUrl: env.absintheApiUrl,
    apiKey: env.absintheApiKey
});

processor.run(new TypeormDatabase({ supportHotBlocks: false }), async (ctx) => {
    // [INIT] batch state
    console.log("We are here!");
    process.exit(0);

    // [LOOP] process each block
    for (let block of ctx.blocks) {
        for (let log of block.logs) {

        }
    }

    // [FINAL] save state
    // send events to API
})