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

const voucher = env.bondingCurveProtocols.find((bondingCurveProtocol) => {
  return bondingCurveProtocol.type === BondingCurveProtocol.VOUCHER;
});

if (!voucher) {
  throw new Error('Voucher protocol not found');
}

const chainConfig = {
  chainArch: voucher.chainArch,
  networkId: voucher.chainId,
  chainShortName: voucher.chainShortName,
  chainName: voucher.chainName,
};

// todo: make the contract address lowercase throughout the codebase

const voucherProcessor = new VoucherProcessor(voucher, apiClient, env.baseConfig, chainConfig);
voucherProcessor.run();
