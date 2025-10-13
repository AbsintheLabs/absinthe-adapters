// Main Engine class for processing blockchain data

import { Database } from '@subsquid/file-store';
import Big from 'big.js';
import { Redis } from 'ioredis';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.ts';
import { EVM_NULL_ADDRESS } from '../utils/constants.ts';
import { Sink } from '../sinks/index.ts';
import {
  RedisTSCache,
  RedisMetadataCache,
  RedisHandlerMetadataCache,
  RedisEoaDetector,
} from '../cache/index.ts';
import { PricingEngine } from './pricing-engine.ts';
import { AppConfig, AssetConfig } from '../config/schema.ts';
import { WindowReason } from '../types/adapter.ts';
import { ActionEventBase, PositionUpdate, Swap } from '../types/core.ts';
import { createStateDatabase } from './state.ts';
import { backfillPriceDataForBatch, pricePricingHandler } from './pricing-backfill.ts';
import {
  IndexerMode,
  BalanceDelta,
  PositionStatusChange,
  MeasureDelta,
  Reprice,
  ActionEvent,
} from '../types/core.ts';
import { EnrichmentContext, RawAction, RawBalanceWindow, RawWindow } from '../types/enrichment.ts';
import { ProcessorContext } from '../eprocessorBuilder.ts';
import { EngineDeps } from '../main.ts';
import { BuiltAdapter } from '../adapter-core.ts';
import { windowsPipeline } from '../enrichers/pipelines/window-pipeline.ts';
import { transformSqdLogToUnified, transformSqdTransactionToUnified } from '../transforms/evm.ts';
import { getRuntime } from '../runtime/context.ts';
import { ensureTransactionDataForLogs as addTransactionDataForSqdLogs } from './processor-utils.ts';
import { InstanceFrom, TrackableDef } from '../types/manifest.ts';
import { UnifiedBase } from '../types/unified-chain-events.ts';
import { actionPipeline } from '../enrichers/pipelines/action-pipeline.ts';
import { generatePricingHandlerId } from '../utils/pricing-handler-id.ts';
import { md5HashCanonical } from '../utils/stable-hash.ts';

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
    ACTIVITY: 'activity',
    META: 'meta',
  } as const;
  private static readonly MEASURE_FIELDS = {
    AMOUNT: 'amount',
    UPDATED_TS_MS: 'updatedTsMs',
    UPDATED_HEIGHT: 'updatedHeight',
    TX_REF: 'txRef',
  } as const;

  private db: Database<any, any>;
  private adapter: BuiltAdapter;

  private redis: Redis;
  private windows: RawWindow[] = [];
  private events: RawAction[] = [];

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
  private eoaDetector: RedisEoaDetector;
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
    this.eoaDetector = new RedisEoaDetector(this.redis, this.appCfg.network.rpcUrl);
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
    // main loop - note: run() never returns, it calls process.exit() internally
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
        // fixme: figure out if we really need ctx to be passed in here like this
        ctx,
      });
      // we only need to get the timestamp at the end of the batch, rather than every single block
      const lastBlock = ctx.blocks[ctx.blocks.length - 1];
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

  /**
   * Check if we've reached the target block and terminate if so.
   * This is called at the end of each batch, after setForceFlush(true) has been set,
   * so SQD will persist state before the next batch starts.
   */
  private async terminateIfNeeded(ctx: any) {
    if (
      this.appCfg.range.toBlock != null &&
      ctx.blocks[ctx.blocks.length - 1].header.height >= this.appCfg.range.toBlock
    ) {
      logger.info('🏁 Reached target block. Flushing sinks and exiting...');
      try {
        if (this.sink.flush) await this.sink.flush();
        if (this.sink.close) await this.sink.close();
        logger.info('✅ All data flushed successfully. Exiting...');
      } catch (err) {
        logger.error('Error while flushing/closing sink before exit', err);
      }
      // Exit immediately - SQD will persist state because setForceFlush was called
      // Commented out because sqd will quit itself, this was cuasing issues when we were doing this prematurely
      // since sqd was not able to save the state to the file in these cases
      // process.exit(0);
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
      eoaDetector: this.eoaDetector,
      appCfg: this.appCfg,
    };

    const pipeline = actionPipeline();
    const enrichedEvents = await pipeline.runBatch(this.events, enrichCtx);
    this.enrichedEvents = enrichedEvents;
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
      eoaDetector: this.eoaDetector,
      appCfg: this.appCfg,
    };

    logger.debug(`about to enrich windows: ${this.windows.length}`);
    const pipeline = windowsPipeline();
    const enrichedWindows = await pipeline.runBatch(this.windows, enrichCtx);
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

  /**
   * Generate a stable ID for a trackable instance based on its configuration.
   * This ID uniquely identifies a pricing strategy scope.
   */
  private generateTrackableInstanceId(ti: InstanceFrom<TrackableDef>): string {
    // Hash the trackable instance's identifying properties
    const key = {
      params: ti.params,
      quantityType: ti.quantityType,
      // Include assetSelectors if present (for swaps)
      ...('assetSelectors' in ti && ti.assetSelectors ? { assetSelectors: ti.assetSelectors } : {}),
    };
    return md5HashCanonical(key, 16);
  }

  /**
   * Register an asset for pricing under a specific trackable instance.
   * This allows multiple assets to share the same pricing strategy.
   */
  private async registerAssetForPricing(
    trackableInstanceId: string,
    asset: string,
    pricingConfig: AssetConfig,
  ): Promise<string> {
    const pricingHandlerId = generatePricingHandlerId(pricingConfig);

    // Store the pricing config (if not already stored)
    const handlerKey = `pricing:handler:${pricingHandlerId}`;
    await this.redis.setnx(handlerKey, JSON.stringify(pricingConfig));
    await this.redis.sadd('pricing:handlers:registry', pricingHandlerId);

    // Register the (trackableInstance, asset) → handler mapping
    const registryKey = `pricing:assets:${trackableInstanceId}`;
    await this.redis.hset(registryKey, asset, pricingHandlerId);

    // Add trackable instance to registry set for efficient lookup (avoids keys() scan)
    await this.redis.sadd('pricing:trackables:registry', trackableInstanceId);

    return pricingHandlerId;
  }

  private async applyAction<T extends UnifiedBase>(e: ActionEvent, d: T): Promise<void> {
    const quantityType = e.trackableInstance.quantityType;

    // const hasAmountField = 'amount' in e && e.amount !== undefined && e.amount !== null;
    // const hasAssetField =
    //   'asset' in e && (e as any).asset !== undefined && (e as any).asset !== null;

    // Validate structure based on quantity type
    // if (quantityType === 'token_based') {
    //   if (!hasAmountField || !hasAssetField) {
    //     throw new Error('token_based action must include both amount and asset');
    //   }
    // } else if (quantityType === 'count') {
    //   if (!hasAmountField) {
    //     throw new Error('count action must include amount');
    //   }
    //   if (hasAssetField) {
    //     throw new Error('count action must not include asset');
    //   }
    // } else if (quantityType === 'none') {
    //   if (hasAmountField || hasAssetField) {
    //     throw new Error('none action must not include amount or asset');
    //   }
    // }

    // Track asset for pricing for token_based actions with pricing configured
    let pricingHandlerId: string | undefined;
    if (
      quantityType === 'token_based' &&
      'asset' in e &&
      e.trackableInstance.pricing !== undefined
    ) {
      const asset = e.asset;

      // Generate a stable trackable instance ID
      const trackableInstanceId = this.generateTrackableInstanceId(e.trackableInstance);

      // Register this specific asset for this trackable instance
      pricingHandlerId = await this.registerAssetForPricing(
        trackableInstanceId,
        asset,
        e.trackableInstance.pricing,
      );
    }

    // Construct RawAction object using explicit quantityType
    const rawAction: RawAction = {
      key: e.key,
      user: e.user,
      quantityType,
      activity: e.activity,
      meta: e.meta,
      ts: d.tsMs,
      height: d.height,
      value:
        quantityType === 'token_based' || quantityType === 'count'
          ? ((e as any).amount.toString?.() ?? (e as any).amount)
          : '0', // Use '0' instead of null for 'none' type
      txRef: d.txRef,
      pricingHandlerId,
      ctx: d,
    };

    if (quantityType === 'token_based') {
      rawAction.asset = (e as any).asset;
    }

    this.events.push(rawAction);
  }

  private async applyBalanceDelta<T extends UnifiedBase>(
    e: BalanceDelta,
    d: T,
    ti: InstanceFrom<TrackableDef>,
    // The default behavior is a change in balance.
    reason: WindowReason,
  ) {
    // Skip balance deltas for null addresses (mints/burns should not be tracked as user balances)
    // This is a good default
    if (e.user === EVM_NULL_ADDRESS) {
      return;
    }

    const balanceKey = `bal:${e.asset}:${e.user}`;

    // Check if position is inactive
    const isInactive = (await this.redis.sismember(Engine.INACTIVE_SET_KEY, balanceKey)) === 1;

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
    const amt = new Big(e.amount.toString());
    const newAmount = previousAmount.plus(amt);

    // ALWAYS update the balance state (even if inactive)
    await this.redis.hset(balanceKey, {
      [Engine.BALANCE_FIELDS.AMOUNT]: newAmount.toString(),
      [Engine.BALANCE_FIELDS.UPDATED_TS_MS]: String(d.tsMs),
      [Engine.BALANCE_FIELDS.UPDATED_HEIGHT]: String(d.height),
      [Engine.BALANCE_FIELDS.TX_REF]: d.txRef,
      [Engine.BALANCE_FIELDS.CTX]: JSON.stringify(d),
      [Engine.BALANCE_FIELDS.ACTIVITY]: e.activity,
      [Engine.BALANCE_FIELDS.META]: JSON.stringify(e.meta || {}),
    });

    // Update balances greater than 0 set
    if (newAmount.gt(0)) {
      await this.redis.sadd(Engine.BAL_SET_KEY, balanceKey);
    } else {
      await this.redis.srem(Engine.BAL_SET_KEY, balanceKey);
    }

    // Track the asset in Redis if this trackable is priceable
    let pricingHandlerId: string | undefined;
    if (ti.pricing !== undefined) {
      const trackableInstanceId = this.generateTrackableInstanceId(ti);
      pricingHandlerId = await this.registerAssetForPricing(
        trackableInstanceId,
        e.asset,
        ti.pricing,
      );
    }

    // ONLY emit window if position is ACTIVE
    if (!isInactive && newAmount.gt(0) && previousTsMs < d.tsMs) {
      if (previousTxRef === null) {
        logger.error(`previousTxRef is null for key: ${balanceKey}`);
        throw new Error(`previousTxRef is null for key: ${balanceKey}`);
      }
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
        pricingHandlerId,
        startContext: lastUpdateCtx,
        endContext: d,
      };
      this.windows.push(window);
    }
  }

  private async applyPositionStatusChange<T extends UnifiedBase>(
    e: PositionStatusChange,
    d: T,
  ): Promise<void> {
    const user = e.user;
    const asset = e.asset;

    const balanceKey = `bal:${asset}:${user}`;

    // Check current inactive status
    const isInactive = (await this.redis.sismember(Engine.INACTIVE_SET_KEY, balanceKey)) === 1;

    // Determine if we need to toggle
    const shouldToggleOff = !isInactive && !e.active;
    const shouldToggleOn = isInactive && e.active;

    // Nothing to do if already in the desired state
    if (!shouldToggleOff && !shouldToggleOn) {
      logger.debug(`Position already in desired state (active=${e.active}): ${balanceKey}`);
      return;
    }

    logger.debug(`Position status change: ${balanceKey}, active=${e.active}`);

    if (shouldToggleOff) {
      // DEACTIVATING: Close any open window, then mark as inactive
      const [
        amountStr,
        lastUpdateTsMsStr,
        lastUpdateHeightStr,
        lastUpdateTxRefStr,
        lastUpdateCtxStr,
      ] = await this.redis.hmget(
        balanceKey,
        Engine.BALANCE_FIELDS.AMOUNT,
        Engine.BALANCE_FIELDS.UPDATED_TS_MS,
        Engine.BALANCE_FIELDS.UPDATED_HEIGHT,
        Engine.BALANCE_FIELDS.TX_REF,
        Engine.BALANCE_FIELDS.CTX,
      );

      const amount = new Big(amountStr || '0');
      const lastUpdateTsMs = lastUpdateTsMsStr ? Number(lastUpdateTsMsStr) : d.tsMs;
      const lastUpdateHeight = lastUpdateHeightStr ? Number(lastUpdateHeightStr) : d.height;
      const prevTxRef = lastUpdateTxRefStr || null;
      const lastUpdateCtx = lastUpdateCtxStr ? JSON.parse(lastUpdateCtxStr) : {};

      // Emit closing window if there's a positive balance and time has elapsed
      if (amount.gt(0) && lastUpdateTsMs < d.tsMs) {
        if (prevTxRef === null) {
          logger.error(`prevTxRef is null for key: ${balanceKey}`);
          throw new Error(`prevTxRef is null for key: ${balanceKey}`);
        }

        const window: RawWindow = {
          user,
          asset,
          activity: 'hold',
          meta: e.meta || {},
          startTs: lastUpdateTsMs,
          endTs: d.tsMs,
          startHeight: lastUpdateHeight,
          endHeight: d.height,
          startValue: amount.toString(),
          endValue: amount.toString(),
          startTxRef: prevTxRef,
          endTxRef: d.txRef,
          trigger: 'POSITION_DEACTIVATED',
          startContext: lastUpdateCtx,
          endContext: d,
        };
        this.windows.push(window);
      }

      // Mark as inactive
      await this.redis.sadd(Engine.INACTIVE_SET_KEY, balanceKey);

      // Update metadata
      await this.redis.hset(balanceKey, {
        [Engine.BALANCE_FIELDS.UPDATED_TS_MS]: String(d.tsMs),
        [Engine.BALANCE_FIELDS.UPDATED_HEIGHT]: String(d.height),
        [Engine.BALANCE_FIELDS.TX_REF]: d.txRef,
        [Engine.BALANCE_FIELDS.CTX]: JSON.stringify(d),
      });
    } else if (shouldToggleOn) {
      // REACTIVATING: Remove from inactive set and update metadata
      // No window is emitted - the next balance change will start a new window
      await this.redis.srem(Engine.INACTIVE_SET_KEY, balanceKey);

      await this.redis.hset(balanceKey, {
        [Engine.BALANCE_FIELDS.UPDATED_TS_MS]: String(d.tsMs),
        [Engine.BALANCE_FIELDS.UPDATED_HEIGHT]: String(d.height),
        [Engine.BALANCE_FIELDS.TX_REF]: d.txRef,
        [Engine.BALANCE_FIELDS.CTX]: JSON.stringify(d),
      });
    }
  }

  private async applyMeasureDelta<T extends UnifiedBase>(e: MeasureDelta, d: T): Promise<void> {
    const measureKey = `meas:${e.asset}:${e.metric}`;

    // Load current state
    const [amountStr] = await this.redis.hmget(measureKey, Engine.MEASURE_FIELDS.AMOUNT);

    const previousAmount = new Big(amountStr || '0');
    const delta = new Big(e.delta.toString());
    const newAmount = previousAmount.plus(delta);

    // Store the delta for historical reconstruction (indexed by height)
    await this.redis.zadd(`${measureKey}:d`, d.height, e.delta.toString());

    // Update measure state
    await this.redis.hset(measureKey, {
      [Engine.MEASURE_FIELDS.AMOUNT]: newAmount.toString(),
      [Engine.MEASURE_FIELDS.UPDATED_TS_MS]: String(d.tsMs),
      [Engine.MEASURE_FIELDS.UPDATED_HEIGHT]: String(d.height),
      [Engine.MEASURE_FIELDS.TX_REF]: d.txRef,
    });

    // Track active measures (amount > 0)
    if (newAmount.gt(0)) {
      await this.redis.sadd('meas:active', measureKey);
    } else {
      await this.redis.srem('meas:active', measureKey);
    }

    // Track asset-metric combinations for backfilling
    await this.redis.hsetnx('meas:tracked', `${e.asset}:${e.metric}`, d.height.toString());
  }

  private async applyReprice<T extends UnifiedBase>(e: Reprice, d: T): Promise<void> {
    const ts = d.tsMs;
    const height = d.height;

    // Only reprice if trackable has pricing configured
    if (!e.trackableInstance.pricing) {
      logger.debug('Reprice called on trackable without pricing config, skipping');
      return;
    }

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
          `💰 Skipping repricing at block ${height} (${new Date(ts).toISOString()}) - before pricing range`,
        );
        return;
      }
    }

    // Get trackable instance ID and all registered assets for this trackable
    const trackableInstanceId = this.generateTrackableInstanceId(e.trackableInstance);
    const registryKey = `pricing:assets:${trackableInstanceId}`;
    const assetToPricingHandler = await this.redis.hgetall(registryKey);

    if (Object.keys(assetToPricingHandler).length === 0) {
      logger.debug(
        `No assets registered for trackable instance ${trackableInstanceId}, skipping reprice`,
      );
      return;
    }

    // Reprice each asset registered for this trackable instance
    for (const [asset, pricingHandlerId] of Object.entries(assetToPricingHandler)) {
      logger.debug(`applyReprice for asset ${asset}: handler ${pricingHandlerId}, ts ${ts}`);

      try {
        await pricePricingHandler(
          // pricingHandlerId,
          e.trackableInstance.pricing,
          asset, // Pass the specific asset
          ts,
          d,
          {
            redis: this.redis,
            appCfg: this.appCfg,
            priceCache: this.priceCache,
            metadataCache: this.metadataCache,
            handlerMetadataCache: this.handlerMetadataCache,
            pricingEngine: this.pricingEngine,
            sqdCtx: this.ctx,
          },
          true, // bypass cache for instant repricing
        );
      } catch (error) {
        logger.error(`Failed to reprice asset ${asset} with handler ${pricingHandlerId}:`, error);
      }
    }
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
      balanceKeys.map((k) =>
        this.redis.hmget(
          k,
          Engine.BALANCE_FIELDS.AMOUNT,
          Engine.BALANCE_FIELDS.UPDATED_TS_MS,
          Engine.BALANCE_FIELDS.UPDATED_HEIGHT,
          Engine.BALANCE_FIELDS.TX_REF,
          Engine.BALANCE_FIELDS.CTX,
          Engine.BALANCE_FIELDS.ACTIVITY,
          Engine.BALANCE_FIELDS.META,
        ),
      ),
    );

    // ---- WRITE PHASE (collect promises; auto-pipelined non-atomically) ----
    const writePromises: Array<Promise<unknown>> = [];

    // Process each balance key asynchronously
    const processPromises = rows.map(async (vals, i) => {
      if (!vals) return;
      const [amountStr, updatedTsMsStr, updatedHeightStr, txRefStr, ctxStr, activityStr, metaStr] =
        vals as [string, string, string, string, string, string, string];

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

      const lastUpdatedTsMs = Number(updatedTsMsStr || 0);
      const lastUpdatedHeight = Number(updatedHeightStr || height);
      const prevTxRef = txRefStr || null;
      const activity = activityStr || 'hold';
      const meta = metaStr ? JSON.parse(metaStr) : {};

      if (prevTxRef === null) {
        logger.error(`prevTxRef is null for key in flushPeriodic: ${key}`);
        throw new Error(`prevTxRef is null for key in flushPeriodic: ${key}`);
      }

      if (reachedFinal) {
        // Case 1: final block — emit once from lastUpdatedTsMs to final block timestamp
        const finalTsMs = nowMs; // the block timestamp of the final block
        if (lastUpdatedTsMs < finalTsMs) {
          const window: RawWindow = {
            user,
            asset,
            activity,
            meta,
            startTs: lastUpdatedTsMs,
            endTs: finalTsMs,
            startHeight: lastUpdatedHeight,
            endHeight: height,
            startValue: amt.toString(),
            endValue: amt.toString(),
            startTxRef: prevTxRef,
            endTxRef: null,
            trigger: 'INDEXER_STOPPED',
          };
          this.windows.push(window);
          writePromises.push(
            this.redis.hset(key, {
              [Engine.BALANCE_FIELDS.UPDATED_TS_MS]: String(finalTsMs),
              [Engine.BALANCE_FIELDS.UPDATED_HEIGHT]: String(height),
            }),
          );
        }
      } else {
        // Case 2: live mode — emit once from lastUpdatedTsMs to currentWindowStart if lastUpdatedTsMs is NOT in the current window
        if (lastUpdatedTsMs < currentWindowStart) {
          const window: RawWindow = {
            user,
            asset,
            activity,
            meta,
            startTs: lastUpdatedTsMs,
            endTs: currentWindowStart,
            startHeight: lastUpdatedHeight,
            endHeight: height,
            startValue: amt.toString(),
            endValue: amt.toString(),
            startTxRef: prevTxRef,
            endTxRef: null,
            trigger: 'PERIOD_ELAPSED',
          };
          this.windows.push(window);
          // Advance cursor to the start of the current window (we didn't emit the live window)
          writePromises.push(
            this.redis.hset(key, {
              [Engine.BALANCE_FIELDS.UPDATED_TS_MS]: String(currentWindowStart),
              [Engine.BALANCE_FIELDS.UPDATED_HEIGHT]: String(height),
            }),
          );
        }
        // else: lastUpdatedTsMs is inside the current window, so skip emitting
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
        action: async (e: ActionEvent) => {
          // data cleaning
          if (this.indexerMode === 'evm') {
            e.user = e.user.toLowerCase();
            if ('asset' in e && e.asset) {
              e.asset = e.asset.toLowerCase();
            }
          }
          await this.applyAction(e, d);
        },
        swap: async (e: Swap) => {
          await this.applyAction(e, d);
        },
      },
      position: {
        balanceDelta: async (e: BalanceDelta, reason: WindowReason = 'BALANCE_CHANGED') => {
          // data cleaning
          if (this.indexerMode === 'evm') {
            e.user = e.user.toLowerCase();
            e.asset = e.asset.toLowerCase();
          }
          await this.applyBalanceDelta(e, d, e.trackableInstance, reason);
        },
        positionUpdate: (e: PositionUpdate) =>
          this.applyBalanceDelta({ ...e, amount: 0n }, d, e.trackableInstance, 'POSITION_REVALUED'),
        reprice: (e: Reprice) => this.applyReprice(e, d),
        positionStatusChange: async (e: PositionStatusChange) => {
          // data cleaning
          if (this.indexerMode === 'evm') {
            e.user = e.user.toLowerCase();
            e.asset = e.asset.toLowerCase();
          }
          await this.applyPositionStatusChange(e, d);
        },
        measureDelta: async (e: MeasureDelta) => {
          // data cleaning
          if (this.indexerMode === 'evm') {
            e.asset = e.asset.toLowerCase();
          }
          await this.applyMeasureDelta(e, d);
        },
      },
    };
  }
}
