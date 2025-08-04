import { AbsintheApiClient, validateEnv, BondingCurveProtocol } from '@absinthe/common';
import { DemosProcessor } from './BatchProcessor';

const env = validateEnv();

const apiClient = new AbsintheApiClient({
  baseUrl: env.baseConfig.absintheApiUrl,
  apiKey: env.baseConfig.absintheApiKey,
  minTime: 90, // warn: remove this, it's temporary for testing
});

const demosProtocol = env.bondingCurveProtocols.find((bondingCurveProtocol) => {
  return bondingCurveProtocol.type === BondingCurveProtocol.DEMOS;
});

if (!demosProtocol) {
  throw new Error('Demos protocol not found');
}

const chainConfig = {
  chainArch: demosProtocol.chainArch,
  networkId: demosProtocol.chainId,
  chainShortName: demosProtocol.chainShortName,
  chainName: demosProtocol.chainName,
};

const demosProcessor = new DemosProcessor(demosProtocol, apiClient, env.baseConfig, chainConfig);
demosProcessor.run();
