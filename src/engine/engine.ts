// Main Engine class for processing blockchain data

import { Database } from '@subsquid/file-store';
import Big from 'big.js';
import { Redis } from 'ioredis';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.ts';
import { EVM_NULL_ADDRESS } from '../utils/constants.ts';
import { Sink } from '../sinks/index.ts';
import { RedisTSCache, RedisMetadataCache, RedisHandlerMetadataCache } from '../cache/index.ts';
import { PricingEngine } from './pricing-engine.ts';
import { AppConfig } from '../config/schema.ts';
import { WindowReason } from '../types/adapter.ts';
import { ActionEventBase, PositionUpdate, Swap } from '../types/core.ts';
import { createStateDatabase } from './state.ts';
import { backfillPriceDataForBatch, priceAsset } from './pricing-backfill.ts';
import {
  IndexerMode,
  BalanceDelta,
  PositionStatusChange,
  MeasureDelta,
  Reprice,
  ActionEvent,
} from '../types/core.ts';
import { EnrichmentContext, RawBalanceWindow, RawWindow } from '../types/enrichment.ts';
import { ProcessorContext } from '../eprocessorBuilder.ts';
import { EngineDeps } from '../main.ts';
import { BuiltAdapter } from '../adapter-core.ts';
import { windowsPipeline } from '../enrichers/pipelines/windows.ts';
import { runBatch } from '../enrichers/run-batch.ts';
import { transformSqdLogToUnified, transformSqdTransactionToUnified } from '../transforms/evm.ts';
import { getRuntime } from '../runtime/context.ts';
import { ensureTransactionDataForLogs as addTransactionDataForSqdLogs } from './processor-utils.ts';
import { InstanceFrom, TrackableDef } from '../types/manifest.ts';
import { UnifiedBase } from '../types/unified-chain-events.ts';

dotenv.config();

export class Engine {
  // consts
  private static readonly BAL_SET_KEY = 'balances:gt0';
  private static readonly INACTIVE_SET_KEY = 'inactivebalances';
  private static readonly LAST_FLUSH_BOUNDARY_KEY = 'abs:flush:boundary';
  private static readonly BALANCE_FIELDS = {
    AMOUNT: 'amount',
    UPDATED_TS_MS: 'updatedTsMs',
    UPDATED_HEIGHT: 'updatedHeight',
    TX_REF: 'txRef',
    CTX: 'ctx',
  } as const;

  private db: Database<any, any>;
  private adapter: BuiltAdapter;

  // todo: change number to bigint/something that encodes token info
  private redis: Redis;
  // private windows: RawBalanceWindow[] = [];
  private windows: RawWindow[] = [];
  // private events: RawAction[] = [];
  private events: ActionEventBase[] = [];

  // Enriched data ready to be sent to sink
  // XXX: we'll need to fix these typing issues later
  private enrichedEvents: any[] = [];
  private enrichedWindows: any[] = [];

  private sink: Sink;
  private indexerMode: IndexerMode;

  // caches
  private priceCache: RedisTSCache;
  private metadataCache: RedisMetadataCache;
  private handlerMetadataCache: RedisHandlerMetadataCache;
  private pricingEngine: PricingEngine;
  private ctx: ProcessorContext;
  private appCfg: AppConfig;
  // fixme: sqd type magic, not really sure what's happening here, using any for now
  private sqdProcessor: any;

  constructor(deps: EngineDeps) {
    this.db = createStateDatabase();

    // todo: remove: this is an old relic
    this.indexerMode = deps.appCfg.chainArch === 'evm' ? 'evm' : 'solana';

    // 5) Infra
    this.redis = deps.redis;
    this.sink = deps.sink;
    this.appCfg = deps.appCfg;
    this.adapter = deps.adapter;
    this.sqdProcessor = deps.sqdProcessor;

    // Ensure logs have transaction data for gas calculations
    this.sqdProcessor = addTransactionDataForSqdLogs(this.sqdProcessor);

    // 6) Pricing + caches
    this.pricingEngine = new PricingEngine(this.adapter.customFeeds);
    this.priceCache = new RedisTSCache(this.redis);
    this.metadataCache = new RedisMetadataCache(this.redis);
    this.handlerMetadataCache = new RedisHandlerMetadataCache(this.redis);
  }

