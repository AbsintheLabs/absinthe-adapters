import { z } from 'zod';
import fs from 'fs';
import { ValidatedEnv, ValidatedEnvBase } from '../types/interfaces/interfaces';
import { configSchema } from '../types/schema';
import { findConfigFile } from './helper/findConfigFile';
import { EXAMPLE_FILE_NAME } from './consts';
import { FILE_NAME } from './consts';
import {
  BondingCurveProtocol,
  ChainId,
  ChainName,
  ChainShortName,
  ChainType,
} from '../types/enums';
import { getChainEnumKey } from './helper/getChainEnumKey';
import {
  BondingCurveProtocolConfig,
  DexProtocolConfig,
  ProtocolConfig,
  StakingProtocolConfig,
} from '../types/interfaces/protocols';

export function validateEnv(): {
  baseConfig: ValidatedEnvBase;
  dexProtocols: DexProtocolConfig[];
  bondingCurveProtocols: BondingCurveProtocolConfig[];
  stakingProtocols: StakingProtocolConfig[];
} {
  try {
    const envSchema = z.object({
      DB_URL: z.string().min(1, 'DB_URL is required'),
      RPC_URL_MAINNET: z
        .string()
        .url('RPC_URL_MAINNET must be a valid URL')
        .refine((val) => val.startsWith('https://'), 'RPC_URL_MAINNET must be https:// not wss://'),
      RPC_URL_BASE: z
        .string()
        .url('RPC_URL_BASE must be a valid URL')
        .refine((val) => val.startsWith('https://'), 'RPC_URL_BASE must be https:// not wss://'),
      ABSINTHE_API_URL: z.string().url('ABSINTHE_API_URL must be a valid URL'),
      ABSINTHE_API_KEY: z.string().min(1, 'ABSINTHE_API_KEY is required'),
      COINGECKO_API_KEY: z.string().min(1, 'COINGECKO_API_KEY is required'),
    });

    const envResult = envSchema.safeParse(process.env);

    if (!envResult.success) {
      const errorMessages = envResult.error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('\n');

      throw new Error(`Environment validation failed:\n${errorMessages}`);
    }

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
    const configResult = configSchema.safeParse(configData);

    if (!configResult.success) {
      const errorMessages = configResult.error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('\n');

      throw new Error(`Config file validation failed:\n${errorMessages}`);
    }
  }

    let chainId: number;
  let gatewayUrl: string;
  let toBlock: number | undefined;
  let balanceFlushIntervalHours: number;
  let protocols: ProtocolConfig[];
  let stakingProtocols: StakingProtocolConfig[];

  if (isLegacyConfig) {
    // Handle legacy config structure
    const legacyData = configResult.data as any;
    chainId = legacyData.chainId;
    gatewayUrl = legacyData.gatewayUrl;
    toBlock = legacyData.toBlock;
    balanceFlushIntervalHours = legacyData.balanceFlushIntervalHours;
    protocols = legacyData.protocols as ProtocolConfig[];
    stakingProtocols = legacyData.stakingProtocols as StakingProtocolConfig[];
  } else {
    // Handle new nested structure - use DEX config as default for backward compatibility
    const nestedData = configResult.data as any;
    chainId = nestedData.dex.chainId;
    gatewayUrl = nestedData.dex.gatewayUrl;
    toBlock = nestedData.dex.toBlock;
    balanceFlushIntervalHours = nestedData.dex.balanceFlushIntervalHours;
    protocols = nestedData.dex.protocols as ProtocolConfig[];
    stakingProtocols = nestedData.staking.protocols as StakingProtocolConfig[];
  }

  const bondingCurveProtocols: BondingCurveProtocolConfig[] =
    configResult.data.bondingCurveProtocols.map((bondingCurveProtocol) => {
      const chainId = bondingCurveProtocol.chainId;
      const chainKey = getChainEnumKey(chainId);
      if (!chainKey) {
        throw new Error(`${chainId} is not a supported chainId.`);
      }
      const chainName = ChainName[chainKey];
      const chainShortName = ChainShortName[chainKey];
      const chainArch = ChainType.EVM;
      return {
        type: bondingCurveProtocol.type as BondingCurveProtocol,
        gatewayUrl: bondingCurveProtocol.gatewayUrl,
        toBlock: bondingCurveProtocol.toBlock,
        fromBlock: bondingCurveProtocol.fromBlock,
        name: bondingCurveProtocol.name,
        contractAddress: bondingCurveProtocol.contractAddress,
        chainArch: chainArch,
        chainId: chainId,
        chainShortName: chainShortName,
        chainName: chainName,
        rpcUrl:
          bondingCurveProtocol.chainId === ChainId.MAINNET
            ? envResult.data.RPC_URL_MAINNET
            : envResult.data.RPC_URL_BASE,
      };
    });

  const stakingProtocols: StakingProtocolConfig[] = configResult.data.stakingProtocols.map((stakingProtocol) => {
    const chainId = stakingProtocol.chainId;
    const chainKey = getChainEnumKey(chainId);
    if (!chainKey) {
      throw new Error(`${chainId} is not a supported chainId.`);
    }
    const chainName = ChainName[chainKey];
    const chainShortName = ChainShortName[chainKey];
    const chainArch = ChainType.EVM;
    return {
      type: stakingProtocol.type,
      gatewayUrl: stakingProtocol.gatewayUrl,
      toBlock: stakingProtocol.toBlock,
      fromBlock: stakingProtocol.fromBlock,
      name: stakingProtocol.name,
      contractAddress: stakingProtocol.contractAddress,
      chainArch: chainArch,
      chainId: chainId,
      chainShortName: chainShortName,
      chainName: chainName,
      rpcUrl:
        stakingProtocol.chainId === ChainId.MAINNET
          ? envResult.data.RPC_URL_MAINNET
          : envResult.data.RPC_URL_BASE,
    };
  });

  const dexProtocols: DexProtocolConfig[] = configResult.data.dexProtocols.map((dexProtocol) => {
    const chainId = dexProtocol.chainId;
    const chainKey = getChainEnumKey(chainId);
    if (!chainKey) {
      throw new Error(`${chainId} is not a supported chainId.`);
    }
    const chainName = ChainName[chainKey];
    const chainShortName = ChainShortName[chainKey];
    const chainArch = ChainType.EVM;

    return {
      type: dexProtocol.type,
      gatewayUrl: dexProtocol.gatewayUrl,
      toBlock: dexProtocol.toBlock,
      protocols: dexProtocol.protocols as ProtocolConfig[],
      chainArch: chainArch,
      chainId: chainId,
      chainShortName: chainShortName,
      chainName: chainName,
      rpcUrl:
        dexProtocol.chainId === ChainId.MAINNET
          ? envResult.data.RPC_URL_MAINNET
          : envResult.data.RPC_URL_BASE,
    };
  });

  const baseConfig: ValidatedEnvBase = {
    balanceFlushIntervalHours: configResult.data.balanceFlushIntervalHours,
    absintheApiUrl: envResult.data.ABSINTHE_API_URL,
    absintheApiKey: envResult.data.ABSINTHE_API_KEY,
    coingeckoApiKey: envResult.data.COINGECKO_API_KEY,
  };

  return {
    baseConfig,
    dexProtocols,
    bondingCurveProtocols,
    stakingProtocols,
  };
} catch (error) {
  if (error instanceof Error) {
    throw error;
  }
  throw new Error(`Environment validation failed: ${String(error)}`);
}
}

