import {
  AbsintheApiClient,
  validateEnv,
  HOURS_TO_MS,
  BondingCurveProtocol,
  Dex,
} from '@absinthe/common';
import { UniswapV2Processor } from './Univ2Processor';
import dotenv from 'dotenv';

dotenv.config();

const env = validateEnv();

const apiClient = new AbsintheApiClient({
  baseUrl: env.baseConfig.absintheApiUrl,
  apiKey: env.baseConfig.absintheApiKey,
  minTime: 90, // warn: remove this, it's temporary for testing
});

const uniswapV2DexProtocol = env.dexProtocols.find((dexProtocol) => {
  return dexProtocol.type === Dex.UNISWAP_V2;
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

// todo: make the contract address lowercase throughout the codebase

console.log(process.env.DB_URL);

const WINDOW_DURATION_MS = env.baseConfig.balanceFlushIntervalHours * HOURS_TO_MS;
const uniswapProcessor = new UniswapV2Processor(
  uniswapV2DexProtocol,
  WINDOW_DURATION_MS,
  apiClient,
  env.baseConfig,
  chainConfig,
);
uniswapProcessor.run();
