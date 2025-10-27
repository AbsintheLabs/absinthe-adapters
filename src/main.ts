// imports
import dotenv from 'dotenv';
dotenv.config();
// prevent squid from prematurely exiting
// process.env.SQUID_PROCESSOR_EXIT_DISABLED = process.env.SQUID_PROCESSOR_EXIT_DISABLED || 'true';
// silence sqd info logs to stderr
process.env.SQD_FATAL = '*';

import { loadConfig } from './config/load.ts';
import { buildBaseSqdProcessor } from './eprocessorBuilder.ts';
import { Sink, SinkFactory, SinkInitMetadata } from './sinks/index.ts';
import { Redis } from 'ioredis';
import { AppConfig } from './config/schema.ts';
import { logger } from './utils/logger.ts';

// New registry imports
import { EngineIO, BuiltAdapter } from './adapter-core.ts';
import {
  buildAdapter,
  getAdapterMeta as getAdapterManifest,
  getManifest as getFullManifest,
} from './adapter-registry.ts';
import { Engine } from './engine/engine.ts';

import { loadAllAdapters } from './adapters/loader.ts';

import { BaseProcessor } from './eprocessorBuilder.ts';
import { md5HashCanonical } from './utils/stable-hash.ts';
import { setRuntime } from './runtime/context.ts';
import { ABSINTHE_VERSION } from './constants.ts';
import os from 'os';
import { clearStateDir, clearRedisNamespace, deriveStateDirFromHash } from './utils/state-reset.ts';
import { getChainShortName } from './utils/chain-utils.ts';
import { parseCliArgs, hasFlag } from './utils/cli-args.ts';
import { loadAllFeeds } from './feeds/loader.ts';
import { GIT_COMMIT_SHA_LONG } from './utils/git.ts';
import { validateConfigAgainstManifest } from './config/validation.ts';

// todo: move this somewhere else with typing definitions
export interface EngineDeps {
  appCfg: AppConfig;
  sink: Sink;
  adapter: BuiltAdapter;
  sqdProcessor: BaseProcessor;
  redis: Redis;
}

async function main() {
  // Parse CLI arguments (skip first two: node and script path)
  const { configPath, flags } = parseCliArgs(process.argv.slice(2));

  // dynamically load and register all adapters
  await loadAllAdapters();

  // dynamically load and register all pricing handlers
  await loadAllFeeds();

  // Check for reset flag
  const reset = hasFlag(flags, '--reset-state');

  // load runtime config (returns both raw and interpolated versions)
  const { raw: rawConfig, interpolated: appCfg } = await loadConfig(configPath);

  // initialize runtime context with config hash and other metadata
  const configHash = md5HashCanonical(appCfg, 8);
  const hostname = os.hostname();
  const apiKey = process.env.ABSINTHE_API_KEY;
  const apiKeyHash = apiKey ? md5HashCanonical(apiKey, 8) : null;
  const commitSha = GIT_COMMIT_SHA_LONG?.slice(0, 8) ?? null;

  if (!commitSha) {
    throw new Error(
      'Commit SHA is not set. Please ensure the build is properly tagged or are running a local build.',
    );
  }

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
  const baseSqdProcessor = buildBaseSqdProcessor(appCfg);

  // create redis connection (ioredis auto-connects)
  // Use the same configHash to prefix Redis
  const keyPrefix = configHash + ':';
  const stateDir = deriveStateDirFromHash(configHash);
  const redis = new Redis(appCfg.redisUrl, { keyPrefix, maxRetriesPerRequest: 5 });

  // handle redis connection errors
  try {
    await redis.ping();
  } catch (err) {
    logger.error('Redis connection error:', err);
    logger.error('Are you sure you have redis running at your specified endpoint?');
    process.exit(1);
  }

  // persist the error handler to not run the indexer with redis failures
  redis.on('error', (err) => {
    logger.error('Something went wrong with the redis connection:', err);
    process.exit(1);
  });

  // handle state reset if requested
  if (reset) {
    logger.warn(
      `[RESET] Clearing state dir "${stateDir}" and Redis keys with prefix "${keyPrefix}"`,
    );
    await clearStateDir(stateDir);
    await clearRedisNamespace(redis, keyPrefix);
    logger.warn('[RESET] Completed');
  }

  // create EngineIO for dependency injection
  const io: EngineIO = {
    redis,
    log: console.log,
  };

  // build adapter
  const adapter = buildAdapter(appCfg.adapterConfig.adapterId, appCfg.adapterConfig.config, io);

  // get adapter meta and set in runtime
  const adapterId = appCfg.adapterConfig.adapterId;
  const manifest = getAdapterManifest(adapterId);
  if (!manifest) {
    throw new Error(`Unknown adapter: ${adapterId}`);
  }

  setRuntime({
    adapterName: manifest.name,
    adapterVersion: manifest.semver,
  });

  // set chain runtime context
  setRuntime({
    chainId: appCfg.network.chainId,
    chainArch: appCfg.chainArch,
    chainShortName: getChainShortName(appCfg.network.chainId),
  });

  // Precompute all trackable instance hashes before starting the engine
  const fullManifest = getFullManifest(adapterId);
  if (!fullManifest) {
    throw new Error(`Unable to load manifest for adapter: ${adapterId}`);
  }

  const validatedInstances = validateConfigAgainstManifest(
    appCfg.adapterConfig.config,
    fullManifest,
  );

  // Build trackable instance metadata for sink registration
  const trackableInstanceMetadata: SinkInitMetadata = {
    trackableInstances: [],
  };

  try {
    for (const [trackableId, instances] of Object.entries(
      validatedInstances as Record<string, any[]>,
    )) {
      instances.forEach((inst, idx) => {
        const key = {
          params: inst.params,
          quantityType: inst.quantityType,
          ...(inst.assetSelectors ? { assetSelectors: inst.assetSelectors } : {}),
        };
        const trackable_instance_id = md5HashCanonical(key, 16);

        trackableInstanceMetadata.trackableInstances.push({
          trackable_instance_id,
          config_hash: configHash,
          full_config: rawConfig,
          adapter_id: adapterId,
          trackable_name: trackableId,
        });

        logger.debug(
          `Trackable instance: ${adapterId}.${trackableId}[${idx}] → ${trackable_instance_id}`,
        );
      });
    }

    if (trackableInstanceMetadata.trackableInstances.length > 0) {
      logger.info(
        `Precomputed ${trackableInstanceMetadata.trackableInstances.length} trackable_instance_id values`,
      );
    } else {
      logger.info('No trackable instances configured');
    }
  } catch (err) {
    logger.error('Failed to precompute trackable instance hashes:', err);
    throw err;
  }

  // Initialize sink(s) with trackable instance metadata
  logger.info('Initializing sink(s)...');
  if (sink.init) {
    await sink.init(trackableInstanceMetadata);
  }
  logger.info('Sink(s) initialized successfully');

  // construct the real sqd processor using the adapter
  const sqdProcessor = adapter.buildSqdProcessor(baseSqdProcessor);
  logger.debug('Successfully built sqdProcessor');
  const deps: EngineDeps = {
    appCfg,
    sink,
    adapter,
    sqdProcessor,
    redis,
  };

  const engine = new Engine(deps);
  logger.debug('Successfully constructed engine');
  await engine.run();
}

await main();
