import { z } from 'zod';
import { CHAINS } from '../../packages/common/src/utils/chains';

export interface ValidatedEnv {
    dbName: string;
    dbPort: number;
    gqlPort: number;
    gatewayUrl: string;
    chainId: number;
    chainName: string;
    chainShortName: string;
    rpcUrl: string;
    contractAddress: string;
    fromBlock: number;
    toBlock?: number;
    token0CoingeckoId: string;
    token1CoingeckoId: string;
    preferredTokenCoingeckoId?: string;
    absintheApiUrl: string;
    absintheApiKey: string;
    coingeckoApiKey: string;
    balanceFlushIntervalHours: number;
}

export function validateEnv(): ValidatedEnv {
    // Create schema for environment variables
    const envSchema = z.object({
        DB_NAME: z.string().min(1, 'DB_NAME is required'),
        DB_PORT: z.string().transform(val => parseInt(val, 10)).refine(val => !isNaN(val), 'DB_PORT must be a valid number'),
        GQL_PORT: z.string().transform(val => parseInt(val, 10)).refine(val => !isNaN(val), 'GQL_PORT must be a valid number'),
        GATEWAY_URL: z.string().url('GATEWAY_URL must be a valid URL'),
        CHAIN_ID: z.string().transform(val => parseInt(val, 10)).refine(val => !isNaN(val), 'CHAIN_ID must be a valid number'),
        RPC_URL: z.string().url('RPC_URL must be a valid URL').refine(val => val.startsWith('https://'), 'RPC_URL must be https:// not wss://'),
        CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'CONTRACT_ADDRESS must be a valid Ethereum address'),
        FROM_BLOCK: z.string().transform(val => parseInt(val, 10)).refine(val => !isNaN(val), 'FROM_BLOCK must be a valid number'),
        TO_BLOCK: z.string().transform(val => parseInt(val, 10)).refine(val => !isNaN(val), 'TO_BLOCK must be a valid number').optional(),
        TOKEN0_COINGECKO_ID: z.string().min(1, 'TOKEN0_COINGECKO_ID is required'),
        TOKEN1_COINGECKO_ID: z.string().min(1, 'TOKEN1_COINGECKO_ID is required'),
        PREFERRED_TOKEN_COINGECKO_ID: z.string().optional().default('token0').refine(val => val === 'token0' || val === 'token1', 'PREFERRED_TOKEN_COINGECKO_ID must be either "token0" or "token1"'),
        ABSINTHE_API_URL: z.string().url('ABSINTHE_API_URL must be a valid URL'),
        ABSINTHE_API_KEY: z.string().min(1, 'ABSINTHE_API_KEY is required'),
        COINGECKO_API_KEY: z.string().min(1, 'COINGECKO_API_KEY is required'),
        BALANCE_FLUSH_INTERVAL_HOURS: z.string().transform(val => parseInt(val, 10)).refine(val => !isNaN(val), 'BALANCE_FLUSH_INTERVAL_HOURS must be a valid number'),
    });

    try {
        // Validate environment variables
        const result = envSchema.safeParse(process.env);

        if (!result.success) {
            // Format error messages
            const errorMessages = result.error.errors.map(err =>
                `${err.path.join('.')}: ${err.message}`
            ).join('\n');

            throw new Error(`Environment validation failed:\n${errorMessages}`);
        }

        // Chain Validation
        const chainId = result.data.CHAIN_ID;
        const chain = CHAINS.find(c => c.chainId === chainId);
        if (!chain) {
            throw new Error(`${chainId} is not a supported chainId.`);
        }

        // Create validated environment object
        const validatedEnv: ValidatedEnv = {
            dbName: result.data.DB_NAME,
            dbPort: result.data.DB_PORT,
            gqlPort: result.data.GQL_PORT,
            gatewayUrl: result.data.GATEWAY_URL,
            chainId: chainId,
            chainName: chain.name,
            chainShortName: chain.shortName,
            rpcUrl: result.data.RPC_URL,
            contractAddress: result.data.CONTRACT_ADDRESS,
            fromBlock: result.data.FROM_BLOCK,
            toBlock: result.data.TO_BLOCK,
            token0CoingeckoId: result.data.TOKEN0_COINGECKO_ID,
            token1CoingeckoId: result.data.TOKEN1_COINGECKO_ID,
            preferredTokenCoingeckoId: result.data.PREFERRED_TOKEN_COINGECKO_ID,
            absintheApiUrl: result.data.ABSINTHE_API_URL,
            absintheApiKey: result.data.ABSINTHE_API_KEY,
            coingeckoApiKey: result.data.COINGECKO_API_KEY,
            balanceFlushIntervalHours: result.data.BALANCE_FLUSH_INTERVAL_HOURS,
        };

        return validatedEnv;
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error(`Environment validation failed: ${String(error)}`);
    }
}
