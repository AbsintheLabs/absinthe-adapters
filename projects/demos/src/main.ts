import { AbsintheApiClient, validateEnv, TxnTrackingProtocol } from '@absinthe/common';
import { DemosProcessor } from './BatchProcessor';

const env = validateEnv();

const apiClient = new AbsintheApiClient({
  baseUrl: env.baseConfig.absintheApiUrl,
  apiKey: env.baseConfig.absintheApiKey,
});

const demosProtocol = env.txnTrackingProtocols.find((txnTrackingProtocol) => {
  return txnTrackingProtocol.type === TxnTrackingProtocol.DEMOS;
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
