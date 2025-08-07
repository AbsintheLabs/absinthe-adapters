import { AbsintheApiClient, validateEnv, TxnTrackingProtocol } from '@absinthe/common';
import { VoucherProcessor } from './BatchProcessor';
import dotenv from 'dotenv';

dotenv.config();

const env = validateEnv();

const apiClient = new AbsintheApiClient({
  baseUrl: env.baseConfig.absintheApiUrl,
  apiKey: env.baseConfig.absintheApiKey,
});

const voucher = env.txnTrackingProtocols.find((txnTrackingProtocol) => {
  return txnTrackingProtocol.type === TxnTrackingProtocol.VOUCHER;
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

const voucherProcessor = new VoucherProcessor(voucher, apiClient, env.baseConfig, chainConfig);
voucherProcessor.run();
