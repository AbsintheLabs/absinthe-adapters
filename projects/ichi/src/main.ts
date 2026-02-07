// Main entry point for the ICHI indexer

import { Engine } from './engine';
import { CsvSink } from './esink';
import { createIchiAdapter } from './adapters';
import { defaultFeedConfig } from './config/pricing';

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

const ichiAdapter = createIchiAdapter(defaultFeedConfig);
const sink = new CsvSink('windows.csv');

new Engine(ichiAdapter, sink).run();