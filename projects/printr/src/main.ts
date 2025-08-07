import { AbsintheApiClient, TxnTrackingProtocol, validateEnv } from '@absinthe/common';
import dotenv from 'dotenv';
import { PrintrProcessor } from './BatchProcessor';

dotenv.config();

const env = validateEnv();

const apiClient = new AbsintheApiClient({
  baseUrl: env.baseConfig.absintheApiUrl,
  apiKey: env.baseConfig.absintheApiKey,
  minTime: 90,
});

const printrBondingCurveProtocol = env.txnTrackingProtocols.find((txnTrackingProtocol) => {
  return txnTrackingProtocol.type === TxnTrackingProtocol.PRINTR;
});

if (!printrBondingCurveProtocol) {
  throw new Error('Printr protocol not found');
}

const chainConfig = {
  chainArch: printrBondingCurveProtocol.chainArch,
  networkId: printrBondingCurveProtocol.chainId,
  chainShortName: printrBondingCurveProtocol.chainShortName,
  chainName: printrBondingCurveProtocol.chainName,
};

const printrProcessor = new PrintrProcessor(
  printrBondingCurveProtocol,
  apiClient,
  env.baseConfig,
  chainConfig,
);
printrProcessor.run();
