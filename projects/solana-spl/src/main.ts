import { AbsintheApiClient, ProtocolType, validateEnv } from '@absinthe/common';
import { SolanaSplProcessor } from './BatchProcessor';

async function main() {
  try {
    const env = validateEnv();

    const apiClient = new AbsintheApiClient({
      baseUrl: env.baseConfig.absintheApiUrl,
      apiKey: env.baseConfig.absintheApiKey,
    });

    const solanaSplProtocol = env.solanaSplProtocols?.find(
      (p) => p.type === ProtocolType.SOLANA_SPL,
    );

    if (!solanaSplProtocol) {
      throw new Error('Solana SPL protocol not found');
    }

    const processor = new SolanaSplProcessor(solanaSplProtocol, apiClient, env.baseConfig);

    const handleExit = async (signal?: string) => {
      try {
        console.log(`Flushing state before exit${signal ? ` (${signal})` : ''}...`);
        await processor.flushOnShutdown();
      } finally {
        process.exit(0);
      }
    };

    process.on('SIGINT', () => handleExit('SIGINT'));
    process.on('SIGTERM', () => handleExit('SIGTERM'));
    process.on('exit', () => handleExit());

    await processor.run();

    console.log('Solana SPL processor completed successfully');
  } catch (error) {
    console.error('Error in main:', error);
    process.exit(1);
  }
}

main();