  /**
   * Get the last flush boundary from Redis
   * Returns -1 if no boundary has been stored yet (first run)
   */
  private async getLastFlushBoundary(): Promise<number> {
    const boundary = await this.redis.get(Engine.LAST_FLUSH_BOUNDARY_KEY);
    return boundary ? Number(boundary) : -1;
  }

  /**
   * Set the last flush boundary in Redis
   */
  private async setLastFlushBoundary(boundary: number): Promise<void> {
    await this.redis.set(Engine.LAST_FLUSH_BOUNDARY_KEY, boundary.toString());
  }

  async run() {
    // main loop
    this.sqdProcessor.run(this.db, async (ctx: ProcessorContext) => {
      logger.debug(`🏁 START BATCH. Blocks: ${ctx.blocks.length}.`);
      logger.debug(`Starting block: ${ctx.blocks[0].header.height}.`);
      logger.debug(`Ending block: ${ctx.blocks[ctx.blocks.length - 1].header.height}.`);
      this.ctx = ctx;

      // xxx: we can extract the run() loop to a factory which will decide whether to use sqd, etc.
      // we'll stub out the data fetching from the actual run loop
      for (const block of ctx.blocks) {
        for (const log of block.logs) {
          const unifiedLog = transformSqdLogToUnified(block, log, getRuntime().chainId);
          await this.adapter.onLog?.({
            emitFns: this.createEmitFunctions(unifiedLog),
            log: unifiedLog,
            sqdRpcCtx: {
              _chain: ctx._chain,
              block: { height: block.header.height },
            },
            redis: this.redis,
          });
        }
        // even if no work is done, empty for loop in v8 is very fast
        for (const transaction of block.transactions) {
          // only process successful function calls
          if (transaction.status === 1) {
            const unifiedTx = transformSqdTransactionToUnified(
              block,
              transaction,
              getRuntime().chainId,
            );
            // await this.ingestEvmTransaction(unifiedTx);
          }
        }
      }

      await this.adapter.onBatchEnd?.({
        io: {
          redis: this.redis,
          log: logger.debug,
        },
        ctx,
      });
      // we only need to get the timestamp at the end of the batch, rather than every single block
      const lastBlock = ctx.blocks[ctx.blocks.length - 1];
      // fixme: ensure that this checks if the toBlock is set.
      await this.flushPeriodic(lastBlock.header.timestamp, lastBlock.header.height);
      await backfillPriceDataForBatch(ctx.blocks, {
        redis: this.redis,
        appCfg: this.appCfg,
        priceCache: this.priceCache,
        metadataCache: this.metadataCache,
        handlerMetadataCache: this.handlerMetadataCache,
        pricingEngine: this.pricingEngine,
        sqdCtx: this.ctx,
      });
      await this.enrichWindows();
      await this.enrichEvents();
      await this.sendDataToSink();
      await this.sqdBatchEnd(ctx);
      await this.terminateIfNeeded(ctx);
    });
  }

  // todo: make sure that this gets replaced with the sqd runner (encapsulate into sqd logic rather than having this part of the engine)
  private async terminateIfNeeded(ctx: any) {
    if (
      this.appCfg.range.toBlock != null &&
      ctx.blocks[ctx.blocks.length - 1].header.height >= this.appCfg.range.toBlock
    ) {
      logger.info('🏁 Processing final batch. Flushing sink and exiting...');
      try {
        if (this.sink.flush) await this.sink.flush();
        if (this.sink.close) await this.sink.close();
      } catch (err) {
        logger.error('Error while flushing/closing sink before exit', err);
      }
      process.exit(0);
    }
  }

