import { AbsintheApiClient, validateEnv, HOURS_TO_MS, ProtocolType } from '@absinthe/common';
import { UniswapV2Processor } from './BatchProcessor';
const env = validateEnv();

const apiClient = new AbsintheApiClient({
  baseUrl: env.baseConfig.absintheApiUrl,
  apiKey: env.baseConfig.absintheApiKey,
});

const uniswapV2DexProtocol = env.dexProtocols.find((dexProtocol) => {
  return dexProtocol.type === ProtocolType.UNISWAP_V2;
});

if (!uniswapV2DexProtocol) {
  throw new Error('Uniswap V2 protocol not found');
}

const chainConfig = {
  chainArch: uniswapV2DexProtocol.chainArch,
  networkId: uniswapV2DexProtocol.chainId,
  chainShortName: uniswapV2DexProtocol.chainShortName,
  chainName: uniswapV2DexProtocol.chainName,
};

const WINDOW_DURATION_MS = env.baseConfig.balanceFlushIntervalHours * HOURS_TO_MS;
const uniswapProcessor = new UniswapV2Processor(
  uniswapV2DexProtocol,
  WINDOW_DURATION_MS,
  apiClient,
  env.baseConfig,
  chainConfig,
);
uniswapProcessor.run();
