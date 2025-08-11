import { z } from 'zod';
import fs from 'fs';
import { ValidatedEnvBase } from '../types/interfaces/interfaces';
import { configSchema } from '../types/schema';
import { findConfigFile } from './helper/findConfigFile';
import { EXAMPLE_FILE_NAME } from './consts';
import { FILE_NAME } from './consts';
import {
  ChainId,
  ChainName,
  ChainShortName,
  ChainType,
  GatewayUrl,
  StakingProtocol,
  TxnTrackingProtocol,
} from '../types/enums';
import { getChainEnumKey } from './helper/helper';
import {
  ProtocolConfig,
  Univ3PoolConfig,
  ValidatedTxnTrackingProtocolConfig,
  ValidatedDexProtocolConfig,
  ValidatedEnv,
  ValidatedStakingProtocolConfig,
  ValidatedUniv3ProtocolConfig,
  ValidatedZebuProtocolConfig,
  ZebuClientConfigWithChain,
} from '../types/interfaces/protocols';

export function validateEnv(): ValidatedEnv {
  try {
    const envSchema = z.object({
      DB_URL: z.string().min(1, 'DB_URL is required'),
      RPC_URL_MAINNET: z
        .string()
        .url('RPC_URL_MAINNET must be a valid URL')
        .refine((val) => val.startsWith('https://'), 'RPC_URL_MAINNET must be https:// not wss://')
        .optional(),
      RPC_URL_BASE: z
        .string()
        .url('RPC_URL_BASE must be a valid URL')
        .refine((val) => val.startsWith('https://'), 'RPC_URL_BASE must be https:// not wss://')
        .optional(),
      RPC_URL_HEMI: z
        .string()
        .url('RPC_URL_HEMI must be a valid URL')
        .refine((val) => val.startsWith('https://'), 'RPC_URL_HEMI must be https:// not wss://')
        .optional(),
      ABS_CONFIG: z.string(),
      RPC_URL_POLYGON: z.string().url('RPC_URL_POLYGON must be a valid URL').optional(),
      RPC_URL_ARBITRUM: z.string().url('RPC_URL_ARBITRUM must be a valid URL').optional(),
      RPC_URL_OPTIMISM: z.string().url('RPC_URL_OPTIMISM must be a valid URL').optional(),
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

    let configData: any;

    if (envResult.data.ABS_CONFIG) {
      try {
        configData = JSON.parse(envResult.data.ABS_CONFIG);
      } catch (error) {
        throw new Error(`Failed to parse ABS_CONFIG JSON: ${error}`);
      }
    } else {
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
          throw new Error(
            `Neither ${FILE_NAME} nor ${EXAMPLE_FILE_NAME} could be found, and ABS_CONFIG is not provided`,
          );
        }
      }

      configData = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
      console.log(`Using configuration from file: ${configFilePath}`);
    }

    // Validate the configuration using the same Zod schema
    const configResult = configSchema.safeParse(configData);

    if (!configResult.success) {
      const errorMessages = configResult.error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('\n');

      throw new Error(`Config validation failed:\n${errorMessages}`);
    }

    const txnTrackingProtocols: ValidatedTxnTrackingProtocolConfig[] =
      configResult.data.txnTrackingProtocols.map((txnTrackingProtocol) => {
        const chainId = txnTrackingProtocol.chainId;
        const chainKey = getChainEnumKey(chainId);
        if (!chainKey) {
          throw new Error(`${chainId} is not a supported chainId.`);
        }
        const chainName = ChainName[chainKey];
        const chainShortName = ChainShortName[chainKey];
        const chainArch = ChainType.EVM;
        const gatewayUrl = GatewayUrl[chainKey];
        return {
          type: txnTrackingProtocol.type as TxnTrackingProtocol,
          toBlock: txnTrackingProtocol.toBlock,
          fromBlock: txnTrackingProtocol.fromBlock,
          name: txnTrackingProtocol.name,
          contractAddress: txnTrackingProtocol.contractAddress,
          factoryAddress: txnTrackingProtocol.factoryAddress,
          chainArch: chainArch,
          chainId: chainId,
          gatewayUrl: gatewayUrl,
          chainShortName: chainShortName,
          chainName: chainName,
          rpcUrl:
            txnTrackingProtocol.chainId === ChainId.HEMI
              ? (envResult.data.RPC_URL_HEMI as string)
              : txnTrackingProtocol.chainId === ChainId.BASE
                ? (envResult.data.RPC_URL_BASE as string)
                : ChainId.ETHEREUM === txnTrackingProtocol.chainId
                  ? (envResult.data.RPC_URL_MAINNET as string)
                  : (envResult.data.RPC_URL_POLYGON as string),
        };
      });

    const dexProtocols: ValidatedDexProtocolConfig[] = configResult.data.dexProtocols.map(
      (dexProtocol) => {
        const chainId = dexProtocol.chainId;
        const chainKey = getChainEnumKey(chainId);
        if (!chainKey) {
          throw new Error(`${chainId} is not a supported chainId.`);
        }
        const chainName = ChainName[chainKey];
        const chainShortName = ChainShortName[chainKey];
        const chainArch = ChainType.EVM;
        const gatewayUrl = GatewayUrl[chainKey];

        return {
          type: dexProtocol.type,
          gatewayUrl: gatewayUrl,
          toBlock: dexProtocol.toBlock,
          protocols: dexProtocol.protocols as ProtocolConfig[],
          chainArch: chainArch,
          chainId: chainId,
          chainShortName: chainShortName,
          chainName: chainName,
          rpcUrl:
            dexProtocol.chainId === ChainId.ETHEREUM
              ? (envResult.data.RPC_URL_MAINNET as string)
              : (envResult.data.RPC_URL_HEMI as string),
        };
      },
    );

    const univ3Protocols: ValidatedUniv3ProtocolConfig[] = configResult.data.univ3Protocols.map(
      (univ3Protocol) => {
        const chainId = univ3Protocol.chainId;
        const chainKey = getChainEnumKey(chainId);
        if (!chainKey) {
          throw new Error(`${chainId} is not a supported chainId.`);
        }
        const chainName = ChainName[chainKey];
        const chainShortName = ChainShortName[chainKey];
        const chainArch = ChainType.EVM;
        const gatewayUrl = GatewayUrl[chainKey];
        return {
          type: univ3Protocol.type,
          chainId: chainId,
          chainArch: chainArch,
          chainShortName: chainShortName,
          chainName: chainName,
          gatewayUrl: gatewayUrl,
          rpcUrl:
            univ3Protocol.chainId === ChainId.ETHEREUM
              ? (envResult.data.RPC_URL_MAINNET as string)
              : (envResult.data.RPC_URL_HEMI as string),
          factoryAddress: univ3Protocol.factoryAddress,
          factoryDeployedAt: univ3Protocol.factoryDeployedAt,
          positionsAddress: univ3Protocol.positionsAddress,
          toBlock: univ3Protocol.toBlock,
          pools: univ3Protocol.pools as Univ3PoolConfig[],
        };
      },
    );

    const stakingProtocols: ValidatedStakingProtocolConfig[] =
      configResult.data.stakingProtocols.map((stakingProtocol) => {
        const chainId = stakingProtocol.chainId;
        const chainKey = getChainEnumKey(chainId);
        if (!chainKey) {
          throw new Error(`${chainId} is not a supported chainId.`);
        }
        const chainName = ChainName[chainKey];
        const chainShortName = ChainShortName[chainKey];
        const chainArch = ChainType.EVM;
        const gatewayUrl = GatewayUrl[chainKey];
        return {
          type: stakingProtocol.type as StakingProtocol,
          gatewayUrl: gatewayUrl,
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
              ? (envResult.data.RPC_URL_HEMI as string)
              : (envResult.data.RPC_URL_MAINNET as string),
        };
      });

    const zebuProtocols: ValidatedZebuProtocolConfig[] = configResult.data.zebuProtocols.map(
      (zebuProtocol) => {
        const enhancedClients: ZebuClientConfigWithChain[] = zebuProtocol.clients.map((client) => {
          const clientChainKey = getChainEnumKey(client.chainId);
          if (!clientChainKey) {
            throw new Error(
              `${client.chainId} is not a supported chainId for client ${client.name}`,
            );
          }

          return {
            name: client.name,
            contractAddress: client.contractAddress,
            chainId: client.chainId,
            fromBlock: client.fromBlock,
            chainArch: ChainType.EVM,
            chainShortName: ChainShortName[clientChainKey],
            chainName: ChainName[clientChainKey],
            rpcUrl:
              client.chainId === ChainId.BASE
                ? (envResult.data.RPC_URL_BASE as string)
                : (envResult.data.RPC_URL_POLYGON as string),
            gatewayUrl: GatewayUrl[clientChainKey],
          };
        });

        return {
          type: zebuProtocol.type,
          name: zebuProtocol.name,
          toBlock: zebuProtocol.toBlock,
          clients: enhancedClients,
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
      txnTrackingProtocols,
      stakingProtocols,
      univ3Protocols,
      zebuProtocols,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Environment validation failed: ${String(error)}`);
  }
}
