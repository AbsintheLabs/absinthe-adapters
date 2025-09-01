import { AbsintheApiClient, HOURS_TO_MS } from '@absinthe/common';
import { OrcaProcessor } from './BatchProcessor';
import { validateEnv } from './utils/validateEnv';

const env = validateEnv();
const { orcaProtocol, baseConfig } = env;

const apiClient = new AbsintheApiClient({
  baseUrl: baseConfig.absintheApiUrl,
  apiKey: baseConfig.absintheApiKey,
});

const chainConfig = {
  chainArch: orcaProtocol.chainArch,
  networkId: orcaProtocol.chainId,
  chainShortName: orcaProtocol.chainShortName,
  chainName: orcaProtocol.chainName,
};

const WINDOW_DURATION_MS = baseConfig.balanceFlushIntervalHours * HOURS_TO_MS;
const orcaProcessor = new OrcaProcessor(
  orcaProtocol,
  WINDOW_DURATION_MS,
  apiClient,
  env.baseConfig,
  chainConfig,
);
orcaProcessor.run();