// New validation function for protocol-specific configurations
export function validateProtocolEnv(): ValidatedProtocolEnv {
  try {
    // Define the env schema for environment variables
    const envSchema = z.object({
      DB_NAME: z.string().min(1, 'DB_NAME is required'),
      DB_PORT: z.string().transform(val => parseInt(val, 10)).refine(val => !isNaN(val), 'DB_PORT must be a valid number').optional(),
      DB_URL: z.string().regex(/^postgresql?:\/\/.+/, 'DB_URL must be a valid postgres URL').optional(),
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
    let configFilePath: string;
    try {
      configFilePath = findConfigFile(FILE_NAME);
    } catch (error) {
      // If abs_config.json is not found, try abs_config.example.json
      try {
        configFilePath = findConfigFile(EXAMPLE_FILE_NAME);
      } catch (exampleError) {
        throw new Error(`Neither ${FILE_NAME} nor ${EXAMPLE_FILE_NAME} could be found`);
      }
    }

    const configData = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));

    // Validate the config file with new nested structure
    const configResult = configSchema.safeParse(configData);

    if (!configResult.success) {
      const errorMessages = configResult.error.errors.map(err =>
        `${err.path.join('.')}: ${err.message}`
      ).join('\n');

      throw new Error(`Config file validation failed:\n${errorMessages}`);
    }

    const { dex: dexData, staking: stakingData } = configResult.data;

    // Validate chains for both DEX and staking
    const dexChain = CHAINS.find(c => c.chainId === dexData.chainId);
    if (!dexChain) {
      throw new Error(`DEX chainId ${dexData.chainId} is not a supported chainId.`);
    }

    const stakingChain = CHAINS.find(c => c.chainId === stakingData.chainId);
    if (!stakingChain) {
      throw new Error(`Staking chainId ${stakingData.chainId} is not a supported chainId.`);
    }

    // Create protocol-specific configurations
    const dexConfig: DexConfig = {
      chainId: dexData.chainId,
      chainName: dexChain.name,
      chainShortName: dexChain.shortName,
      gatewayUrl: dexData.gatewayUrl,
      toBlock: dexData.toBlock,
      balanceFlushIntervalHours: dexData.balanceFlushIntervalHours,
      protocols: dexData.protocols as ProtocolConfig[]
    };

    const stakingConfig: StakingConfig = {
      chainId: stakingData.chainId,
      chainName: stakingChain.name,
      chainShortName: stakingChain.shortName,
      gatewayUrl: stakingData.gatewayUrl,
      toBlock: stakingData.toBlock,
      balanceFlushIntervalHours: stakingData.balanceFlushIntervalHours,
      protocols: stakingData.protocols as StakingProtocolConfig[]
    };

    // Create validated environment object
    const validatedEnv: ValidatedProtocolEnv = {
      dbName: envResult.data.DB_NAME,
      dbPort: envResult.data.DB_PORT,
      dbUrl: envResult.data.DB_URL,
      rpcUrl: envResult.data.RPC_URL,
      absintheApiUrl: envResult.data.ABSINTHE_API_URL,
      absintheApiKey: envResult.data.ABSINTHE_API_KEY,
      coingeckoApiKey: envResult.data.COINGECKO_API_KEY,
      dex: dexConfig,
      staking: stakingConfig
    };

    return validatedEnv;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Protocol environment validation failed: ${String(error)}`);
  }
}

// Helper function to get DEX-specific configuration
export function validateDexEnv(): ValidatedEnv {
  const protocolEnv = validateProtocolEnv();

  return {
    dbName: protocolEnv.dbName,
    dbPort: protocolEnv.dbPort,
    dbUrl: protocolEnv.dbUrl,
    gatewayUrl: protocolEnv.dex.gatewayUrl,
    chainId: protocolEnv.dex.chainId,
    chainName: protocolEnv.dex.chainName,
    chainShortName: protocolEnv.dex.chainShortName,
    rpcUrl: protocolEnv.rpcUrl,
    toBlock: protocolEnv.dex.toBlock,
    balanceFlushIntervalHours: protocolEnv.dex.balanceFlushIntervalHours,
    protocols: protocolEnv.dex.protocols,
    stakingProtocols: [], // Empty for DEX-only config
    absintheApiUrl: protocolEnv.absintheApiUrl,
    absintheApiKey: protocolEnv.absintheApiKey,
    coingeckoApiKey: protocolEnv.coingeckoApiKey,
  };
}

// Helper function to get staking-specific configuration
export function validateStakingEnv(): ValidatedEnv {
  const protocolEnv = validateProtocolEnv();

  return {
    dbName: protocolEnv.dbName,
    dbPort: protocolEnv.dbPort,
    dbUrl: protocolEnv.dbUrl,
    gatewayUrl: protocolEnv.staking.gatewayUrl,
    chainId: protocolEnv.staking.chainId,
    chainName: protocolEnv.staking.chainName,
    chainShortName: protocolEnv.staking.chainShortName,
    rpcUrl: protocolEnv.rpcUrl,
    toBlock: protocolEnv.staking.toBlock,
    balanceFlushIntervalHours: protocolEnv.staking.balanceFlushIntervalHours,
    protocols: [], // Empty for staking-only config
    stakingProtocols: protocolEnv.staking.protocols,
    absintheApiUrl: protocolEnv.absintheApiUrl,
    absintheApiKey: protocolEnv.absintheApiKey,
    coingeckoApiKey: protocolEnv.coingeckoApiKey,
  };
}

