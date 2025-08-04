import { AbsintheApiClient, BondingCurveProtocol, validateEnv } from '@absinthe/common';
import { VusdMintProcessor } from './BatchProcessor';

const env = validateEnv();

const apiClient = new AbsintheApiClient({
  baseUrl: env.baseConfig.absintheApiUrl,
  apiKey: env.baseConfig.absintheApiKey,
  minTime: 90,
});

const vusdMintBondingCurveProtocol = env.bondingCurveProtocols.find((bondingCurveProtocol) => {
  return bondingCurveProtocol.type === BondingCurveProtocol.VUSD_MINT;
});

if (!vusdMintBondingCurveProtocol) {
  throw new Error('VUSDMint protocol not found');
}

const chainConfig = {
  chainArch: vusdMintBondingCurveProtocol.chainArch,
  networkId: vusdMintBondingCurveProtocol.chainId,
  chainShortName: vusdMintBondingCurveProtocol.chainShortName,
  chainName: vusdMintBondingCurveProtocol.chainName,
};

const vusdMintProcessor = new VusdMintProcessor(
  vusdMintBondingCurveProtocol,
  apiClient,
  env.baseConfig,
  chainConfig,
);
vusdMintProcessor.run();
