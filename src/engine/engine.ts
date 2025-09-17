// Main Engine class for processing blockchain data

import { Database, LocalDest } from '@subsquid/file-store';
import Big from 'big.js';
import { RedisClientType } from 'redis';
import dotenv from 'dotenv';
import { log } from '../utils/logger';
import { EVM_NULL_ADDRESS } from '../utils/constants';
import { Sink } from '../sinks';
import { RedisTSCache, RedisMetadataCache, RedisHandlerMetadataCache } from '../cache';
import { PricingEngine } from './pricing-engine';
import { AppConfig } from '../config/schema';
import { match } from 'ts-pattern';
import { EmitFunctions, Projector, BalanceDeltaReason } from '../types/adapter';
import { Amount, NormalizedEventContext, PositionUpdate, Swap } from '../types/core';

import {
  IndexerMode,
  BalanceDelta,
  PositionStatusChange,
  MeasureDelta,
  Reprice,
  ActionEvent,
} from '../types/core';
import { ResolveContext, findConfig } from '../types/pricing';
import {
  EnrichmentContext,
  RawBalanceWindow,
  RawAction,
  PricedBalanceWindow,
  PricedEvent,
} from '../types/enrichment';
import { Block, Log, Transaction } from '../eprocessorBuilder';
import {
  // buildActionEvents,
  // buildTimeWeightedBalanceEvents,
  enrichBaseEventMetadata,
  enrichWithRunnerInfo,
  pipeline,
  enrichWithCommonBaseEventFields,
  enrichWindowsWithPrice,
  filterOutZeroValueEvents,
  dedupeActions,
  enrichActionsWithPrice,
} from '../enrichers/index';
import { EngineDeps } from '../main';
import { BuiltAdapter } from '../adapter-core';

dotenv.config();

export class Engine {
  // put near other constants
  private static readonly BAL_SET_KEY = 'balances:gt0';
  private static readonly ACTIVE_SET_KEY = 'activebalances';
  private static readonly INACTIVE_SET_KEY = 'inactivebalances';
  private db: Database<any, any>;
  private adapter: BuiltAdapter;

  // State file path for Subsquid processor checkpoint persistence
  // Each containerized indexer instance uses the same local path since they run in isolation
  // The actual file will be 'status.txt' containing block height and hash for crash recovery
  private static readonly STATE_FILE_PATH = './state';

  // private lastUpatedTime =

  // fixme: prepend the redis prefix with a unique id to avoid conflicts if multiple containerized indexers are running and using the same redis instance
  // todo: change number to bigint/something that encodes token info
  private redis: RedisClientType;
  private windows: RawBalanceWindow[] = [];
  private events: RawAction[] = [];

  // Projectors for custom event processing
  private projectors: Map<string, Projector> = new Map();

  // Enriched data ready to be sent to sink
  private enrichedEvents: PricedEvent[] = [];
  private enrichedWindows: PricedBalanceWindow[] = [];

  // Redis key for storing the last flush boundary (crash-resistant)
  private get lastFlushBoundaryKey(): string {
    return `abs:${this.appCfg.indexerId}:flush:boundary`;
  }
  private sink: Sink;
  private indexerMode: IndexerMode;

  // caches
  private priceCache: RedisTSCache;
  private metadataCache: RedisMetadataCache;
  private handlerMetadataCache: RedisHandlerMetadataCache;
  private pricingEngine: PricingEngine;
  private ctx: any;
  private appCfg: AppConfig;
  private sqdProcessor: any;

  constructor(deps: EngineDeps) {
    // todo: prefix with the indexer hash id to avoid collisions if running multiple instances on the same machine
    const statePath = Engine.STATE_FILE_PATH;
    // don't need tables since we're relying on redis for persistence. This can be hardcoded, this is fine.
    this.db = new Database({ tables: {}, dest: new LocalDest(statePath) });

    // this is kind of an old relic
    this.indexerMode = deps.appCfg.kind === 'evm' ? 'evm' : 'solana';

    // // 4.5) Register projectors
    // if (this.adapter.projectors) {
    //   for (const projector of this.adapter.projectors) {
    //     this.projectors.set(projector.namespace, projector);
    //   }
    // }

    // 5) Infra
    this.redis = deps.redis;
    this.sink = deps.sink;
    this.appCfg = deps.appCfg;
    this.adapter = deps.adapter;
    this.sqdProcessor = deps.sqdProcessor;

    // hack: add transaction: true for each addLog method of the sqdProcessor
    const p = deps.sqdProcessor;
    for (const request of p['requests']) {
      if (request.request.logs) {
        request.request.logs.forEach((log: any) => {
          log.transaction = true;
        });
      }
    }

    log.debug('sqdProcessor: ', p);
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
    const boundary = await this.redis.get(this.lastFlushBoundaryKey);
    return boundary ? Number(boundary) : -1;
  }

