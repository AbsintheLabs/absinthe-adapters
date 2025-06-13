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
  StakingProtocol,
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
      RPC_URL_HEMI: z
        .string()
        .url('RPC_URL_HEMI must be a valid URL')
        .refine((val) => val.startsWith('https://'), 'RPC_URL_HEMI must be https:// not wss://'),
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

    const stakingProtocols: StakingProtocolConfig[] = configResult.data.stakingProtocols.map(
      (stakingProtocol) => {
        const chainId = stakingProtocol.chainId;
        const chainKey = getChainEnumKey(chainId);
        if (!chainKey) {
          throw new Error(`${chainId} is not a supported chainId.`);
        }
        const chainName = ChainName[chainKey];
        const chainShortName = ChainShortName[chainKey];
        const chainArch = ChainType.EVM;
        return {
          type: stakingProtocol.type as StakingProtocol,
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
            stakingProtocol.chainId === ChainId.HEMI
              ? envResult.data.RPC_URL_HEMI
              : envResult.data.RPC_URL_BASE,
        };
      },
    );

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
