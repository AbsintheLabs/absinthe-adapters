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
import { buildAdapter, getAdapterMeta } from './adapter-registry.ts';
import { Engine } from './engine/engine.ts';

import { loadAllAdapters } from './adapters/loader.ts';

import { BaseProcessor } from './eprocessorBuilder.ts';
import { md5Hash } from './utils/helper.ts';
import { md5HashCanonical } from './utils/stable-hash.ts';
import { setRuntime } from './runtime/context.ts';
import { ABSINTHE_VERSION } from './version.ts';
import os from 'os';
import { clearStateDir, clearRedisNamespace, deriveStateDirFromHash } from './utils/state-reset.ts';
import { getChainShortName } from './utils/chain-utils.ts';
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

  // check for reset flag
  const reset = process.argv.includes('--reset-state');

  // initialize runtime context with config hash and other metadata
  const configHash = md5HashCanonical(appCfg, 8);
  const hostname = os.hostname();
  const apiKey = process.env.ABSINTHE_API_KEY;
  const apiKeyHash = apiKey ? md5HashCanonical(apiKey, 8) : null;
  const longCommitSha = process.env.COMMIT_SHA;
  const commitSha = longCommitSha ? longCommitSha.slice(0, 8) : null;

  setRuntime({
    version: ABSINTHE_VERSION,
    commitSha,
    apiKeyHash,
    configHash,
    machineHostname: hostname,
  });

  // create sink
  const sink = SinkFactory.create(appCfg.sinkConfig);

  // create base processor
  // note: we're using types from two different processors (processor.ts and from the official sqd lib), so we should fix this later
  const baseSqdProcessor = buildBaseSqdProcessor(appCfg);

  // create redis connection (ioredis auto-connects)
  // Use the same configHash to prefix Redis
  const keyPrefix = configHash.slice(0, 6) + ':';
  const stateDir = deriveStateDirFromHash(configHash);
  const redis = new Redis(appCfg.redisUrl, { keyPrefix });

  // handle redis connection errors
  redis.on('error', (err) => {
    log.error('Redis connection error:', err);
    log.error('Are you sure you have redis running at your specified endpoint?');
    process.exit(1);
  });

  // handle state reset if requested
  if (reset) {
    log.warn(`[RESET] Clearing state dir "${stateDir}" and Redis keys with prefix "${keyPrefix}"`);
    await clearStateDir(stateDir);
    await clearRedisNamespace(redis, keyPrefix);
    log.warn('[RESET] Completed');
  }

  // create EngineIO for dependency injection
  const io: EngineIO = {
    redis,
    log: console.log,
  };

  // first build adapter
  const adapter = buildAdapter(appCfg.adapterConfig.adapterId, appCfg.adapterConfig.params, io);

  // then get it's meta and set in runtime
  const adapterId = appCfg.adapterConfig.adapterId;
  const meta = getAdapterMeta(adapterId);
  if (!meta) {
    throw new Error(`Unknown adapter: ${adapterId}`);
  }
  setRuntime({
    adapterName: meta.name,
    adapterVersion: meta.semver,
  });

  // set chain runtime context
  setRuntime({
    chainId: appCfg.network.chainId,
    chainArch: appCfg.chainArch,
    chainShortName: getChainShortName(appCfg.network.chainId),
  });

  // construct the real processor using the adapter
  const sqdProcessor = adapter.buildProcessor(baseSqdProcessor);
  const deps: EngineDeps = {
    appCfg,
    sink,
    adapter,
    sqdProcessor,
    redis,
  };

  const engine = new Engine(deps);
  await engine.run();
}

main();
