// Pricing backfill utilities for batch processing
import { Redis } from 'ioredis';
import { logger } from '../utils/logger.ts';
import { AppConfig } from '../config/schema.ts';
import { ResolveContext } from '../types/pricing.ts';
import { PricingEngine } from './pricing-engine.ts';
import { RedisTSCache, RedisMetadataCache, RedisHandlerMetadataCache } from '../cache/index.ts';
import { Asset, Feed, getAssetFromKey } from '../types/asset.ts';
import { extractAssetKeyFromPricingKey } from '../utils/pricing-keys.ts';
import Big from 'big.js';

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
 * Retry a pricing call with exponential backoff
 * Blocks until success or max retries exceeded
 */
async function retryPricingCall<T>(
  fn: () => Promise<T>,
  maxRetries: number = 15,
  feedConfig: Feed,
  asset: Asset,
  atMs: number,
): Promise<T> {
  let lastError: Error | unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 60000); // Cap at 60s

      if (attempt < maxRetries) {
        logger.warn(
          `Pricing call failed for asset ${asset.type} with feed ${feedConfig.kind} @ ${new Date(atMs).toISOString()} (attempt ${attempt}/${maxRetries}). Retrying in ${delayMs}ms...`,
          error,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        // Max retries exceeded - throw error with clear message
        const errorMessage = `Pricing API failed after ${maxRetries} retries for asset ${asset.type} with feed config ${JSON.stringify(feedConfig)} @ ${new Date(atMs).toISOString()}. Final error: ${error instanceof Error ? error.message : String(error)}`;
        logger.error(errorMessage, error);
        throw new Error(errorMessage);
      }
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
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
    // Skip invalid pricing keys (undefined, null, empty string)
    if (!pricingKey || typeof pricingKey !== 'string' || pricingKey.trim() === '') {
      logger.warn(`⚠️ Skipping invalid pricing key: ${JSON.stringify(pricingKey)}`);
      continue;
    }

    // Validate pricing key format before processing
    if (!pricingKey.startsWith('pricing:')) {
      logger.warn(
        `⚠️ Skipping pricing key with invalid format (must start with 'pricing:'): ${pricingKey}`,
      );
      continue;
    }

    // Check for corrupted keys containing "undefined" as the asset key
    if (pricingKey.includes(':undefined:')) {
      logger.warn(`⚠️ Skipping corrupted pricing key with undefined asset key: ${pricingKey}`);
      continue;
    }

    try {
      const feedConfigJson = await deps.redis.get(pricingKey);
      if (!feedConfigJson) {
        logger.warn(`⚠️ No feed config JSON found for pricing key: ${pricingKey}`);
        continue;
      }

      const feedConfig = JSON.parse(feedConfigJson) as Feed;
      const assetKey = extractAssetKeyFromPricingKey(pricingKey);

      // Validate assetKey is not empty and not the string "undefined"
      if (!assetKey || assetKey.trim() === '' || assetKey === 'undefined') {
        logger.error(
          `❌ Invalid asset key extracted from pricing key: ${pricingKey} (assetKey: ${assetKey})`,
        );
        continue;
      }

      const asset = getAssetFromKey(assetKey);
      assetsWithFeedConfig.push({ asset, feedConfig });
    } catch (error) {
      logger.error(
        `❌ Error processing pricing key ${pricingKey}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Continue processing other keys instead of crashing
      continue;
    }
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

    // BUGFIX: fromPricing (pricingRange) is currently buggy and not well supported
    // Temporarily disabled until we can properly implement this feature
    // TODO: Re-enable and fix in future iteration
    // Check pricing range - skip pricing if before the specified range
    // if (deps.appCfg.pricingRange) {
    //   let shouldPrice = false;

    //   if (deps.appCfg.pricingRange.type === 'block') {
    //     shouldPrice = height >= deps.appCfg.pricingRange.fromBlock;
    //   } else if (deps.appCfg.pricingRange.type === 'timestamp') {
    //     shouldPrice = ts >= deps.appCfg.pricingRange.fromTimestamp;
    //   }

    //   if (!shouldPrice) {
    //     logger.debug(
    //       `💰 Skipping pricing for block ${height} (${new Date(ts).toISOString()}) - before pricing range`,
    //     );
    //     continue;
    //   }
    // }

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
      // Retry with exponential backoff - blocks until success or max retries exceeded
      await retryPricingCall(
        () => pricePricingHandler(t.feedConfig, t.asset, t.ts, t.block, deps, false),
        15, // max retries
        t.feedConfig,
        t.asset,
        t.ts,
      );
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
): Promise<Big> {
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
