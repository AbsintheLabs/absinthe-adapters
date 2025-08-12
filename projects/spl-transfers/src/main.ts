import { AbsintheApiClient, HOURS_TO_MS } from '@absinthe/common';
import { SplTransfersProcessor } from './BatchProcessor';
import { validateEnv } from './utils/validateEnv';

const env = validateEnv();
const { splTransfersProtocol, baseConfig } = env;

const apiClient = new AbsintheApiClient({
  baseUrl: baseConfig.absintheApiUrl,
  apiKey: baseConfig.absintheApiKey,
});

const chainConfig = {
  chainArch: splTransfersProtocol.chainArch,
  networkId: splTransfersProtocol.chainId,
  chainShortName: splTransfersProtocol.chainShortName,
  chainName: splTransfersProtocol.chainName,
};

const WINDOW_DURATION_MS = baseConfig.balanceFlushIntervalHours * HOURS_TO_MS;
const splTransfersProcessor = new SplTransfersProcessor(
  splTransfersProtocol,
  WINDOW_DURATION_MS,
  apiClient,
  env.baseConfig,
  chainConfig,
);
splTransfersProcessor.run();