  // private async enrichEvents(ctx: any): Promise<PricedEvent[]>
  private async enrichEvents(): Promise<void> {
    if (this.events.length === 0) return;

    const enrichCtx: EnrichmentContext = {
      priceCache: this.priceCache,
      metadataCache: this.metadataCache,
      handlerMetadataCache: this.handlerMetadataCache,
      redis: this.redis,
    };

    // todo: create the actionsPipeline and call it here
    // const enrichedEvents = await runBatch(this.events, actionEven, enrichCtx);
    // this.enrichedEvents = enrichedEvents;
  }

  // private async enrichWindows(ctx: any): Promise<PricedBalanceWindow[]> {
  private async enrichWindows(): Promise<void> {
    if (this.windows.length === 0) {
      logger.debug('⚠️ NO WINDOWS TO ENRICH');
      return;
    }

    const enrichCtx: EnrichmentContext = {
      priceCache: this.priceCache,
      metadataCache: this.metadataCache,
      handlerMetadataCache: this.handlerMetadataCache,
      redis: this.redis,
    };

    logger.debug(`about to enrich windows: ${this.windows.length}`);
    const enrichedWindows = await runBatch(this.windows, windowsPipeline(), enrichCtx);
    this.enrichedWindows = enrichedWindows;
  }

  async sendDataToSink() {
    // Send enriched data to sink with loose coupling
    if (this.enrichedWindows.length > 0) {
      await this.sink.write(this.enrichedWindows);
    }
    if (this.enrichedEvents.length > 0) {
      await this.sink.write(this.enrichedEvents);
    }
  }

  private async sqdBatchEnd(ctx: any) {
    // clear windows at the end of the batch
    this.windows.length = 0;
    // clear events at the end of the batch
    this.events.length = 0;
    // clear enriched data at the end of the batch
    this.enrichedEvents.length = 0;
    this.enrichedWindows.length = 0;
    // Force flush to update the processor status for file-based processors.
    ctx.store.setForceFlush(true);
  }

  private async applyAction(e: ActionEventBase): Promise<void> {
    // todo: move this to a helper function so it can be reused across all handlers that might need to register assets
    const isPriceableInstance = (i: InstanceFrom<TrackableDef>): boolean => i.pricing !== undefined;
    if (isPriceableInstance(e.trackableInstance)) {
      // tbd... registerAssetForPricing()
      // await this.redis.hsetnx('assets:tracked', e.);
      // this was the old implementation here
      // await this.redis.hsetnx('assets:tracked', amount.asset.toLowerCase(), ctx.height.toString());
    }
    this.events.push(e);
  }

