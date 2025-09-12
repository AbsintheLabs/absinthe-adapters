// // Main entry point for the ICHI indexer

// import { Engine } from './engine';
// import { CsvSink } from './sinks';
// import { defaultFeedConfig } from './config/pricing';
// import { loadConfig } from './config/load';

// // adapters
// import { createIchiAdapter } from './adapters';
// import { createUniv2Adapter } from './adapters/univ2';
// import { createUniv3Adapter } from './adapters/univ3';
// import dotenv from 'dotenv';
// dotenv.config();

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

// const ichiAdapter = createIchiAdapter(defaultFeedConfig);

// import { AssetFeedConfig } from './types/pricing';

// export const univ2TestConfig: AssetFeedConfig = [
//   // LP token address - this will be priced using the official univ2nav feed
//   // Note: The key IS the pool address, no need to specify it separately
//   {
//     match: { key: '0x0621bae969de9c153835680f158f481424c0720a' },
//     config: {
//       assetType: 'erc20',
//       priceFeed: {
//         kind: 'univ2nav',
//         token0: {
//           assetType: 'erc20',
//           priceFeed: {
//             kind: 'coingecko',
//             id: 'bitcoin',
//           },
//         },
//         token1: {
//           assetType: 'erc20',
//           priceFeed: {
//             kind: 'pegged',
//             usdPegValue: 1,
//           },
//         },
//       },
//     },
//   },
// ];
// const univ2Adapter = createUniv2Adapter(univ2TestConfig);

// // ———————————————————————————————————————————————————————
// // export const sampleuniv3config: AssetFeedConfig = [
// //   // univ3 pool address
// //   '0x92787e904D925662272F3776b8a7f0b8F92F9BB5': {
// //     assetType: 'erc721',
// //     priceFeed: {
// //       kind: 'univ3lp',
// //       nonfungiblepositionmanager: '0xe43ca1Dee3F0fc1e2df73A0745674545F11A59F5',
// //       // factory: '0xCdBCd51a5E8728E0AF4895ce5771b7d17fF71959',
// //       token0: {
// //         assetType: 'erc20',
// //         priceFeed: {
// //           kind: 'coingecko',
// //           id: 'pepe'
// //         }
// //       },
// //       token1: {
// //         assetType: 'erc20',
// //         priceFeed: {
// //           kind: 'pegged',
// //           usdPegValue: 1
// //         }
// //       }
// //     }
// //   }
// // }
// // export const sampleuniv3config: AssetFeedConfig = [
// //   // univ3 pool address - matches the specific pool from user's request
// //   {
// //     match: {
// //       matchLabels: {
// //         protocol: 'uniswap-v3',
// //         pool: '0x92787e904d925662272f3776b8a7f0b8f92f9bb5',
// //       },
// //     },
// //     config: {
// //       assetType: 'erc721',
// //       priceFeed: {
// //         kind: 'univ3lp',
// //         nonfungiblepositionmanager: '0xe43ca1Dee3F0fc1e2df73A0745674545F11A59F5',
// //         // factory: '0xCdBCd51a5E8728E0AF4895ce5771b7d17fF71959',
// //         token0: {
// //           assetType: 'erc20',
// //           priceFeed: {
// //             kind: 'coingecko',
// //             id: 'bitcoin',
// //           },
// //         },
// //         token1: {
// //           assetType: 'erc20',
// //           priceFeed: {
// //             kind: 'pegged',
// //             usdPegValue: 1,
// //           },
// //         },
// //       },
// //     },
// //   },
// // ];

// // temporary
// import { AssetFeedConfig } from './types/pricing';
// const idealConfig: AssetFeedConfig = [
//   // Example: Only token0 feed provided - derives token1 price from pool
//   // This matches any v3 pool that has WETH as either token0 OR token1
//   {
//     match: {
//       matchExpressions: [
//         // Must be Uniswap V3 protocol
//         {
//           key: 'protocol',
//           op: 'In',
//           values: ['uniswap-v3'],
//         },
//         // ----------for testing -----------
//         { key: 'token0', op: 'In', values: ['0x4200000000000000000000000000000000000006'] },
//         { key: 'tickUpper', op: 'In', values: ['-202653'] },
//         // { key: 'tickLower', op: 'In', values: ['66400'] },
//         // ----------for testing -----------
//         {
//           key: 'token1',
//           op: 'In',
//           // xxx: make sure that these are lowercased if we're in evm land // bug!!!
//           values: ['0xad11a8beb98bbf61dbb1aa0f6d6f2ecd87b35afa'],
//         },
//       ],
//     },
//     config: {
//       assetType: 'erc721',
//       priceFeed: {
//         kind: 'univ3lp',
//         // bug: make sure that these are lowercased if we're in evm land
//         nonfungiblepositionmanager: '0xe43ca1dee3f0fc1e2df73a0745674545f11a59f5',
//         tokenSelector: 'token1',
//         token: {
//           assetType: 'erc20',
//           priceFeed: {
//             kind: 'pegged',
//             usdPegValue: 1,
//           },
//         },
//       },
//     },
//   },
// ];

// START OF NEW DRIVER CODE
// imports
import dotenv from 'dotenv';
dotenv.config();
process.env.SQUID_PROCESSOR_EXIT_DISABLED = process.env.SQUID_PROCESSOR_EXIT_DISABLED || 'true';

import { loadConfig } from './config/load';
import { buildBaseSqdProcessor } from './eprocessorBuilder';
import { Sink, SinkFactory } from './sinks';
import { createClient, RedisClientType } from 'redis';
import { AppConfig } from './config/schema';
import { Adapter, EmitFunctions } from './types/adapter';

// New registry imports
import { EngineIO, BuiltAdapter } from './adapter-core';
import { buildAdapter } from './adapter-registry';
// Import adapters to register them
import './adapters';
import { Engine } from './engine/engine';

import { BaseProcessor } from './eprocessorBuilder';
// todo: move this somewhere else with typing definitions
export interface EngineDeps {
  appCfg: AppConfig;
  sink: Sink;
  adapter: BuiltAdapter;
  sqdProcessor: BaseProcessor;
  redis: RedisClientType;
}

async function main() {
  // load config
  const appCfg = loadConfig(process.argv[2]);

  // create sink
  const sink = SinkFactory.create(appCfg.sinkConfig);

  // create base processor
  // note: we're using types from two different processors (processor.ts and from the official sqd lib), so we should fix this later
  const baseSqdProcessor = buildBaseSqdProcessor(appCfg);

  // create redis connection
  // not sure why we have to do this weird casting...
  const redis = createClient({ url: appCfg.redisUrl }) as RedisClientType;
  await redis.connect();

  // create EngineIO for dependency injection
  const io: EngineIO = {
    redis,
    log: console.log,
  };

  // build adapter using registry
  const adapter = buildAdapter(appCfg.adapterConfig.name, appCfg.adapterConfig.params, io);

  // construct the real processor using the adapter
  const sqdProcessor = adapter.buildProcessor(baseSqdProcessor);
  const deps: EngineDeps = {
    appCfg,
    sink,
    adapter,
    sqdProcessor,
    redis,
  };

  // Log verification of configuration
  console.log('--- Engine Configuration Verification ---');
  console.log('App Config:', JSON.stringify(appCfg, null, 2));
  console.log('Sink:', sink);
  console.log('Adapter:', adapter);
  console.log('Processor:', sqdProcessor);
  console.log('Redis:', redis);
  console.log('--- End of Configuration ---');
  console.log('Exiting before running engine.run() as requested.');

  const engine = new Engine(deps);
  await engine.run();
}

main();
