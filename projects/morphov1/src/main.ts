import { AbsintheApiClient, validateEnv, HOURS_TO_MS, StakingProtocol } from '@absinthe/common';
import { MorphoStakingProcessor } from './BatchProcessor';
const env = validateEnv();

const apiClient = new AbsintheApiClient({
  baseUrl: env.baseConfig.absintheApiUrl,
  apiKey: env.baseConfig.absintheApiKey,
});

const morphoStakingProtocol = env.stakingProtocols.find((stakingProtocol) => {
  return stakingProtocol.type === StakingProtocol.MORPHO;
});

if (!morphoStakingProtocol) {
  throw new Error('Morpho staking protocol not found');
}

const chainConfig = {
  chainArch: morphoStakingProtocol.chainArch,
  networkId: morphoStakingProtocol.chainId,
  chainShortName: morphoStakingProtocol.chainShortName,
  chainName: morphoStakingProtocol.chainName,
};

const WINDOW_DURATION_MS = env.baseConfig.balanceFlushIntervalHours * HOURS_TO_MS;
const morphoStakingProcessor = new MorphoStakingProcessor(
  morphoStakingProtocol,
  WINDOW_DURATION_MS,
  apiClient,
  env.baseConfig,
  chainConfig,
);
morphoStakingProcessor.run();
