// Main entry point for the ICHI indexer

import { Engine } from './engine';
import { CsvSink } from './esink';
import { defaultFeedConfig } from './config/pricing';
import { loadConfig } from './config/load';

// adapters
import { createIchiAdapter } from './adapters';
import { createUniv2Adapter } from './adapters/univ2';
import { createUniv3Adapter } from './adapters/univ3';
import dotenv from 'dotenv';
dotenv.config();

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

const ichiAdapter = createIchiAdapter(defaultFeedConfig);

import { AssetFeedConfig } from './types/pricing';

export const univ2TestConfig: AssetFeedConfig = [
  // LP token address - this will be priced using the official univ2nav feed
  // Note: The key IS the pool address, no need to specify it separately
  {
    match: { key: '0x0621bae969de9c153835680f158f481424c0720a' },
    config: {
      assetType: 'erc20',
      priceFeed: {
        kind: 'univ2nav',
        token0: {
          assetType: 'erc20',
          priceFeed: {
            kind: 'coingecko',
            id: 'bitcoin',
          },
        },
        token1: {
          assetType: 'erc20',
          priceFeed: {
            kind: 'pegged',
            usdPegValue: 1,
          },
        },
      },
    },
  },
];
const univ2Adapter = createUniv2Adapter(univ2TestConfig);

// ———————————————————————————————————————————————————————
// export const sampleuniv3config: AssetFeedConfig = [
//   // univ3 pool address
//   '0x92787e904D925662272F3776b8a7f0b8F92F9BB5': {
//     assetType: 'erc721',
//     priceFeed: {
//       kind: 'univ3lp',
//       nonfungiblepositionmanager: '0xe43ca1Dee3F0fc1e2df73A0745674545F11A59F5',
//       // factory: '0xCdBCd51a5E8728E0AF4895ce5771b7d17fF71959',
//       token0: {
//         assetType: 'erc20',
//         priceFeed: {
//           kind: 'coingecko',
//           id: 'pepe'
//         }
//       },
//       token1: {
//         assetType: 'erc20',
//         priceFeed: {
//           kind: 'pegged',
//           usdPegValue: 1
//         }
//       }
//     }
//   }
// }
export const sampleuniv3config: AssetFeedConfig = [
  // univ3 pool address - matches the specific pool from user's request
  {
    match: {
      matchLabels: {
        protocol: 'uniswap-v3',
        pool: '0x92787e904d925662272f3776b8a7f0b8f92f9bb5',
      },
    },
    config: {
      assetType: 'erc721',
      priceFeed: {
        kind: 'univ3lp',
        nonfungiblepositionmanager: '0xe43ca1Dee3F0fc1e2df73A0745674545F11A59F5',
        // factory: '0xCdBCd51a5E8728E0AF4895ce5771b7d17fF71959',
        token0: {
          assetType: 'erc20',
          priceFeed: {
            kind: 'coingecko',
            id: 'bitcoin',
          },
        },
        token1: {
          assetType: 'erc20',
          priceFeed: {
            kind: 'pegged',
            usdPegValue: 1,
          },
        },
      },
    },
  },
];

// testing univ3
new Engine(createUniv3Adapter(sampleuniv3config), new CsvSink('windows.csv'), appCfg).run();
