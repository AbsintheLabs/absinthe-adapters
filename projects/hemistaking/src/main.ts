import { checkToken, PriceService, RedisService, TwbAdapter } from '@absinthe/common';
import { validateEnv } from './utils/validateEnv';
import { TwbEngine } from '@absinthe/common/src/services/TwbEngine';
import * as hemiAbi from './abi/hemi';
import Big from 'big.js';
import { processor } from './processor';
import { TOKEN_METADATA } from './utils/consts';
import { RedisPriceStore } from '@absinthe/common/src/services/RedisPriceStore';

const env = validateEnv();
const { hemiStakingProtocol, baseConfig } = env;
const redisService = RedisService.getInstance();
const priceStore = new RedisPriceStore(redisService, 'hemi:price');
const priceService = new PriceService(priceStore, baseConfig.coingeckoApiKey, x); // todo: add helper to get the decimals dynamically from erc20 contracts (this can be a common util since the abi is shared for many erc20s)

const hemiAdapter: TwbAdapter = {
  onEvent: async (block, log, emit) => {
    if (log.topics[0] === hemiAbi.events.Deposit.topic) {
      const { depositor, token, amount } = hemiAbi.events.Deposit.decode(log);
      const tokenMetadata = checkToken(token, TOKEN_METADATA);
      if (!tokenMetadata?.coingeckoId) {
        console.warn(`No CoinGecko ID found for asset: ${token}`);
        return;
      }
      emit.balanceDelta({
        user: depositor,
        asset: token,
        amount: new Big(amount.toString()),
      });
    } else if (log.topics[0] === hemiAbi.events.Withdraw.topic) {
      const { withdrawer, token, amount } = hemiAbi.events.Withdraw.decode(log);
      const tokenMetadata = checkToken(token, TOKEN_METADATA);
      if (!tokenMetadata?.coingeckoId) {
        console.warn(`No CoinGecko ID found for asset: ${token}`);
        return;
      }
      emit.balanceDelta({
        user: withdrawer,
        asset: token,
        amount: new Big(amount.toString()).neg(),
      });
    }
  },
  // todo: need to figure out how to abstract away the tokens from the intracacies of each pricing module

  priceAsset: async (input, providers) => {
    const { atMs, asset, coingeckoId } = input;

    try {
      // Use providers.usdPrimitive for pricing
      const priceData = await providers.usdPrimitive(atMs, [
        {
          coingeckoId: coingeckoId,
          address: asset,
          chain: 'ethereum',
        },
      ]);

      return priceData[asset] || 0;
    } catch (error) {
      console.warn(`Failed to fetch price for ${asset}:`, error);
      return 0;
    }
  },
};

// todo: add a feature to not actually send data to the api to allow for testing
// todo: what does testing and validation look like before actually hooking it up to the api?
const engine = new TwbEngine(
  { enablePriceCache: false },
  processor,
  hemiAdapter,
  hemiStakingProtocol,
  baseConfig,
);
engine.run();
