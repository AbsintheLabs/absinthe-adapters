import fs from 'fs';
import {
  getChainEnumKey,
  getRpcUrlForChain,
  findConfigFile,
  envSchema,
  ChainName,
  ChainShortName,
  ChainType,
  GatewayUrl,
  ValidatedEnvBase,
  ChainId,
} from '@absinthe/common';
import { splTransfersProtocolSchema } from './schema';
import { SplTransfersProtocol, ValidatedEnv } from './types';
import { FILE_NAME } from './consts';

export function validateEnv(): ValidatedEnv {
  try {
    const envResult = envSchema.safeParse(process.env);

    if (!envResult.success) {
      const errorMessages = envResult.error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('\n');

      throw new Error(`Environment validation failed:\n${errorMessages}`);
    }

    let configData: any;

    if (envResult.data.ABS_CONFIG) {
      try {
        configData = JSON.parse(envResult.data.ABS_CONFIG);
      } catch (error) {
        throw new Error(`Failed to parse ABS_CONFIG JSON: ${error}`);
      }
    } else {
      let configFilePath: string = findConfigFile(FILE_NAME);
      configData = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
      console.log(`Using configuration from file: ${configFilePath}`);
    }

    const configResult = splTransfersProtocolSchema.safeParse(configData);

    if (!configResult.success) {
      const errorMessages = configResult.error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('\n');

      throw new Error(`Config validation failed:\n${errorMessages}`);
    }

    const chainId = configResult.data.chainId;
    const chainKey = getChainEnumKey(chainId);
    if (!chainKey) {
      throw new Error(`${chainId} is not a supported chainId.`);
    }
    const chainName = ChainName[chainKey];
    const chainShortName = ChainShortName[chainKey];
    const chainArch = chainId === ChainId.SOLANA ? ChainType.SOLANA : ChainType.EVM;
    const gatewayUrl = GatewayUrl[chainKey];
    const rpcUrl = getRpcUrlForChain(chainId, envResult.data);

    const splTransfersProtocol: SplTransfersProtocol = {
      type: configResult.data.type,
      toBlock: configResult.data.toBlock,
      fromBlock: configResult.data.fromBlock,
      name: configResult.data.name,
      contractAddress: configResult.data.contractAddress,
      chainArch: chainArch,
      chainId: chainId,
      gatewayUrl: gatewayUrl,
      chainShortName: chainShortName,
      chainName: chainName,
      rpcUrl: rpcUrl,
    };

    const baseConfig: ValidatedEnvBase = {
      balanceFlushIntervalHours: configResult.data.balanceFlushIntervalHours,
      absintheApiUrl: envResult.data.ABSINTHE_API_URL,
      absintheApiKey: envResult.data.ABSINTHE_API_KEY,
      coingeckoApiKey: envResult.data.COINGECKO_API_KEY,
    };

    return {
      baseConfig,
      splTransfersProtocol,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Environment validation failed: ${String(error)}`);
  }
}
