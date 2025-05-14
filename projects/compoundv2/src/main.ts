import { TypeormDatabase } from "@subsquid/typeorm-store";
import { processor } from "./processor";

import { validateEnv, AbsintheApiClient } from "@absinthe/common";

// Validate environment variables at the start
const env = validateEnv();
// Create Absinthe API client for sending data
const apiClient = new AbsintheApiClient({
    baseUrl: env.absintheApiUrl,
    apiKey: env.absintheApiKey
});


const db = new TypeormDatabase({ supportHotBlocks: false });
processor.run(db, async (ctx) => {
    // [INIT] batch state
    console.log("we are here!");
    process.exit(0);

    // [LOOP] process each block
    for (let block of ctx.blocks) {
        for (let log of block.logs) {

        }
    }

    // [FINAL] save state
    // send events to API
})