// imports
import dotenv from 'dotenv';
dotenv.config();
// prevent squid from prematurely exiting
process.env.SQUID_PROCESSOR_EXIT_DISABLED = process.env.SQUID_PROCESSOR_EXIT_DISABLED || 'true';
// silence sqd info logs to stderr
process.env.SQD_FATAL = '*';

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
