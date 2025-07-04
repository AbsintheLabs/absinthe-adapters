import { AbsintheApiClient, validateEnv, BondingCurveProtocol } from '@absinthe/common';
import { VoucherProcessor } from './BatchProcessor';
import dotenv from 'dotenv';

dotenv.config();

const env = validateEnv();

const apiClient = new AbsintheApiClient({
  baseUrl: env.baseConfig.absintheApiUrl,
  apiKey: env.baseConfig.absintheApiKey,
  minTime: 90, // warn: remove this, it's temporary for testing
});

const zebuNew = env.bondingCurveProtocols.find((bondingCurveProtocol) => {
  return bondingCurveProtocol.type === BondingCurveProtocol.VOUCHER;
});

if (!zebuNew) {
  throw new Error('Voucher protocol not found');
}

const chainConfig = {
  chainArch: zebuNew.chainArch,
  networkId: zebuNew.chainId,
  chainShortName: zebuNew.chainShortName,
  chainName: zebuNew.chainName,
};

// todo: make the contract address lowercase throughout the codebase

const voucherProcessor = new ZebuNewProcessor(zebuNew, apiClient, env.baseConfig, chainConfig);
voucherProcessor.run();