  /**
   * Set the last flush boundary in Redis
   */
  private async setLastFlushBoundary(boundary: number): Promise<void> {
    await this.redis.set(this.lastFlushBoundaryKey, boundary.toString());
  }

  // note: we probably want to be able to pass other types of processors in here, not just evm ones, but solana too!
  // can make a builder class for evm + solana that gently wraps over the subsquid methods to make sure that we're exposing the right ones
  // this will likely be a simple wrapper on top of the sqd methods on the sqd processor class
  async run(): Promise<void> {
    // main loop
    // FIXME: add typing in here
    this.sqdProcessor.run(this.db, async (ctx: any) => {
      log.debug(`🏁 START BATCH. Blocks: ${ctx.blocks.length}.`);
      log.debug(`Starting block: ${ctx.blocks[0].header.height}.`);
      log.debug(`Ending block: ${ctx.blocks[ctx.blocks.length - 1].header.height}.`);
      this.ctx = ctx;

      // XXX: this will change when we add solana support (will it always be blocks, logs, transactions?)
      for (const block of ctx.blocks) {
        for (const log of block.logs) {
          await this.ingest(block, log);
        }
        // even if no work is done, empty for loop in v8 is very fast
        for (const transaction of block.transactions) {
          // only process successful function calls
          if (transaction.status === 1) {
            await this.ingest(block, transaction);
          }
        }
      }

      await this.adapter.onBatchEnd?.({
        io: {
          redis: this.redis,
          log: log.debug,
        },
        ctx,
      });
      // we only need to get the timestamp at the end of the batch, rather than every single block
      const lastBlock = ctx.blocks[ctx.blocks.length - 1];
      // fixme: ensure that this checks if the toBlock is set.
      await this.flushPeriodic(lastBlock.header.timestamp, lastBlock.header.height);
      await this.backfillPriceDataForBatch(ctx.blocks);
      await this.enrichWindows(ctx);
      await this.enrichEvents(ctx);
      await this.sendDataToSink(ctx);
      this.sqdBatchEnd(ctx);
      await this.terminateIfNeeded(ctx);
    });
  }

  private async terminateIfNeeded(ctx: any) {
    if (
      this.appCfg.range.toBlock != null &&
      ctx.blocks[ctx.blocks.length - 1].header.height >= this.appCfg.range.toBlock
    ) {
      log.info('🏁 Processing final batch. Flushing sink and exiting...');
      try {
        if (this.sink.flush) await this.sink.flush();
        if (this.sink.close) await this.sink.close();
      } catch (err) {
        log.error('Error while flushing/closing sink before exit', err);
      }
      process.exit(0);
    }
  }

