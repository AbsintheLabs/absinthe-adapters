import { z } from 'zod';
import { CHAINS } from './chains';
import fs from 'fs';
import { ValidatedEnv } from '../types/interfaces';
import { configSchema } from '../types/schema';
import { findConfigFile } from './helper/findConfigFile';

const FILE_NAME = 'abs_config.json';

export function validateEnv(): ValidatedEnv {
    try {
        // Define the env schema for environment variables
        const envSchema = z.object({
            DB_NAME: z.string().min(1, 'DB_NAME is required'),
            DB_PORT: z.string().transform(val => parseInt(val, 10)).refine(val => !isNaN(val), 'DB_PORT must be a valid number').optional(),
            DB_URL: z.string().regex(/^postgresql?:\/\/.+/, 'DB_URL must be a valid postgres URL').optional(),
            GQL_PORT: z.string().transform(val => parseInt(val, 10)).refine(val => !isNaN(val), 'GQL_PORT must be a valid number').default('3000'),
            RPC_URL: z.string().url('RPC_URL must be a valid URL').refine(val => val.startsWith('https://'), 'RPC_URL must be https:// not wss://'),
            ABSINTHE_API_URL: z.string().url('ABSINTHE_API_URL must be a valid URL'),
            ABSINTHE_API_KEY: z.string().min(1, 'ABSINTHE_API_KEY is required'),
            COINGECKO_API_KEY: z.string().min(1, 'COINGECKO_API_KEY is required'),
        }).refine(
            data => data.DB_PORT !== undefined || data.DB_URL !== undefined,
            {
                message: "Either DB_PORT or DB_URL must be provided",
                path: ["DB_PORT", "DB_URL"],
            }
        );

        // Validate environment variables
        const envResult = envSchema.safeParse(process.env);

        if (!envResult.success) {
            const errorMessages = envResult.error.errors.map(err =>
                `${err.path.join('.')}: ${err.message}`
            ).join('\n');

            throw new Error(`Environment validation failed:\n${errorMessages}`);
        }

        // Find and load the config file
        const configFilePath = findConfigFile(FILE_NAME);
        const configData = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));

        // Validate the config file
        const configResult = configSchema.safeParse(configData);

        if (!configResult.success) {
            const errorMessages = configResult.error.errors.map(err =>
                `${err.path.join('.')}: ${err.message}`
            ).join('\n');

            throw new Error(`Config file validation failed:\n${errorMessages}`);
        }

        // Chain Validation
        const chainId = configResult.data.chainId;
        const chain = CHAINS.find(c => c.chainId === chainId);
        if (!chain) {
            throw new Error(`${chainId} is not a supported chainId.`);
        }

        // Create validated environment object combining both sources
        const validatedEnv: ValidatedEnv = {
            dbName: envResult.data.DB_NAME,
            dbPort: envResult.data.DB_PORT,
            dbUrl: envResult.data.DB_URL,
            gqlPort: envResult.data.GQL_PORT,
            gatewayUrl: configResult.data.gatewayUrl,
            chainId: chainId,
            chainName: chain.name,
            chainShortName: chain.shortName,
            rpcUrl: envResult.data.RPC_URL,
            toBlock: configResult.data.toBlock,
            balanceFlushIntervalHours: configResult.data.balanceFlushIntervalHours,
            protocols: configResult.data.protocols,
            absintheApiUrl: envResult.data.ABSINTHE_API_URL,
            absintheApiKey: envResult.data.ABSINTHE_API_KEY,
            coingeckoApiKey: envResult.data.COINGECKO_API_KEY,
        };

        return validatedEnv;
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error(`Environment validation failed: ${String(error)}`);
    }
}

