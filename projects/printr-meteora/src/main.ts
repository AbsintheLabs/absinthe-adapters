import { AbsintheApiClient, HOURS_TO_MS, HOURS_TO_SECONDS } from '@absinthe/common';
import { PrintrMeteoraProcessor } from './BatchProcessor';
import { validateEnv } from './utils/validateEnv';

const env = validateEnv();
const { printrMeteoraProtocol, baseConfig } = env;

const apiClient = new AbsintheApiClient({
  baseUrl: baseConfig.absintheApiUrl,
  apiKey: baseConfig.absintheApiKey,
});

const chainConfig = {
  chainArch: printrMeteoraProtocol.chainArch,
  networkId: printrMeteoraProtocol.chainId,
  chainShortName: printrMeteoraProtocol.chainShortName,
  chainName: printrMeteoraProtocol.chainName,
};

const printrMeteoraProcessor = new PrintrMeteoraProcessor(
  printrMeteoraProtocol,
  apiClient,
  env.baseConfig,
  chainConfig,
  printrMeteoraProtocol.rpcUrl,
);
printrMeteoraProcessor.run();

// 8ecf5656-32e2-4b43-b055-ed41906fa175