  async backfillPriceDataForBatch(blocks: any[]) {
    log.debug(`💰 Backfilling price data for batch of ${blocks.length} blocks`);
    // 1) dedupe to the first block per window
    const windowToFirstBlock = new Map<number, any>();
    for (const block of blocks) {
      const windowStart =
        Math.floor(block.header.timestamp / this.appCfg.flushMs) * this.appCfg.flushMs;
      if (!windowToFirstBlock.has(windowStart)) windowToFirstBlock.set(windowStart, block);
    }
    const blocksOfWindowStarts = Array.from(windowToFirstBlock.values());
    // add the last block to the list of blocks of window starts if it's not already in the list.
    // this solves a bug where we don't price the last block of the batch.
    const lastBlock = blocks[blocks.length - 1];
    if (!windowToFirstBlock.has(lastBlock.header.timestamp)) {
      blocksOfWindowStarts.push(lastBlock);
    }

    // 2) collect assets
    // fixme: this will need to change in the future based on how we support these multiple assets on diff chains
    const raw = await this.redis.hGetAll('assets:tracked');
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
      if (this.appCfg.pricingRange) {
        let shouldPrice = false;

        if (this.appCfg.pricingRange.type === 'block') {
          shouldPrice = height >= this.appCfg.pricingRange.fromBlock;
        } else if (this.appCfg.pricingRange.type === 'timestamp') {
          shouldPrice = ts >= this.appCfg.pricingRange.fromTimestamp;
        }

        if (!shouldPrice) {
          log.debug(
            `💰 Skipping pricing for block ${height} (${new Date(ts).toISOString()}) - before pricing range`,
          );
          continue;
        }
      }

      // BUG: this is the problematic line that's causing drops in our prices
      const eligible = assets.filter((a) => a.birth <= height);
      log.debug(`💰 Eligible assets: ${eligible.length}`);
      log.debug(`💰 assets with birth: ${assets.map((a) => JSON.stringify(a)).join(', ')}`);
      log.debug('height: ', height);
      log.debug('blockstart: ', blocks[0].header.height);
      log.debug('blockend: ', blocks[blocks.length - 1].header.height);
      log.debug(
        'blockofwindowstarts: ',
        blocksOfWindowStarts.map((b) => b.header.height).join(', '),
      );
      for (const a of eligible) tasks.push({ block, ts, asset: a.asset });
    }

    // 4) simple worker pool (no deps)
    // XXX: move this into the engine variable so that we can easily tweak it later
    const MAX_CONCURRENCY = 100; // tweak based on your IO headroom
    let idx = 0;