  private async applyBalanceDelta<T extends UnifiedBase>(
    e: BalanceDelta,
    d: T,
    ti: InstanceFrom<TrackableDef>,
    // The default behavior is a change in balance.
    reason: WindowReason = 'BALANCE_CHANGED',
  ) {
    // Skip balance deltas for null addresses (mints/burns should not be tracked as user balances)
    // This is a good default
    if (e.user === EVM_NULL_ADDRESS) {
      return;
    }

    const balanceKey = `bal:${e.asset}:${e.user}`;
    const [
      amountStr,
      lastUpdateTsMsStr,
      lastUpdateHeightStr,
      lastUpdateTxRefStr,
      lastUpdateCtxStr,
    ] = await this.redis.hmget(
      balanceKey,
      Engine.BALANCE_FIELDS.AMOUNT,
      Engine.BALANCE_FIELDS.UPDATED_TS_MS, // Last time this balance changed
      Engine.BALANCE_FIELDS.UPDATED_HEIGHT, // Last block/slot where this balance changed
      Engine.BALANCE_FIELDS.TX_REF, // Last transaction that modified this balance
      Engine.BALANCE_FIELDS.CTX, // The on-chain log/tx that modified this balance
    );

    // Parse the stored values, using current event data as defaults for first-time balances
    const previousAmount = new Big(amountStr || '0');
    const previousTsMs = lastUpdateTsMsStr ? Number(lastUpdateTsMsStr) : d.tsMs;
    const previousHeight = lastUpdateHeightStr ? Number(lastUpdateHeightStr) : d.height;
    const previousTxRef = lastUpdateTxRefStr || null;
    const lastUpdateCtx = lastUpdateCtxStr ? JSON.parse(lastUpdateCtxStr) : {};

    // Calculate new balance after applying this delta
    const newAmount = previousAmount.plus(e.amount);

    // Update their balance
    await this.redis.hset(balanceKey, {
      [Engine.BALANCE_FIELDS.AMOUNT]: newAmount.toString(),
      [Engine.BALANCE_FIELDS.UPDATED_TS_MS]: String(d.tsMs),
      [Engine.BALANCE_FIELDS.UPDATED_HEIGHT]: String(d.height),
      [Engine.BALANCE_FIELDS.TX_REF]: d.txRef,
      [Engine.BALANCE_FIELDS.CTX]: JSON.stringify(d),
    });

    // Update balances greater than 0 set
    if (newAmount.gt(0)) {
      await this.redis.sadd(Engine.BAL_SET_KEY, balanceKey);
    } else {
      await this.redis.srem(Engine.BAL_SET_KEY, balanceKey);
    }

    // Track the asset in Redis if this trackable is priceable
    if (ti.pricing !== undefined) {
      await this.redis.hsetnx('assets:tracked', e.asset, d.height.toString());
    }

    // Emit a window if required
    if (newAmount.gt(0) && previousTsMs < d.tsMs) {
      const window: RawWindow = {
        user: e.user,
        asset: e.asset,
        activity: e.activity,
        meta: e.meta,
        startTs: previousTsMs,
        endTs: d.tsMs,
        startHeight: previousHeight,
        endHeight: d.height,
        startValue: previousAmount.toString(),
        endValue: newAmount.toString(),
        startTxRef: previousTxRef,
        endTxRef: d.txRef,
        trigger: reason,
        startContext: lastUpdateCtx,
        endContext: d,
      };
      this.windows.push(window);
    }
  }

  private async applyPositionUpdate(e: PositionUpdate, blockData: any): Promise<void> {
    // // Thin wrapper around applyBalanceDelta to follow DRY principle
    // // Position updates don't change balance but update metadata/timestamps
    // await this.applyBalanceDelta(
    //   {
    //     user: e.user,
    //     asset: e.asset,
    //     activity: e.activity,
    //     amount: new Big(0), // No balance change for position updates
    //     meta: e.meta,
    //   },
    //   blockData,
    //   'POSITION_REVALUED',
    // );
  }

