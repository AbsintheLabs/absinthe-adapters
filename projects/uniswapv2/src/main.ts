import { AbsintheApiClient, validateEnv, HOURS_TO_MS } from '@absinthe/common';
import { UniswapV2Processor } from './Univ2Processor';

const env = validateEnv();

const apiClient = new AbsintheApiClient({
  baseUrl: env.absintheApiUrl,
  apiKey: env.absintheApiKey,
  minTime: 0 // warn: remove this, it's temporary for testing
});

const WINDOW_DURATION_MS = env.balanceFlushIntervalHours * HOURS_TO_MS;

const uniswapProcessor = new UniswapV2Processor(env, WINDOW_DURATION_MS, apiClient);
uniswapProcessor.run();