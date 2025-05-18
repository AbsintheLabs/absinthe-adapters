import { z } from 'zod';
import { CHAINS } from './chains';
import fs from 'fs';
import path from 'path';

// Define the token structure
export interface Token {
    coingeckoId: string;
    decimals: number;
}

// Define the pool structure
export interface Pool {
    contractAddress: string;
    fromBlock: number;
    pricingStrategy: string;
    token0: Token;
    token1: Token;
    preferredTokenCoingeckoId: string;
}

// Updated ValidatedEnv to support multiple pools
export interface ValidatedEnv {
    dbName: string;
    dbPort?: number;
    dbUrl?: string;
    gqlPort: number;
    gatewayUrl: string;
    chainId: number;
    chainName: string;
    chainShortName: string;
    rpcUrl: string;
    toBlock?: number;
    balanceFlushIntervalHours: number;
    pools: Pool[];
    absintheApiUrl: string;
    absintheApiKey: string;
    coingeckoApiKey: string;
}

// Schema for the config file
const configSchema = z.object({
    chainId: z.number(),
    gatewayUrl: z.string().url('Gateway URL must be a valid URL'),
    toBlock: z.number().optional(),
    balanceFlushIntervalHours: z.number(),
    pools: z.array(
        z.object({
            contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Contract address must be a valid Ethereum address'),
            fromBlock: z.number(),
            pricingStrategy: z.string(),
            token0: z.object({
                coingeckoId: z.string(),
                decimals: z.number()
            }),
            token1: z.object({
                coingeckoId: z.string(),
                decimals: z.number()
            }),
            preferredTokenCoingeckoId: z.string().refine(val => val === 'token0' || val === 'token1', 'Preferred token must be either "token0" or "token1"')
        })
    )
});

export function validateEnv(): ValidatedEnv {
    try {
        // Define the env schema for environment variables
        const envSchema = z.object({
            DB_NAME: z.string().min(1, 'DB_NAME is required'),
            DB_PORT: z.string().transform(val => parseInt(val, 10)).refine(val => !isNaN(val), 'DB_PORT must be a valid number').optional(),
            DB_URL: z.string().regex(/^postgres:\/\/.+/, 'DB_URL must be a valid postgres URL').optional(),
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
            // Format error messages
            const errorMessages = envResult.error.errors.map(err =>
                `${err.path.join('.')}: ${err.message}`
            ).join('\n');

            throw new Error(`Environment validation failed:\n${errorMessages}`);
        }

        // Find and load the config file
        const configFilePath = findConfigFile();
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
            pools: configResult.data.pools,
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

// Helper function to find the config file
function findConfigFile(): string {
    // Try to find the config file in common project directories
    const possibleLocations = [
        'abs_config.json',
        './abs_config.json',
        '../abs_config.json',
        '../../abs_config.json',
        '../../../abs_config.json',
        './projects/uniswapv2/abs_config.json',
        '../projects/uniswapv2/abs_config.json',
        '../../projects/uniswapv2/abs_config.json',
    ];

    for (const location of possibleLocations) {
        if (fs.existsSync(location)) {
            return location;
        }
    }

    // If the file wasn't found in the predefined locations, look recursively from the current directory
    const searchResult = searchForFile('abs_config.json', process.cwd(), 4);
    if (searchResult) {
        return searchResult;
    }

    throw new Error('Could not find abs_config.json file. Please make sure it exists.');
}

// Helper function to recursively search for a file
function searchForFile(filename: string, startDir: string, maxDepth: number): string | null {
    if (maxDepth <= 0) return null;

    const items = fs.readdirSync(startDir);

    for (const item of items) {
        const itemPath = path.join(startDir, item);
        const stat = fs.statSync(itemPath);

        if (stat.isFile() && item === filename) {
            return itemPath;
        } else if (stat.isDirectory() && item !== 'node_modules' && item !== '.git') {
            const found = searchForFile(filename, itemPath, maxDepth - 1);
            if (found) return found;
        }
    }

    return null;
}