  private async applyPositionStatusChange(e: PositionStatusChange, blockData: any): Promise<void> {
    logger.debug('applyPositionStatusChange: ', e);
    const ts = blockData.ts;
    const height = blockData.height;
    const txHash = blockData.txHash;

    // normalize
    let user = e.user;
    let asset = e.asset;
    if (this.indexerMode === 'evm') {
      user = user.toLowerCase();
      asset = asset.toLowerCase();
    }

    // balance hash for this (asset,user)
    const key = `bal:${asset}:${user}`;

    // fetch current row
    const [amountStr, updatedTsStr, updatedHeightStr, prevTxHashStr] = await this.redis.hmget(
      key,
      'amount',
      'updatedTs',
      'updatedHeight',
      'txHash',
    );
    const amt = new Big(amountStr || '0');
    const lastUpdatedTs = updatedTsStr ? Number(updatedTsStr) : ts;
    const lastUpdatedHeight = updatedHeightStr ? Number(updatedHeightStr) : height;
    const prevTxHash = prevTxHashStr || null;

    // If we were tracking this key as active, close the window and drop from set
    // const isActive = await this.redis.sIsMember(Engine.ACTIVE_SET_KEY, key);
    const isInactive = (await this.redis.sismember(Engine.INACTIVE_SET_KEY, key)) === 1;

    // isInactive == true and e.active == false means nothing to do
    // isInactive == false and e.active == true means nothing to do
    // isInactive == true and e.active == true means toggle on
    // isInactive == false and e.active == false means toggle off
    const isToggled = isInactive === e.active;
    const shouldToggleOn = isInactive && e.active;
    const shouldToggleOff = !isInactive && !e.active;
    logger.debug(
      'applyPositionStatusChange',
      key,
      isInactive,
      e.active,
      shouldToggleOn,
      shouldToggleOff,
    );

    // attempting to toggle off
    if (shouldToggleOff) {
      logger.debug('toggle off', key);

      // Only emit INACTIVE_POSITION window if position was previously active
      // if (!isInactive) {
      // Emit window only if there was time elapsed and a positive balance
      if (amt.gt(0) && lastUpdatedTs < ts) {
        const window: RawBalanceWindow = {
          user,
          asset,
          startTs: lastUpdatedTs,
          endTs: ts,
          startHeight: lastUpdatedHeight,
          endHeight: height,
          trigger: 'POSITION_DEACTIVATED',
          rawBefore: amt.toString(),
          rawAfter: amt.toString(),
          startTxRef: prevTxHash,
          endTxRef: blockData.txHash,
          // activity: e.activity,
          // logIndex: blockData. // fixme!
          // xxx: this should probably not be a hold, but instead we should pass the activity from the 'e' method
          activity: 'hold',
          meta: e.meta,
        };
        // this.windows.push(window);
      }

      // Add to inactive set
      await this.redis.sadd(Engine.INACTIVE_SET_KEY, key);
      await this.redis.hset(key, {
        updatedTs: String(ts),
        updatedHeight: String(height),
        txHash: txHash,
      });
      // }
    } else {
      // Toggling ON: start tracking again (no window to emit now)
      if (shouldToggleOn) {
        logger.debug('toggle on', key);
        await this.redis.srem(Engine.INACTIVE_SET_KEY, key);
        await this.redis.hset(key, {
          updatedTs: String(ts),
          updatedHeight: String(height),
          txHash: txHash,
        });
      }
    }
  }

  private async applyMeasureDelta(e: MeasureDelta, blockData: any): Promise<void> {
    const ts = blockData.ts;
    const height = blockData.height;

    // data cleaning:
    if (this.indexerMode === 'evm') {
      e.asset = e.asset.toLowerCase();
    }

    const key = `meas:${e.asset}:${e.metric}`;

    // Load current state
    // fixme: remove the extra variables that we don't need anymore
    const [amountStr, updatedTsStr, updatedHeightStr, updatedTxHashStr] = await this.redis.hmget(
      key,
      'amount',
      'updatedTs',
      'updatedHeight',
      'updatedTxHash',
    );

    const oldAmt = new Big(amountStr || '0');
    const newAmt = oldAmt.plus(e.delta);
    const oldTs = updatedTsStr ? Number(updatedTsStr) : ts;
    const oldHeight = updatedHeightStr ? Number(updatedHeightStr) : height;
    const prevTxHash = updatedTxHashStr || null;

    // Store the delta for historical reconstruction
    await this.redis.zadd(`${key}:d`, height, e.delta.toString());

    await Promise.all([
      this.redis.hset(key, {
        amount: newAmt.toString(),
        updatedTs: String(ts),
        updatedHeight: String(height),
      }),
      newAmt.gt(0) ? this.redis.sadd('meas:active', key) : this.redis.srem('meas:active', key),
      // Track asset-metric combinations for backfilling
      this.redis.hsetnx('meas:tracked', `${e.asset}:${e.metric}`, height.toString()),
    ]);
  }