    const worker = async () => {
      while (idx < tasks.length) {
        const i = idx++;
        const t = tasks[i];
        try {
          await this.priceAsset(t.asset, t.ts, t.block);
          // If you need to collect results:
          // priceData.push({ block: t.ts, asset: t.asset, price });
        } catch (err) {
          log.error(`priceAsset failed for ${t.asset} @ ${t.ts}`, err);
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, tasks.length) }, worker));
  }

  async priceAsset(
    asset: string,
    atMs: number,
    block: any,
    bypassTopLevelCache: boolean = false,
  ): Promise<number> {
    // Get labels from Redis for rule matching
    const labelsKey = `asset:labels:${asset}`;
    const labels = await this.redis.hGetAll(labelsKey);

    // Use rule-based matching to find the appropriate config for this asset
    const assetConfig = findConfig(
      this.appCfg.assetFeedConfig || [],
      asset,
      (assetKey: string) => labels,
    );

    // xxx: figure out what to do when the asset is not found
    // or do we return price as 0 and then filter out 0 rows during the enrichment step?
    // probably this to start, and then figure out a better system later
    if (!assetConfig) {
      log.error(`💰 No feed config found for asset: ${asset}`);
      return 0;
    }

    const ctx: ResolveContext = {
      priceCache: this.priceCache,
      metadataCache: this.metadataCache,
      handlerMetadataCache: this.handlerMetadataCache,
      redis: this.redis,
      atMs,
      block,
      asset,
      sqdCtx: this.ctx,
      bucketMs: this.appCfg.flushMs,
      sqdRpcCtx: {
        _chain: this.ctx._chain,
        block: {
          height: block.header.height,
        },
      },
      bypassTopLevelCache,
    };

    if (bypassTopLevelCache) {
      log.debug('ctx when bypassing top level cache: ', ctx);
    }

    return await this.pricingEngine.priceAsset(assetConfig, ctx);
  }

  private async enrichEvents(ctx: any): Promise<PricedEvent[]> {
    if (this.events.length === 0) return [];

    const enrichCtx: EnrichmentContext = {
      priceCache: this.priceCache,
      metadataCache: this.metadataCache,
      handlerMetadataCache: this.handlerMetadataCache,
      redis: this.redis,
    };

    const enrichedEvents = await pipeline<PricedEvent>(
      // enrichWithCommonBaseEventFields,
      enrichWithRunnerInfo,
      // enrichBaseEventMetadata,
      // buildActionEvents,
      dedupeActions,
      // enrichActionsWithPrice,
      // filterOutZeroValueEvents,
    )(this.events, enrichCtx);

    // Store enriched events for later sending to sink
    this.enrichedEvents = enrichedEvents;
    return enrichedEvents;
  }

  private async enrichWindows(ctx: any): Promise<PricedBalanceWindow[]> {
    if (this.windows.length === 0) {
      log.debug('⚠️ NO WINDOWS TO ENRICH');
      return [];
    }
    const enrichCtx: EnrichmentContext = {
      priceCache: this.priceCache,
      metadataCache: this.metadataCache,
      handlerMetadataCache: this.handlerMetadataCache,
      redis: this.redis,
    };

    log.debug(`about to enrich windows: ${this.windows.length}`);

    const enrichedWindows = await pipeline<PricedBalanceWindow>(
      // enrichWithCommonBaseEventFields,
      enrichWithRunnerInfo,
      enrichBaseEventMetadata,
      // buildTimeWeightedBalanceEvents,
      // enrichWindowsWithPrice,
      // filterOutZeroValueEvents,
    )(this.windows, enrichCtx);

    log.debug(`enriched windows count: ${enrichedWindows.length}`);

    // Store enriched windows for later sending to sink
    this.enrichedWindows = enrichedWindows;
    return enrichedWindows;
  }

  async sendDataToSink(ctx: any) {
    // Send enriched data to sink with loose coupling
    if (this.enrichedWindows.length > 0) {
      await this.sink.write(this.enrichedWindows);
    }
    if (this.enrichedEvents.length > 0) {
      await this.sink.write(this.enrichedEvents);
    }
  }

  // Subsquid hands logs to this
  async ingest(block: Block, logOrTx: Log | Transaction) {
    const commonEventCtx = match(logOrTx)
      .returnType<NormalizedEventContext>()
      .when(
        (x): x is Log => 'logIndex' in x,
        (log) => ({
          eventType: 'log',
          ts: block.header.timestamp,
          height: block.header.height,
          txHash: log.transactionHash,
          logIndex: log.logIndex,
          block: block,
        }),
      )
      .when(
        (x): x is Transaction => 'hash' in x,
        (tx) => ({
          eventType: 'transaction',
          ts: block.header.timestamp,
          height: block.header.height,
          block: block,
          txHash: tx.hash,
        }),
      )
      .exhaustive();

    // step 1: first define which emit functions are mapped to which internal engine methods
    // fixme: later rename LogEmitFunctions to just EmitFunctions for consistent naming
    // fixme: we are passing in the entire block, but this is unecessary and makes things brittle
    // fixme: need to add logindex to the context so we have deterministic behavior for actions in the same block
    const emit = this.createEmitFunctions(commonEventCtx, logOrTx);

    // step 2: invoke the handler
    await match(logOrTx)
      .when(
        (x): x is Log => 'logIndex' in x,
        async (log) => {
          if (this.adapter.onLog) {
            await this.adapter.onLog({
              block,
              log, // Correctly named for OnLogArgs
              emit,
              rpcCtx: {
                _chain: this.ctx._chain,
                block: { height: block.header.height },
              },
              redis: this.redis,
            });
          }
        },
      )
      .when(
        (x): x is Transaction => 'hash' in x,
        async (tx) => {
          if (this.adapter.onTransaction) {
            await this.adapter.onTransaction({
              block,
              transaction: tx, // Correctly named for OnTransactionArgs
              emit,
              rpcCtx: {
                _chain: this.ctx._chain,
                block: { height: block.header.height },
              },
              redis: this.redis,
            });
          }
        },
      )
      .exhaustive();
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

  private async applyAction(
    e: ActionEvent,
    sqdLogOrTx: Log | Transaction,
    ctx: NormalizedEventContext,
  ): Promise<void> {
    let { key, user, meta, priceable } = e;

    // we have to check if the action is a priceable action or not
    let amount: Amount | null = null;
    if (e.priceable) {
      amount = e.amount;
    }

    // data cleaning:
    if (this.indexerMode === 'evm') {
      user = user.toLowerCase();
      if (amount) {
        amount.asset = amount.asset.toLowerCase();
      }
    }

    if (amount) {
      await this.redis.hSetNX('assets:tracked', amount.asset.toLowerCase(), ctx.height.toString());
    }

    // type narrowing
    const logIndex = 'logIndex' in sqdLogOrTx ? sqdLogOrTx.logIndex : undefined;
    const transaction = (
      'transaction' in sqdLogOrTx ? sqdLogOrTx.transaction : sqdLogOrTx
    ) as Transaction;

    const event: RawAction = {
      // engine stuff
      key: key,
      user: user,
      meta: meta,
      // role: role,
      // asset stuff
      asset: amount?.asset,
      amount: amount?.amount.toString(),
      priceable: priceable,
      // block stuff
      ts: ctx.ts,
      height: ctx.height,
      blockNumber: ctx.height, // fixme: we have a duplicate field for blocknumber (we have one already for height)
      txHash: ctx.txHash,
      blockHash: ctx.block.header.hash, // todo: do we really need this? we can omit to keep the normalized context smaller
      // transaction stuff
      gasUsed: transaction?.gasUsed?.toString(),
      gasPrice: transaction?.gasPrice?.toString(),
      from: transaction?.from,
      to: transaction?.to,
      // log stuff
      ...(logIndex ? { logIndex: logIndex } : {}), // only include logIndex if it exists
    };
    this.events.push(event);
  }

  private async applyBalanceDelta(
    e: BalanceDelta,
    ctx: NormalizedEventContext,
    reason: BalanceDeltaReason = 'BALANCE_DELTA',
  ): Promise<void> {
    const ts = ctx.ts;
    const height = ctx.height;

    // data cleaning:
    // fixme: we should probably do this in the emit functions before we call it in the applyBalanceDelta function
    if (this.indexerMode === 'evm') {
      e.user = e.user.toLowerCase();
      e.asset = e.asset.toLowerCase();
    }

    // Skip balance deltas for null addresses (mints/burns should not be tracked as user balances)
    if (e.user === EVM_NULL_ADDRESS) {
      return;
    }

    const key = `bal:${e.asset}:${e.user}`;

    // Load current state (single HMGET with pipeline if you batch)
    const [amountStr, updatedTsStr, updatedHeightStr, prevTxHashStr] = await this.redis.hmGet(key, [
      'amount',
      'updatedTs',
      'updatedHeight',
      'txHash',
    ]);
    const oldAmt = new Big(amountStr || '0');
    const oldTs = updatedTsStr ? Number(updatedTsStr) : ts;
    const oldHeight = updatedHeightStr ? Number(updatedHeightStr) : height;
    const prevTxHash = prevTxHashStr || null;

    // Apply delta
    const newAmt = oldAmt.plus(e.amount);

    // Check active status at the moment of the delta
    // const isActive = await this.redis.sIsMember(Engine.ACTIVE_SET_KEY, key);
    const isInactive = await this.redis.sIsMember(Engine.INACTIVE_SET_KEY, key);

    // Only emit a window for balance deltas if ACTIVE
    if (!isInactive && oldAmt.gt(0) && oldTs < ts) {
      const window: RawBalanceWindow = {
        user: e.user,
        asset: e.asset,
        startTs: oldTs,
        endTs: ts,
        startHeight: oldHeight,
        endHeight: height,
        trigger: reason,
        rawBefore: oldAmt.toString(),
        rawAfter: newAmt.toString(),
        startTxRef: prevTxHash,
        endTxRef: ctx.txHash,
        activity: e.activity,
        logIndex: ctx.logIndex,
        meta: e.meta,
      };
      this.windows.push(window);
    }

    await Promise.all([
      this.redis.hSet(key, {
        amount: newAmt.toString(),
        updatedTs: String(ts),
        updatedHeight: String(height),
        txHash: ctx.txHash,
      }),
      // Maintain HAS-BALANCE set for scans/flush
      newAmt.gt(0)
        ? this.redis.sAdd(Engine.BAL_SET_KEY, key)
        : this.redis.sRem(Engine.BAL_SET_KEY, key),
      // this.redis.sAdd('assets:tracked', e.asset.toLowerCase()),
      this.redis.hSetNX('assets:tracked', e.asset.toLowerCase(), height.toString()),
    ]);
  }

  // fixme: make this take in normalized position context
  private async applyPositionUpdate(e: PositionUpdate, blockData: any): Promise<void> {
    // Thin wrapper around applyBalanceDelta to follow DRY principle
    // Position updates don't change balance but update metadata/timestamps
    await this.applyBalanceDelta(
      {
        user: e.user,
        asset: e.asset,
        activity: e.activity,
        amount: new Big(0), // No balance change for position updates
        meta: e.meta,
      },
      blockData,
      'POSITION_UPDATE',
    );
  }

  private async applyPositionStatusChange(e: PositionStatusChange, blockData: any): Promise<void> {
    log.debug('applyPositionStatusChange: ', e);
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
    const [amountStr, updatedTsStr, updatedHeightStr, prevTxHashStr] = await this.redis.hmGet(key, [
      'amount',
      'updatedTs',
      'updatedHeight',
      'txHash',
    ]);
    const amt = new Big(amountStr || '0');
    const lastUpdatedTs = updatedTsStr ? Number(updatedTsStr) : ts;
    const lastUpdatedHeight = updatedHeightStr ? Number(updatedHeightStr) : height;
    const prevTxHash = prevTxHashStr || null;

    // If we were tracking this key as active, close the window and drop from set
    // const isActive = await this.redis.sIsMember(Engine.ACTIVE_SET_KEY, key);
    const isInactive = (await this.redis.sIsMember(Engine.INACTIVE_SET_KEY, key)) === 1;

    // isInactive == true and e.active == false means nothing to do
    // isInactive == false and e.active == true means nothing to do
    // isInactive == true and e.active == true means toggle on
    // isInactive == false and e.active == false means toggle off
    const isToggled = isInactive === e.active;
    const shouldToggleOn = isInactive && e.active;
    const shouldToggleOff = !isInactive && !e.active;
    log.debug(
      'applyPositionStatusChange',
      key,
      isInactive,
      e.active,
      shouldToggleOn,
      shouldToggleOff,
    );

    // attempting to toggle off
    if (shouldToggleOff) {
      log.debug('toggle off', key);

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
          trigger: 'INACTIVE_POSITION',
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
        this.windows.push(window);
      }

      // Add to inactive set
      await this.redis.sAdd(Engine.INACTIVE_SET_KEY, key);
      await this.redis.hSet(key, {
        updatedTs: String(ts),
        updatedHeight: String(height),
        txHash: txHash,
      });
      // }
    } else {
      // Toggling ON: start tracking again (no window to emit now)
      if (shouldToggleOn) {
        log.debug('toggle on', key);
        await this.redis.sRem(Engine.INACTIVE_SET_KEY, key);
        await this.redis.hSet(key, {
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
    const [amountStr, updatedTsStr, updatedHeightStr, updatedTxHashStr] = await this.redis.hmGet(
      key,
      ['amount', 'updatedTs', 'updatedHeight', 'updatedTxHash'],
    );

    const oldAmt = new Big(amountStr || '0');
    const newAmt = oldAmt.plus(e.delta);
    const oldTs = updatedTsStr ? Number(updatedTsStr) : ts;
    const oldHeight = updatedHeightStr ? Number(updatedHeightStr) : height;
    const prevTxHash = updatedTxHashStr || null;

    // Store the delta for historical reconstruction
    await this.redis.zAdd(`${key}:d`, {
      score: height,
      value: e.delta.toString(),
    });

    await Promise.all([
      this.redis.hSet(key, {
        amount: newAmt.toString(),
        updatedTs: String(ts),
        updatedHeight: String(height),
      }),
      newAmt.gt(0) ? this.redis.sAdd('meas:active', key) : this.redis.sRem('meas:active', key),
      // Track asset-metric combinations for backfilling
      this.redis.hSetNX('meas:tracked', `${e.asset}:${e.metric}`, height.toString()),
    ]);
  }

  private async applyReprice(e: Reprice, blockData: any): Promise<void> {
    const ts = blockData.ts;
    const height = blockData.height;
    log.debug('applyReprice: ', e.asset, ts, blockData);

    // Check pricing range - skip repricing if before the specified range
    if (this.appCfg.pricingRange) {
      let shouldPrice = false;

      if (this.appCfg.pricingRange.type === 'block') {
        shouldPrice = height >= this.appCfg.pricingRange.fromBlock;
      } else if (this.appCfg.pricingRange.type === 'timestamp') {
        shouldPrice = ts >= this.appCfg.pricingRange.fromTimestamp;
      }

      if (!shouldPrice) {
        log.debug(
          `💰 Skipping repricing for asset ${e.asset} at block ${height} (${new Date(ts).toISOString()}) - before pricing range`,
        );
        return;
      }
    }

    // We want to bypass the top level cache here as we're repricing!
    await this.priceAsset(e.asset, ts, blockData.block, true);
  }

  // behavior:
  // If we're backfilling (finalBlock is set and height < finalBlock): skip flushing for speed.
  // When we reach finalBlock: flush everything INCLUDING the last partial window.
  // In live mode (no finalBlock): only flush fully closed windows, never the current one.
  private async flushPeriodic(nowMs: number, height: number) {
    const w = this.appCfg.flushMs;

    if (this.appCfg.kind !== 'evm') return; // todo: currently only evm is supported
    const finalBlock: number | null = this.appCfg.range.toBlock ?? null;
    const reachedFinal = finalBlock != null && height === finalBlock;
    const backfilling = finalBlock != null && height < finalBlock;

    log.debug('reached final: ', reachedFinal);
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
    const balanceKeys = await this.redis.sDiff([Engine.BAL_SET_KEY, Engine.INACTIVE_SET_KEY]);
    if (balanceKeys.length === 0) {
      log.debug('No balance keys found in flushPeriodic()');
      return;
    }

    // ---- READ PHASE (auto-pipelined) ----
    const rows = await Promise.all(
      balanceKeys.map((k) =>
        this.redis.hmGet(k, ['amount', 'updatedTs', 'updatedHeight', 'txHash']),
      ),
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
        log.debug('amount is less than or equal to 0, skipping for user');
        return; // only flush active balances
      }

      const key = balanceKeys[i]!;
      // Parse the Redis key format: 'bal:{asset}:{user}'
      // The asset can contain colons (e.g., 'erc721:0x...:tokenId'), so we need to extract it properly
      const parts = key.split(':');
      if (parts[0] !== 'bal') {
        log.error(`Invalid Redis key format: ${key}`);
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
            trigger: 'FINAL',
            rawBefore: amt.toString(),
            rawAfter: amt.toString(),
            startTxRef: prevTxHash,
            // xxx: this should probably not be a hold, and instead be whatever the last activity type was?
            activity: 'hold',
          };
          this.windows.push(window);
          writePromises.push(
            this.redis.hSet(key, { updatedTs: String(finalTs), updatedHeight: String(height) }),
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
            trigger: 'EXHAUSTED',
            rawBefore: amt.toString(),
            rawAfter: amt.toString(),
            startTxRef: prevTxHash,
            // fixme: this should probably not be a hold, and instead be whatever the last activity type was?
            activity: 'hold',
          };
          this.windows.push(window);
          // Advance cursor to the start of the current window (we didn't emit the live window)
          writePromises.push(
            this.redis.hSet(key, {
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

  private createEmitFunctions(
    this: Engine,
    ctx: NormalizedEventContext,
    // note: we'll later need to clean this up to work cleanly with solana
    logOrTx: Log | Transaction,
  ): EmitFunctions {
    return {
      balanceDelta: (e: BalanceDelta, reason?: BalanceDeltaReason) =>
        this.applyBalanceDelta(e, ctx, reason),
      positionUpdate: (e: PositionUpdate) => this.applyPositionUpdate(e, ctx),
      reprice: (e: Reprice) => this.applyReprice(e, ctx),
      positionStatusChange: (e: PositionStatusChange) => this.applyPositionStatusChange(e, ctx),
      measureDelta: (e: MeasureDelta) => this.applyMeasureDelta(e, ctx),
      action: (e: ActionEvent) => this.applyAction(e, logOrTx, ctx),
      swap: (e: Swap) => this.applyAction(e, logOrTx, ctx),
      custom: async (namespace: string, type: string, payload: any) => {
        /* dummy fill in for now */
      },
    };
  }
}
