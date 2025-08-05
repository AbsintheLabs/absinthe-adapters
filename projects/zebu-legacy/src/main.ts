import { AbsintheApiClient, validateEnv, ProtocolType } from '@absinthe/common';
import { ZebuLegacyProcessor } from './BatchProcessor';
const env = validateEnv();

const apiClient = new AbsintheApiClient({
  baseUrl: env.baseConfig.absintheApiUrl,
  apiKey: env.baseConfig.absintheApiKey,
});

const zebuLegacy = env.zebuProtocols.find((zebuProtocol) => {
  return (
    zebuProtocol.type === ProtocolType.ZEBU && zebuProtocol.name.toLowerCase() === 'zebu-legacy'
  );
});

if (!zebuLegacy) {
  throw new Error('Zebu-Legacy protocol not found');
}
const zebuLegacyClients = zebuLegacy.clients;

console.log(zebuLegacyClients, 'zebuLegacyClients');

const zebuLegacyProcessor = new ZebuLegacyProcessor(zebuLegacyClients, apiClient, env.baseConfig);
zebuLegacyProcessor.run();
