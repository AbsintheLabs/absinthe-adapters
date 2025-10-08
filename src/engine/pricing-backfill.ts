// Pricing backfill utilities for batch processing
import { Redis } from 'ioredis';
import { logger } from '../utils/logger.ts';
import { AppConfig, AssetConfig } from '../config/schema.ts';
import { ResolveContext } from '../types/pricing.ts';
import { PricingEngine } from './pricing-engine.ts';
import { RedisTSCache, RedisMetadataCache, RedisHandlerMetadataCache } from '../cache/index.ts';

export interface PricingBackfillDeps {
  redis: Redis;
  appCfg: AppConfig;
  priceCache: RedisTSCache;
  metadataCache: RedisMetadataCache;
  handlerMetadataCache: RedisHandlerMetadataCache;
  pricingEngine: PricingEngine;
  sqdCtx: any;
}

/**
 * Backfill price data for a batch of blocks
 */
// fixme: prevent blocks from being passed in here as a whole, this makes it less scalable and ties us with sqd objects
export async function backfillPriceDataForBatch(
  blocks: any[],
  deps: PricingBackfillDeps,
): Promise<void> {
  logger.debug(`💰 Backfilling price data for batch of ${blocks.length} blocks`);

  // 1) dedupe to the first block per window
  const windowToFirstBlock = new Map<number, any>();
  for (const block of blocks) {
    const flushInterval = deps.appCfg.flushInterval;
    const windowStart = Math.floor(block.header.timestamp / flushInterval) * flushInterval;
    if (!windowToFirstBlock.has(windowStart)) windowToFirstBlock.set(windowStart, block);
  }
  const blocksOfWindowStarts = Array.from(windowToFirstBlock.values());

  // add the last block to the list of blocks of window starts if it's not already in the list.
  const lastBlock = blocks[blocks.length - 1];
  if (!windowToFirstBlock.has(lastBlock.header.timestamp)) {
    blocksOfWindowStarts.push(lastBlock);
  }

  // 2) Get all registered trackable instances from registry set (O(N) vs O(keyspace) scan)
  const trackableInstanceIds = await deps.redis.smembers('pricing:trackables:registry');
  logger.debug(
    `💰 Found ${trackableInstanceIds.length} trackable instances with registered assets`,
  );

  // 3) Collect all (trackableInstance, asset, handler) tuples
  type AssetHandler = { asset: string; handlerId: string; config: AssetConfig };
  const allAssetHandlers: AssetHandler[] = [];

  for (const trackableInstanceId of trackableInstanceIds) {
    const registryKey = `pricing:assets:${trackableInstanceId}`;
    const assetToPricingHandler = await deps.redis.hgetall(registryKey);

    for (const [asset, pricingHandlerId] of Object.entries(assetToPricingHandler)) {
      // Load the pricing config for this handler
      const handlerKey = `pricing:handler:${pricingHandlerId}`;
      const configJson = await deps.redis.get(handlerKey);

      if (!configJson) {
        logger.warn(`💰 No config JSON found for handler ${pricingHandlerId}`);
        continue;
      }

      try {
        const config = JSON.parse(configJson) as AssetConfig;
        allAssetHandlers.push({ asset, handlerId: pricingHandlerId, config });
      } catch (error) {
        logger.error(`Failed to parse pricing config for handler ${pricingHandlerId}:`, error);
      }
    }
  }

  logger.debug(`💰 Collected ${allAssetHandlers.length} asset-handler pairs to backfill`);

  // 4) build tasks (one task per asset per window)
  type Task = {
    block: any;
    ts: number;
    asset: string;
    handlerId: string;
    config: AssetConfig;
  };
  const tasks: Task[] = [];

  for (const block of blocksOfWindowStarts) {
    const ts = block.header.timestamp;
    const height = block.header.height;

    // Check pricing range - skip pricing if before the specified range
    if (deps.appCfg.pricingRange) {
      let shouldPrice = false;

      if (deps.appCfg.pricingRange.type === 'block') {
        shouldPrice = height >= deps.appCfg.pricingRange.fromBlock;
      } else if (deps.appCfg.pricingRange.type === 'timestamp') {
        shouldPrice = ts >= deps.appCfg.pricingRange.fromTimestamp;
      }

      if (!shouldPrice) {
        logger.debug(
          `💰 Skipping pricing for block ${height} (${new Date(ts).toISOString()}) - before pricing range`,
        );
        continue;
      }
    }

    // Price each (asset, handler) pair once per window
    for (const assetHandler of allAssetHandlers) {
      tasks.push({
        block,
        ts,
        asset: assetHandler.asset,
        handlerId: assetHandler.handlerId,
        config: assetHandler.config,
      });
    }
  }

  logger.debug(`💰 Total pricing tasks: ${tasks.length}`);

  // fixme: refactor this with a more scalable solution than a custom worker pool
  // 5) simple worker pool
  const MAX_CONCURRENCY = 100;
  let idx = 0;

  const worker = async () => {
    while (idx < tasks.length) {
      const i = idx++;
      const t = tasks[i];
      try {
        await pricePricingHandler(t.config, t.asset, t.ts, t.block, deps, false);
      } catch (err) {
        logger.error(
          `priceAsset failed for asset ${t.asset} with handler ${t.handlerId} @ ${t.ts}`,
          err,
        );
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, tasks.length) }, worker));
}

/**
 * Price a pricing handler for a specific asset at a specific timestamp
 * This is the core function that prices by handler ID and asset, enabling reuse across trackables
 */
export async function pricePricingHandler(
  // handlerId: string,
  config: AssetConfig,
  asset: string,
  atMs: number,
  // fixme: prevent block from being passed in here as a whole, this makes it less scalable and ties us with sqd objects
  block: any,
  deps: PricingBackfillDeps,
  bypassTopLevelCache: boolean = false,
): Promise<number> {
  const validatedAssetConfig = config;

  const ctx: ResolveContext = {
    priceCache: deps.priceCache,
    metadataCache: deps.metadataCache,
    handlerMetadataCache: deps.handlerMetadataCache,
    redis: deps.redis,
    atMs,
    block,
    asset, // Use the specific asset being priced
    sqdCtx: deps.sqdCtx,
    bucketMs: deps.appCfg.flushInterval,
    sqdRpcCtx: {
      _chain: deps.sqdCtx._chain,
      block: {
        height: block.header.height,
      },
    },
    bypassTopLevelCache,
  };

  if (bypassTopLevelCache) {
    logger.debug('ctx when bypassing top level cache: ', ctx);
  }

  return await deps.pricingEngine.priceAsset(validatedAssetConfig, ctx);
}
