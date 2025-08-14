import { AbsintheApiClient, HOURS_TO_MS, StakingProtocol } from '@absinthe/common';
import { HemiStakingProcessor } from './BatchProcessor';
import { validateEnv } from './utils/validateEnv';

const env = validateEnv();
const { hemiStakingProtocol, baseConfig } = env;

const apiClient = new AbsintheApiClient({
  baseUrl: baseConfig.absintheApiUrl,
  apiKey: baseConfig.absintheApiKey,
});

const chainConfig = {
  chainArch: hemiStakingProtocol.chainArch,
  networkId: hemiStakingProtocol.chainId,
  chainShortName: hemiStakingProtocol.chainShortName,
  chainName: hemiStakingProtocol.chainName,
};

const WINDOW_DURATION_MS = baseConfig.balanceFlushIntervalHours * HOURS_TO_MS;

const hemiStakingProcessor = new HemiStakingProcessor(
  hemiStakingProtocol,
  WINDOW_DURATION_MS,
  apiClient,
  baseConfig,
  chainConfig,
);
hemiStakingProcessor.run();