  private async applyReprice(e: Reprice, blockData: any): Promise<void> {
    const ts = blockData.ts;
    const height = blockData.height;
    logger.debug('applyReprice: ', e.asset, ts, blockData);

    // Check pricing range - skip repricing if before the specified range
    if (this.appCfg.pricingRange) {
      let shouldPrice = false;

      if (this.appCfg.pricingRange.type === 'block') {
        shouldPrice = height >= this.appCfg.pricingRange.fromBlock;
      } else if (this.appCfg.pricingRange.type === 'timestamp') {
        shouldPrice = ts >= this.appCfg.pricingRange.fromTimestamp;
      }

      if (!shouldPrice) {
        logger.debug(
          `💰 Skipping repricing for asset ${e.asset} at block ${height} (${new Date(ts).toISOString()}) - before pricing range`,
        );
        return;
      }
    }

    // We want to bypass the top level cache here as we're repricing!
    await priceAsset(
      e.asset,
      ts,
      blockData.block,
      {
        redis: this.redis,
        appCfg: this.appCfg,
        priceCache: this.priceCache,
        metadataCache: this.metadataCache,
        handlerMetadataCache: this.handlerMetadataCache,
        pricingEngine: this.pricingEngine,
        sqdCtx: this.ctx,
      },
      true,
    );
  }

