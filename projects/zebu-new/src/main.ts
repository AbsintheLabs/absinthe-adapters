import { AbsintheApiClient, validateEnv, ProtocolType } from '@absinthe/common';
import { ZebuNewProcessor } from './BatchProcessor';
import dotenv from 'dotenv';

dotenv.config();

const env = validateEnv();

const network = process.argv[2];
const networkToChainId: Record<string, number> = {
  bsc: 56,
  polygon: 137,
  base: 8453,
  mainnet: 1,
  arbitrum: 42161,
  optimism: 10,
};

const chainId = networkToChainId[network];

if (!chainId) {
  throw new Error('Network argument is required. Usage: pnpm run dev:bsc');
}

const apiClient = new AbsintheApiClient({
  baseUrl: env.baseConfig.absintheApiUrl,
  apiKey: env.baseConfig.absintheApiKey,
});

const zebuNew = env.zebuProtocols.find((zebuProtocol) => {
  return zebuProtocol.type === ProtocolType.ZEBU && zebuProtocol.name.toLowerCase() === 'zebu-new';
});

if (!zebuNew) {
  throw new Error('Zebu-New protocol not found');
}
const zebuNewClients = zebuNew.clients.filter((client) => client.chainId === chainId);

const zebuNewProcessor = new ZebuNewProcessor(zebuNewClients, apiClient, env.baseConfig, chainId);
zebuNewProcessor.run();
