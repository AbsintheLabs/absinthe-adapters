import { AbsintheApiClient, validateEnv, HOURS_TO_MS, StakingProtocol } from '@absinthe/common';
import { VUSDBridgeProcessor } from './BatchProcessor';
const env = validateEnv();

const apiClient = new AbsintheApiClient({
  baseUrl: env.baseConfig.absintheApiUrl,
  apiKey: env.baseConfig.absintheApiKey,
  minTime: 90, // warn: remove this, it's temporary for testing
});

const vusdBridgeProtocol = env.stakingProtocols.find((stakingProtocol) => {
  return stakingProtocol.type === StakingProtocol.VUSDBRIDGE;
});

if (!vusdBridgeProtocol) {
  throw new Error('VUSDBridge protocol not found');
}

const chainConfig = {
  chainArch: vusdBridgeProtocol.chainArch,
  networkId: vusdBridgeProtocol.chainId,
  chainShortName: vusdBridgeProtocol.chainShortName,
  chainName: vusdBridgeProtocol.chainName,
};

// todo: make the contract address lowercase throughout the codebase
// todo: revamp needed

const WINDOW_DURATION_MS = env.baseConfig.balanceFlushIntervalHours * HOURS_TO_MS;
const vusdBridgeProcessor = new VUSDBridgeProcessor(
  vusdBridgeProtocol,
  WINDOW_DURATION_MS,
  apiClient,
  env.baseConfig,
  chainConfig,
);
vusdBridgeProcessor.run();