  // behavior:
  // If we're backfilling (finalBlock is set and height < finalBlock): skip flushing for speed.
  // When we reach finalBlock: flush everything INCLUDING the last partial window.
  // In live mode (no finalBlock): only flush fully closed windows, never the current one.
  private async flushPeriodic(nowMs: number, height: number) {
    const w = this.appCfg.flushInterval;

    if (this.appCfg.chainArch !== 'evm') return; // todo: currently only evm is supported
    const finalBlock: number | null = this.appCfg.range.toBlock ?? null;
    const reachedFinal = finalBlock != null && height === finalBlock;
    const backfilling = finalBlock != null && height < finalBlock;

    logger.debug('reached final: ', reachedFinal);
    // If still backfilling, skip for speed
    if (backfilling) return;

    // In live mode, only act when we're within a "recent" horizon
    if (!reachedFinal) {
      const recencyMs = 60 * 60 * 1000; // 1h
      if (Date.now() - nowMs > recencyMs) return;
    }

    // Align to window grid; this is the start of the *current* window
    const currentWindowStart = Math.floor(nowMs / w) * w;

    // Avoid duplicate work per boundary in live mode
    // (For final block we allow a last pass even if the boundary repeats)
    if (!reachedFinal) {
      const lastBoundary = await this.getLastFlushBoundary();
      if (currentWindowStart === lastBoundary) return;
      await this.setLastFlushBoundary(currentWindowStart);
    }

    // get keys that are active and greater than 0
    const balanceKeys = await this.redis.sdiff([Engine.BAL_SET_KEY, Engine.INACTIVE_SET_KEY]);
    if (balanceKeys.length === 0) {
      logger.debug('No balance keys found in flushPeriodic()');
      return;
    }

    // ---- READ PHASE (auto-pipelined) ----
    const rows = await Promise.all(
      balanceKeys.map((k) => this.redis.hmget(k, 'amount', 'updatedTs', 'updatedHeight', 'txHash')),
    );

    // ---- WRITE PHASE (collect promises; auto-pipelined non-atomically) ----
    const writePromises: Array<Promise<unknown>> = [];

    // Process each balance key asynchronously
    const processPromises = rows.map(async (vals, i) => {
      if (!vals) return;
      const [amountStr, updatedTsStr, updatedHeightStr, txHashStr] = vals as [
        string,
        string,
        string,
        string,
      ];

      const amt = new Big(amountStr || '0');
      if (amt.lte(0)) {
        logger.debug('amount is less than or equal to 0, skipping for user');
        return; // only flush active balances
      }

      const key = balanceKeys[i];
      // Parse the Redis key format: 'bal:{asset}:{user}'
      // The asset can contain colons (e.g., 'erc721:0x...:tokenId'), so we need to extract it properly
      const parts = key.split(':');
      if (parts[0] !== 'bal') {
        logger.error(`Invalid Redis key format: ${key}`);
        return;
      }

      // The user is always the last part
      const user = parts[parts.length - 1];

      // The asset is everything between 'bal:' and ':{user}'
      // Find the user part and extract everything before it
      const userIndex = key.lastIndexOf(`:${user}`);
      const asset = key.substring(4, userIndex); // Skip 'bal:' prefix
      const lastUpdatedTs = Number(updatedTsStr || 0);
      const prevTxHash = txHashStr || null;

      if (reachedFinal) {
        // Case 1: final block — emit once from lastUpdatedTs to final block timestamp
        const finalTs = nowMs; // the block timestamp of the final block
        if (lastUpdatedTs < finalTs) {
          const window: RawBalanceWindow = {
            user,
            asset,
            startTs: lastUpdatedTs,
            endTs: finalTs,
            startHeight: Number(updatedHeightStr),
            endHeight: height,
            trigger: 'INDEXER_STOPPED',
            rawBefore: amt.toString(),
            rawAfter: amt.toString(),
            startTxRef: prevTxHash,
            // xxx: this should probably not be a hold, and instead be whatever the last activity type was?
            activity: 'hold',
          };
          // this.windows.push(window);
          writePromises.push(
            this.redis.hset(key, { updatedTs: String(finalTs), updatedHeight: String(height) }),
          );
        }
      } else {
        // Case 2: live mode — emit once from lastUpdatedTs to currentWindowStart if lastUpdatedTs is NOT in the current window
        if (lastUpdatedTs < currentWindowStart) {
          const window: RawBalanceWindow = {
            user,
            asset,
            startTs: lastUpdatedTs,
            endTs: currentWindowStart,
            startHeight: Number(updatedHeightStr),
            endHeight: height,
            trigger: 'PERIOD_ELAPSED',
            rawBefore: amt.toString(),
            rawAfter: amt.toString(),
            startTxRef: prevTxHash,
            // fixme: this should probably not be a hold, and instead be whatever the last activity type was?
            activity: 'hold',
          };
          // this.windows.push(window);
          // Advance cursor to the start of the current window (we didn't emit the live window)
          writePromises.push(
            this.redis.hset(key, {
              updatedTs: String(currentWindowStart),
              updatedHeight: String(height),
            }),
          );
        }
        // else: lastUpdatedTs is inside the current window, so skip emitting
      }
    });

    // Wait for all async processing to complete
    await Promise.all(processPromises);

    if (writePromises.length) {
      await Promise.all(writePromises);
    }
  }

  private createEmitFunctions<TData extends UnifiedBase>(d: TData) {
    return {
      action: {
        action: async (e: ActionEvent) => this.applyAction(e),
        swap: async (e: Swap) => this.applyAction(e),
      },
      position: {
        balanceDelta: async (e: BalanceDelta, reason?: WindowReason) => {
          // data cleaning
          if (this.indexerMode === 'evm') {
            e.user = e.user.toLowerCase();
            e.asset = e.asset.toLowerCase();
          }
          await this.applyBalanceDelta(e, d, e.trackableInstance, reason);
        },
        // positionUpdate: (e: PositionUpdate) => this.applyPositionUpdate(e),
        positionUpdate: async (e: PositionUpdate) => {},
        // reprice: (e: Reprice) => this.applyReprice(e),
        reprice: async (e: Reprice) => {},
        // positionStatusChange: (e: PositionStatusChange) => this.applyPositionStatusChange(e),
        positionStatusChange: async (e: PositionStatusChange) => {},
        // measureDelta: (e: MeasureDelta) => this.applyMeasureDelta(e),
        measureDelta: async (e: MeasureDelta) => {},
      },
    };
  }
}
