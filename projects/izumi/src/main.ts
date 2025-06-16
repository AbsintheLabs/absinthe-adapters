import { AbsintheApiClient, validateEnv, HOURS_TO_MS, Dex } from '@absinthe/common';
import { IzumiProcessor } from './BatchProcessor';
import dotenv from 'dotenv';

dotenv.config();

const env = validateEnv();

const apiClient = new AbsintheApiClient({
  baseUrl: env.baseConfig.absintheApiUrl,
  apiKey: env.baseConfig.absintheApiKey,
  minTime: 90, // warn: remove this, it's temporary for testing
});

const izumiDexProtocol = env.dexProtocols.find((dexProtocol) => {
  return dexProtocol.type === Dex.IZUMI;
});

if (!izumiDexProtocol) {
  throw new Error('Izumi protocol not found');
}

const chainConfig = {
  chainArch: izumiDexProtocol.chainArch,
  networkId: izumiDexProtocol.chainId,
  chainShortName: izumiDexProtocol.chainShortName,
  chainName: izumiDexProtocol.chainName,
};

// todo: make the contract address lowercase throughout the codebase

const WINDOW_DURATION_MS = env.baseConfig.balanceFlushIntervalHours * HOURS_TO_MS;
const izumiProcessor = new IzumiProcessor(
  izumiDexProtocol,
  WINDOW_DURATION_MS,
  apiClient,
  env.baseConfig,
  chainConfig,
);
izumiProcessor.run();
