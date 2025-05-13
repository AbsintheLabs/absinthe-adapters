import { TypeormDatabase } from "@subsquid/typeorm-store";
import { processor } from "./processor";

// todo; move these into a shared location so it can be accessible by other projects
// import { AbsintheApiClient } from "../../../src/services/apiClient";
// import { validateEnv } from "../../../src/utils/validateEnv";
import { CHAINS } from "@absinthe/common/src/utils/chains";

// Validate environment variables at the start
const env = validateEnv();

// Create Absinthe API client for sending data
const apiClient = new AbsintheApiClient({
    baseUrl: env.absintheApiUrl,
    apiKey: env.absintheApiKey
});

processor.run(new TypeormDatabase({ supportHotBlocks: false }), async (ctx) => {
    // [INIT] batch state


    // [LOOP] process each block
    for (let block of ctx.blocks) {
        for (let log of block.logs) {
        }
    }

    // [FINAL] save state
    // send events to API
})