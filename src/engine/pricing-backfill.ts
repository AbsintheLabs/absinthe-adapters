// Pricing backfill utilities for batch processing
import { Redis } from 'ioredis';
import { logger } from '../utils/logger.ts';
import { AppConfig } from '../config/schema.ts';
import { ResolveContext } from '../types/pricing.ts';
import { PricingEngine } from './pricing-engine.ts';
import { RedisTSCache, RedisMetadataCache, RedisHandlerMetadataCache } from '../cache/index.ts';
import { Asset, Feed, getAssetFromKey } from '../types/asset.ts';
import { extractAssetKeyFromPricingKey } from '../utils/pricing-keys.ts';

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
// xxx: prevent blocks from being passed in here as a whole, this makes it less scalable and ties us with sqd objects
export async function backfillPriceDataForBatch(
  blocks: any[], // xxx: better to not pass blocks but instead the heights and timestamps to decouple us from sqd objects
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

  // 2) Get all registered assets and their pricing definitions from the registry set
  const assetKeys = await deps.redis.smembers('pricing:assets:registry');
  logger.debug(`💰 Found ${assetKeys.length} assets with registered pricing definitions`);

  // 3) Collect all (trackableInstance, asset, handler) tuples
  type AssetsWithFeedConfig = { asset: Asset; feedConfig: Feed };
  const assetsWithFeedConfig: AssetsWithFeedConfig[] = [];

  for (const pricingKey of assetKeys) {
    const feedConfigJson = await deps.redis.get(pricingKey);
    if (!feedConfigJson) {
      throw new Error(`No feed config JSON found for pricing key ${pricingKey}`);
    }

    const feedConfig = JSON.parse(feedConfigJson) as Feed;
    const assetKey = extractAssetKeyFromPricingKey(pricingKey);
    const asset = getAssetFromKey(assetKey);
    assetsWithFeedConfig.push({ asset, feedConfig });
  }

  logger.debug(`💰 Collected ${assetsWithFeedConfig.length} assets with feed config to backfill`);

  // 4) build tasks (one task per asset per window)
  type Task = {
    block: any;
    ts: number;
    asset: Asset;
    // handlerId: string;
    feedConfig: Feed;
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
    for (const assetWithFeedConfig of assetsWithFeedConfig) {
      tasks.push({
        block,
        ts,
        asset: assetWithFeedConfig.asset,
        feedConfig: assetWithFeedConfig.feedConfig,
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
        await pricePricingHandler(t.feedConfig, t.asset, t.ts, t.block, deps, false);
      } catch (err) {
        logger.error(
          `priceAsset failed for asset ${t.asset} with feed config ${JSON.stringify(t.feedConfig)} @ ${t.ts}`,
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
  feedConfig: Feed,
  asset: Asset,
  atMs: number,
  // fixme: prevent block from being passed in here as a whole, this makes it less scalable and ties us with sqd objects
  block: any,
  deps: PricingBackfillDeps,
  bypassTopLevelCache: boolean = false,
): Promise<number> {
  const ctx: ResolveContext = {
    priceCache: deps.priceCache,
    metadataCache: deps.metadataCache,
    handlerMetadataCache: deps.handlerMetadataCache,
    redis: deps.redis,
    atMs,
    block,
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

  return await deps.pricingEngine.priceAsset(asset, feedConfig, ctx);
}
