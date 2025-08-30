// Main entry point for the ICHI indexer

import { Engine } from './engine';
import { CsvSink, SinkFactory } from './sinks';
import { createIchiAdapter } from './adapters';
import { createUniv2Adapter } from './adapters/univ2';
import { defaultFeedConfig } from './config/pricing';
import { loadConfig } from './config/load';

// ------------------------------------------------------------
// Example configurations and core problem notes
// ------------------------------------------------------------

// core problem:
/*
- certain tokens that we're tracking (like for balance delta) are not priced by coingecko but a diff strategy
- we can't determine by asset address (since they might both be erc20s)
- dynamic pricing is hard. let's not do that. pass in everything in the config.
*/

// note: both univ2nav and pricefeed should implement cachable (which means that values that have already
// been found should be returned immediately rather than requerying)

// case 1: we need to fetch an underlying price (which we already have that day) which means it will be re-cached
// case 2: we need to fetch the pricing of univ2 nav to price the LP token. We will price the lp token each day as well for simplicity.

// ------------------------------------------------------------
// Final! Running the engine. This is just the driver.
// Will probably load the config from the env anyway so it might even stay the same for all indexers.
// --------------DRIVER CODE--------------
// ------------------------------------------------------------

// Read command line arguments and load configuration
const configFilename = process.argv[2]; // First argument after the script name
const appCfg = loadConfig(configFilename); // All config loading logic is in loadConfig()

// const ichiAdapter = createIchiAdapter(defaultFeedConfig);

import { AssetFeedConfig } from './types/pricing';
import { createVusdMintAdapter } from './adapters/vusd-mint';
import { AbsintheApiClient } from '@absinthe/common';

// export const univ2TestConfig: AssetFeedConfig = {
//   // LP token address - this will be priced using the official univ2nav feed
//   // Note: The key IS the pool address, no need to specify it separately
//   '0x0621bae969de9c153835680f158f481424c0720a': {
//     assetType: 'erc20',
//     priceFeed: {
//       kind: 'univ2nav',
//       token0: {
//         assetType: 'erc20',
//         priceFeed: {
//           kind: 'coingecko',
//           id: 'bitcoin',
//         },
//       },
//       token1: {
//         assetType: 'erc20',
//         priceFeed: {
//           kind: 'pegged',
//           usdPegValue: 1,
//         },
//       },
//     },
//   },
// };

export const vusdMintTestConfig: AssetFeedConfig = {
  '0x677ddbd918637E5F2c79e164D402454dE7dA8619': {
    assetType: 'erc20',
    priceFeed: {
      kind: 'coingecko',
      id: 'vesper-vdollar',
    },
  },
};

const apiClient = new AbsintheApiClient({
  baseUrl: appCfg.absintheApiUrl,
  apiKey: appCfg.absintheApiKey,
});

const vusdMintAdapter = createVusdMintAdapter(vusdMintTestConfig);
// const sink = SinkFactory.create({ kind: 'absinthe' }, apiClient);
const sink = SinkFactory.create({ kind: 'csv', path: 'output.csv' });
new Engine(vusdMintAdapter, sink, appCfg).run();
