// imports
import dotenv from 'dotenv';
dotenv.config();
// prevent squid from prematurely exiting
process.env.SQUID_PROCESSOR_EXIT_DISABLED = process.env.SQUID_PROCESSOR_EXIT_DISABLED || 'true';
// silence sqd info logs to stderr
process.env.SQD_FATAL = '*';

import { loadConfig } from './config/load.ts';
import { buildBaseSqdProcessor } from './eprocessorBuilder.ts';
import { Sink, SinkFactory } from './sinks/index.ts';
import { Redis } from 'ioredis';
import { AppConfig } from './config/schema.ts';
import { log } from './utils/logger.ts';

// New registry imports
import { EngineIO, BuiltAdapter } from './adapter-core.ts';
import { buildAdapter } from './adapter-registry.ts';
import { Engine } from './engine/engine.ts';

import { loadAllAdapters } from './adapters/loader.ts';

import { BaseProcessor } from './eprocessorBuilder.ts';
import { md5Hash } from './utils/helper.ts';
// todo: move this somewhere else with typing definitions
export interface EngineDeps {
  appCfg: AppConfig;
  sink: Sink;
  adapter: BuiltAdapter;
  sqdProcessor: BaseProcessor;
  redis: Redis;
}

async function main() {
  // dynamically load and register all adapters
  await loadAllAdapters();

  // load config
  const appCfg = await loadConfig(process.argv[2]);

  // create sink
  const sink = SinkFactory.create(appCfg.sinkConfig);

  // create base processor
  // note: we're using types from two different processors (processor.ts and from the official sqd lib), so we should fix this later
  const baseSqdProcessor = buildBaseSqdProcessor(appCfg);

  // create redis connection (ioredis auto-connects)
  const keyPrefix = md5Hash(appCfg, 6) + ':';
  const redis = new Redis(appCfg.redisUrl, { keyPrefix: keyPrefix });

  // handle redis connection errors
  redis.on('error', (err) => {
    log.error('Redis connection error:', err);
    log.error('Are you sure you have redis running at your specified endpoint?');
    process.exit(1);
  });

  // create EngineIO for dependency injection
  const io: EngineIO = {
    redis,
    log: console.log,
  };

  // build adapter using registry
  const adapter = buildAdapter(appCfg.adapterConfig.adapterId, appCfg.adapterConfig.params, io);

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
  // console.log('--- Engine Configuration Verification ---');
  // // console.log('App Config:', JSON.stringify(appCfg, null, 2));
  // // console.log('Sink:', sink);
  // // console.log('Adapter:', adapter);
  // // console.log('Processor:', sqdProcessor);
  // // console.log('Redis:', redis);
  // console.log('--- End of Configuration ---');

  const engine = new Engine(deps);
  await engine.run();
}

main();
