import { AbsintheApiClient, validateEnv, HOURS_TO_MS, StakingProtocol } from '@absinthe/common';
import { HemiStakingProcessor } from './BatchProcessor';
const env = validateEnv();

const apiClient = new AbsintheApiClient({
  baseUrl: env.baseConfig.absintheApiUrl,
  apiKey: env.baseConfig.absintheApiKey,
  minTime: 90, // warn: remove this, it's temporary for testing
});

const hemiStakingProtocol = env.stakingProtocols.find((stakingProtocol) => {
  return stakingProtocol.type === StakingProtocol.HEMI;
});

if (!hemiStakingProtocol) {
  throw new Error('Hemi staking protocol not found');
}

const chainConfig = {
  chainArch: hemiStakingProtocol.chainArch,
  networkId: hemiStakingProtocol.chainId,
  chainShortName: hemiStakingProtocol.chainShortName,
  chainName: hemiStakingProtocol.chainName,
};

const WINDOW_DURATION_MS = env.baseConfig.balanceFlushIntervalHours * HOURS_TO_MS;
const hemiStakingProcessor = new HemiStakingProcessor(
  hemiStakingProtocol,
  WINDOW_DURATION_MS,
  apiClient,
  env.baseConfig,
  chainConfig,
);
hemiStakingProcessor.run();
