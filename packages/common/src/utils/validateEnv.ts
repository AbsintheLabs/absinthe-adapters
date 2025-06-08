import { z } from 'zod';
import fs from 'fs';
import { ValidatedEnv } from '../types/interfaces/interfaces';
import { configSchema } from '../types/schema';
import { findConfigFile } from './helper/findConfigFile';
import { EXAMPLE_FILE_NAME } from './consts';
import { FILE_NAME } from './consts';
import { ProtocolConfig } from '../types/interfaces/protocols';
import { ChainId, ChainName, ChainShortName, ChainType } from '../types/enums';
import { getChainEnumKey } from './helper/getChainEnumKey';

export function validateEnv(): ValidatedEnv {
  try {
    // Define the env schema for environment variables
    const envSchema = z
      .object({
        DB_NAME: z.string().optional(),
        DB_PORT: z
          .string()
          .transform((val) => parseInt(val, 10))
          .refine((val) => !isNaN(val), 'DB_PORT must be a valid number')
          .optional(),
        DB_HOST: z.string().optional(),
        DB_USER: z.string().optional(),
        DB_PASS: z.string().optional(),
        RPC_URL: z
          .string()
          .url('RPC_URL must be a valid URL')
          .refine((val) => val.startsWith('https://'), 'RPC_URL must be https:// not wss://'),
        ABSINTHE_API_URL: z.string().url('ABSINTHE_API_URL must be a valid URL'),
        ABSINTHE_API_KEY: z.string().min(1, 'ABSINTHE_API_KEY is required'),
        COINGECKO_API_KEY: z.string().min(1, 'COINGECKO_API_KEY is required'),
      })
      .refine((data) => data.DB_PORT !== undefined || data.DB_HOST !== undefined, {
        message: 'Either DB_PORT or DB_HOST must be provided',
        path: ['DB_PORT', 'DB_HOST'],
      });

    // Validate environment variables
    const envResult = envSchema.safeParse(process.env);
    const DB_URL = `postgresql://${envResult.data?.DB_USER}:${envResult.data?.DB_PASS}@${envResult.data?.DB_HOST}:${envResult.data?.DB_PORT}/${envResult.data?.DB_NAME}`;

    console.log(
      'DB_URL',
      DB_URL,
      process.env.DB_USER,
      process.env.DB_PASS,
      process.env.DB_HOST,
      process.env.DB_PORT,
      process.env.DB_NAME,
    );

    if (!envResult.success) {
      const errorMessages = envResult.error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('\n');

      throw new Error(`Environment validation failed:\n${errorMessages}`);
    }

    // Find and load the config file
    let configFilePath: string;
    try {
      configFilePath = findConfigFile(FILE_NAME);
    } catch (error) {
      console.error('Error finding config file', error);
      // If abs_config.json is not found, try abs_config.example.json
      try {
        configFilePath = findConfigFile(EXAMPLE_FILE_NAME);
      } catch (exampleError) {
        console.error('Error finding example config file', exampleError);
        throw new Error(`Neither ${FILE_NAME} nor ${EXAMPLE_FILE_NAME} could be found`);
      }
    }

    const configData = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));

    // Validate the config file
    const configResult = configSchema.safeParse(configData);

    if (!configResult.success) {
      const errorMessages = configResult.error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('\n');

      throw new Error(`Config file validation failed:\n${errorMessages}`);
    }

    // Chain Validation
    const chainId = configResult.data.chainId;
    const chainKey = getChainEnumKey(chainId);
    if (!chainKey) {
      throw new Error(`${chainId} is not a supported chainId.`);
    }
    const chainName = ChainName[chainKey];
    const chainShortName = ChainShortName[chainKey];
    const chainArch = ChainType.EVM;
    // const chain = CHAINS.find((c) => c.chainId === chainId);
    // if (!chain) {
    //   throw new Error(`${chainId} is not a supported chainId.`);
    // }

    // Create validated environment object combining both sources
    const validatedEnv: ValidatedEnv = {
      gatewayUrl: configResult.data.gatewayUrl,
      chainId: chainId,
      chainName: chainName,
      chainShortName: chainShortName,
      chainArch: chainArch,
      rpcUrl: envResult.data.RPC_URL,
      toBlock: configResult.data.toBlock,
      balanceFlushIntervalHours: configResult.data.balanceFlushIntervalHours,
      protocols: configResult.data.protocols as ProtocolConfig[],
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
