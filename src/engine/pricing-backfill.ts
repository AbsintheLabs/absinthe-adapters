// Pricing backfill utilities for batch processing
import { Redis } from 'ioredis';
import { log } from '../utils/logger.ts';
import { AppConfig } from '../config/schema.ts';
import { ResolveContext, findConfig } from '../types/pricing.ts';
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
export async function backfillPriceDataForBatch(
  blocks: any[],
  deps: PricingBackfillDeps,
): Promise<void> {
  log.debug(`💰 Backfilling price data for batch of ${blocks.length} blocks`);

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

  // 2) collect assets
  const raw = await deps.redis.hgetall('assets:tracked');
  const assets = Object.entries(raw).map(([asset, h]) => ({
    asset,
    birth: Number(h) || 0,
  }));

  log.debug(`💰 Collected ${assets.length} assets to backfill`);
  log.debug(`💰 Assets: ${assets.map((a) => a.asset).join(', ')}`);

  // 3) build tasks
  type Task = { block: any; ts: number; asset: string };
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
        log.debug(
          `💰 Skipping pricing for block ${height} (${new Date(ts).toISOString()}) - before pricing range`,
        );
        continue;
      }
    }

    const eligible = assets.filter((a) => a.birth <= height);
    log.debug(`💰 Eligible assets: ${eligible.length}`);
    log.debug(`💰 assets with birth: ${assets.map((a) => JSON.stringify(a)).join(', ')}`);
    log.debug('height: ', height);
    log.debug('blockstart: ', blocks[0].header.height);
    log.debug('blockend: ', blocks[blocks.length - 1].header.height);
    log.debug('blockofwindowstarts: ', blocksOfWindowStarts.map((b) => b.header.height).join(', '));
    for (const a of eligible) tasks.push({ block, ts, asset: a.asset });
  }

  // 4) simple worker pool
  const MAX_CONCURRENCY = 100;
  let idx = 0;

  const worker = async () => {
    while (idx < tasks.length) {
      const i = idx++;
      const t = tasks[i];
      try {
        await priceAsset(t.asset, t.ts, t.block, deps, false);
      } catch (err) {
        log.error(`priceAsset failed for ${t.asset} @ ${t.ts}`, err);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, tasks.length) }, worker));
}

/**
 * Price a single asset at a specific timestamp
 */
export async function priceAsset(
  asset: string,
  atMs: number,
  block: any,
  deps: PricingBackfillDeps,
  bypassTopLevelCache: boolean = false,
): Promise<number> {
  // Get labels from Redis for rule matching
  const labelsKey = `asset:labels:${asset}`;
  const labels = await deps.redis.hgetall(labelsKey);

  // Use rule-based matching to find the appropriate config for this asset
  const assetConfig = findConfig(deps.appCfg.assetFeedConfig, asset, (assetKey: string) => labels);

  if (!assetConfig) {
    log.error(`💰 No feed config found for asset: ${asset}`);
    return 0;
  }

  const validatedAssetConfig = assetConfig;

  const ctx: ResolveContext = {
    priceCache: deps.priceCache,
    metadataCache: deps.metadataCache,
    handlerMetadataCache: deps.handlerMetadataCache,
    redis: deps.redis,
    atMs,
    block,
    asset,
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
    log.debug('ctx when bypassing top level cache: ', ctx);
  }

  return await deps.pricingEngine.priceAsset(validatedAssetConfig, ctx);
}
