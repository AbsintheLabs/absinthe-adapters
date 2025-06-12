import { AbsintheApiClient, BondingCurveProtocol, Dex, validateEnv } from '@absinthe/common';
import dotenv from 'dotenv';
import { PrintrProcessor } from './BatchProcessor';

dotenv.config();

const env = validateEnv();

const apiClient = new AbsintheApiClient({
  baseUrl: env.baseConfig.absintheApiUrl,
  apiKey: env.baseConfig.absintheApiKey,
  minTime: 0, // todo: remove this, it's temporary for testing
});

const printrBondingCurveProtocol = env.bondingCurveProtocols.find((bondingCurveProtocol) => {
  return bondingCurveProtocol.type === BondingCurveProtocol.PRINTR;
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
