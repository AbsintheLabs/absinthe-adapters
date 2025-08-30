// Main Engine class for processing blockchain data

import { Database, LocalDest } from '@subsquid/file-store';
import Big from 'big.js';
import { createClient, RedisClientType } from 'redis';
import {
  ChainName,
  getChainEnumKey,
  ChainShortName,
  ChainType,
  GatewayUrl,
  AbsintheApiClient,
} from '@absinthe/common';
import dotenv from 'dotenv';
import { log } from '../utils/logger';
import { Sink } from '../types';
import { RedisTSCache, RedisMetadataCache, RedisHandlerMetadataCache } from '../cache';
import { PricingEngine } from './pricing-engine';
import { AppConfig } from '../config/schema';
import { loadConfig } from '../config/load';
import { buildProcessor } from '../eprocessorBuilder';
import { Adapter, LogEmitFunctions, TransactionEmitFunctions } from '../types/adapter';
import {
  IndexerMode,
  BalanceDelta,
  PositionToggle,
  OnChainEvent,
  OnChainTransaction,
} from '../types/core';
import { AssetConfig, ResolveContext } from '../types/pricing';
import {
  EnrichmentContext,
  RawBalanceWindow,
  RawEvent,
  PricedBalanceWindow,
  PricedEvent,
} from '../types/enrichment';
import { toBlock, Block, Log, Transaction } from '../processor';
import {
  buildEvents,
  buildTimeWeightedBalanceEvents,
  enrichBaseEventMetadata,
  enrichWithRunnerInfo,
  pipeline,
  enrichWithCommonBaseEventFields,
  enrichWithPrice,
  cleanupForApi,
  enrichEventsWithGasPricing,
  enrichEventsWithAssetPrice,
  // filterOutZeroValueEvents,
} from '../enrichers';

dotenv.config();

export class Engine {
  protected db: Database<any, any>;
  // fixme: why is adapter typed with !
  protected adapter!: Adapter;
  // State file path for Subsquid processor checkpoint persistence
  // Each containerized indexer instance uses the same local path since they run in isolation
  // The actual file will be 'status.txt' containing block height and hash for crash recovery
  private static readonly STATE_FILE_PATH = './state';

  // private lastUpatedTime =

  // fixme: prepend the redis prefix with a unique id to avoid conflicts if multiple containerized indexers are running and using the same redis instance
  // todo: change number to bigint/something that encodes token info
  protected redis: RedisClientType;
  // Change to Map organized by contract address, similar to UniswapV2 processor
  protected windows: Map<string, RawBalanceWindow[]> = new Map();
  private events: RawEvent[] = [];

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
  private chainConfig: any;

  constructor(
    // keep only run-time knobs that are not part of AppConfig (or read them from appCfg.processor if you prefer)
    adapter: Adapter,
    sink: Sink,
    appCfg: AppConfig,
  ) {
    // 1) Use provided config
    this.appCfg = appCfg; // uses your Zod discriminated union (evm|solana)
    const chainId = appCfg.kind === 'evm' && appCfg.network.chainId;
    const chainKey = getChainEnumKey(chainId as number);
    if (!chainKey) {
      throw new Error(`${chainId} is not a supported chainId.`);
    }
    const chainName = ChainName[chainKey];
    const chainShortName = ChainShortName[chainKey];
    const chainArch = appCfg.kind === 'evm' ? ChainType.EVM : ChainType.SOLANA;
    const gatewayUrl = GatewayUrl[chainKey]; //todo: pass this instead of other

    this.chainConfig = {
      chainArch: chainArch,
      networkId: chainId,
      chainShortName: chainShortName,
      chainName: chainName,
    };

    // 2) Build processor from config with adapter's topic0s
    this.sqdProcessor = buildProcessor(this.appCfg, adapter.topic0s); // picks EVM or Solana branch based on cfg.kind
    this.indexerMode = this.appCfg.kind === 'evm' ? 'evm' : 'solana';

    // 3) State path and DB, namespaced by indexerId to avoid collisions
    // const statePath = `${Engine.STATE_DIR_BASE}/${this.appCfg.indexerId}`;
    const statePath = Engine.STATE_FILE_PATH;
    // don't need tables since we're relying on redis for persistence
    this.db = new Database({ tables: {}, dest: new LocalDest(statePath) });

    // 4) Adapter + feedConfig normalization (lowercase keys)
    const normalizedFeedConfig: Record<string, AssetConfig> = {};
    if (adapter.feedConfig) {
      for (const [asset, cfg] of Object.entries(adapter.feedConfig)) {
        normalizedFeedConfig[asset.toLowerCase()] = cfg;
      }
    }

    // allow overrides from env JSON if provided
    if (this.appCfg.feedConfigJson && this.appCfg.kind === 'evm') {
      const fromEnv = JSON.parse(this.appCfg.feedConfigJson) as Record<string, AssetConfig>;
      for (const [asset, cfg] of Object.entries(fromEnv)) {
        normalizedFeedConfig[asset.toLowerCase()] = cfg;
      }
    }
    this.adapter = { ...adapter, feedConfig: normalizedFeedConfig };

    // 5) Infra
    // fixme: make this more robust (don't depend on the passed in indexer id)
    const redisPrefix = `abs:${this.appCfg.indexerId}:`;
    this.redis = createClient({});
    this.sink = sink;

    // 6) Pricing + caches
    this.pricingEngine = new PricingEngine(this.adapter.customFeeds);
    this.priceCache = new RedisTSCache(this.redis);
    this.metadataCache = new RedisMetadataCache(this.redis);
    this.handlerMetadataCache = new RedisHandlerMetadataCache(this.redis);
  }

  private async init() {
    await this.redis.connect();

    // Add error handling for Redis connection
    this.redis.on('error', (err) => {
      log.error('Redis Client Error:', err);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      log.info('SIGTERM received, closing Redis connection...');
      await this.redis.quit();
      process.exit(0);
    });
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
  async run() {
    // pre-loop initialization
    await this.init();

    // main loop
    this.sqdProcessor.run(this.db, async (ctx: any) => {
      this.ctx = ctx;

      // XXX: this will change when we add solana support (will it always be blocks, logs, transactions?)
      for (const block of ctx.blocks) {
        for (const log of block.logs) {
          await this.ingestLog(block, log);
        }
        // even if no work is done, empty for loop in v8 is very fast
        for (const transaction of block.transactions) {
          // only process successful function calls
          if (transaction.status === 1) {
            await this.ingestTransaction(block, transaction);
          }
        }
      }

      // we only need to get the timestamp at the end of the batch, rather than every single block
      const lastBlock = ctx.blocks[ctx.blocks.length - 1];
      // fixme: ensure that this checks if the toBlock is set.
      await this.flushPeriodic(lastBlock.header.timestamp, lastBlock.header.height);
      await this.backfillPriceDataForBatch(ctx.blocks);
      await this.enrichWindows(ctx);
      await this.enrichEvents(ctx);
      await this.sendDataToSink(ctx);
      this.sqdBatchEnd(ctx);
    });
  }

  async backfillPriceDataForBatch(blocks: any[]) {
    // 1) dedupe to the first block per window
    const windowToFirstBlock = new Map<number, any>();
    for (const block of blocks) {
      const windowStart =
        Math.floor(block.header.timestamp / this.appCfg.flushMs) * this.appCfg.flushMs;
      if (!windowToFirstBlock.has(windowStart)) windowToFirstBlock.set(windowStart, block);
    }
    const blocksOfWindowStarts = Array.from(windowToFirstBlock.values());

    // 2) collect assets
    // fixme: this will need to change in the future based on how we support these multiple assets on diff chains
    const raw = await this.redis.hGetAll('assets:tracked');
    const assets = Object.entries(raw).map(([asset, h]) => ({
      asset,
      birth: Number(h) || 0,
    }));

    // 3) build tasks
    type Task = { block: any; ts: number; asset: string };
    const tasks: Task[] = [];
    for (const block of blocksOfWindowStarts) {
      const ts = block.header.timestamp;
      const eligible = assets.filter((a) => a.birth <= block.header.height);
      for (const a of eligible) tasks.push({ block, ts, asset: a.asset });
    }

    // 4) simple worker pool (no deps)
    const MAX_CONCURRENCY = 8; // tweak based on your IO headroom
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

  async priceAsset(asset: string, atMs: number, block: any): Promise<number> {
    const assetConfig = this.adapter.feedConfig?.[asset];
    // if (!assetConfig) throw new Error(`No feed config found for asset: ${asset}`);
    // xxx: figure out what to do when the asset is not found
    // or do we return price as 0 and then filter out 0 rows during the enrichment step?
    // probably this to start, and then figure out a better system later
    if (!assetConfig) return 0;

    const ctx: ResolveContext = {
      priceCache: this.priceCache,
      metadataCache: this.metadataCache,
      handlerMetadataCache: this.handlerMetadataCache,
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
    };

    return await this.pricingEngine.priceAsset(assetConfig, ctx);
  }

  private async enrichEvents(ctx: any): Promise<PricedEvent[]> {
    if (this.events.length === 0) return [];

    const enrichCtx: EnrichmentContext = {
      priceCache: this.priceCache,
      metadataCache: this.metadataCache,
      handlerMetadataCache: this.handlerMetadataCache,
      redis: this.redis,
      chainConfig: this.chainConfig,
      absintheApiKey: this.appCfg.absintheApiKey,
      indexerId: this.appCfg.indexerId,
    };

    const enrichedEvents = await pipeline<PricedEvent>(
      enrichWithCommonBaseEventFields,
      enrichWithRunnerInfo,
      enrichBaseEventMetadata,
      buildEvents,
      enrichEventsWithAssetPrice,
      enrichEventsWithGasPricing,
      cleanupForApi,
    )(this.events, enrichCtx);

    // Store enriched events for later sending to sink
    this.enrichedEvents = enrichedEvents;
    return enrichedEvents;
  }

  private async enrichWindows(ctx: any): Promise<PricedBalanceWindow[]> {
    const allEnrichedWindows: PricedBalanceWindow[] = [];

    // Process windows for each contract separately, similar to UniswapV2 processor
    for (const [contractAddress, contractWindows] of this.windows.entries()) {
      if (contractWindows.length === 0) continue;

      const enrichCtx: EnrichmentContext = {
        priceCache: this.priceCache,
        metadataCache: this.metadataCache,
        handlerMetadataCache: this.handlerMetadataCache,
        redis: this.redis,
        chainConfig: this.chainConfig,
        absintheApiKey: this.appCfg.absintheApiKey,
        indexerId: this.appCfg.indexerId,
      };

      const enrichedWindows = await pipeline<PricedBalanceWindow>(
        enrichWithCommonBaseEventFields,
        enrichWithRunnerInfo,
        enrichBaseEventMetadata,
        buildTimeWeightedBalanceEvents,
        enrichWithPrice,
        cleanupForApi,
        // filterOutZeroValueEvents,
      )(contractWindows, enrichCtx);

      allEnrichedWindows.push(...enrichedWindows);
    }

    // Store enriched windows for later sending to sink
    this.enrichedWindows = allEnrichedWindows;
    return allEnrichedWindows;
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

  async ingestTransaction(block: Block, transaction: Transaction) {
    const emit: TransactionEmitFunctions = {
      event: (e: OnChainTransaction) =>
        this.applyEvent(
          e,
          transaction,
          {
            ts: block.header.timestamp,
            height: block.header.height,
            txHash: transaction.hash,
            blockHash: block.header.hash,
            gasUsed: transaction.gasUsed,
            gasPrice: transaction.gasPrice,
            from: transaction.from,
            to: transaction.to,
          },
          '',
          // todo: we may need to use the to address from the transaction
        ),
    };
    await this.adapter.onTransaction?.(block, transaction, emit);
  }

  // Subsquid hands logs to this
  async ingestLog(block: Block, log: Log) {
    const emit: LogEmitFunctions = {
      balanceDelta: (e: BalanceDelta) =>
        this.applyBalanceDelta(
          e,
          {
            ts: block.header.timestamp,
            height: block.header.height,
            txHash: log.transactionHash,
          },
          log.address.toLowerCase(),
        ), // Pass contract address from log
      positionToggle: (e: PositionToggle) => {
        /* todo: implement me */
        return Promise.resolve();
      },
      event: (e: OnChainEvent) =>
        // XXX: apply event needs to work for both transaction and for log events
        // XXX: typing needs to be fixed here!!!
        this.applyEvent(
          e,
          log,
          {
            ts: block.header.timestamp,
            height: block.header.height,
            txHash: log.transactionHash,
            blockHash: block.header.hash,
            gasUsed: log.transaction?.gasUsed,
            gasPrice: log.transaction?.gasPrice,
            from: log.transaction?.from,
            to: log.transaction?.to,
          },
          log.address.toLowerCase(),
        ),
    };
    await this.adapter.onLog?.(block, log, emit);
  }

  protected async sqdBatchEnd(ctx: any) {
    // clear windows at the end of the batch - clear each contract's windows
    for (const [contractAddress, contractWindows] of this.windows.entries()) {
      contractWindows.length = 0;
    }
    // clear events at the end of the batch
    this.events.length = 0;
    // clear enriched data at the end of the batch
    this.enrichedEvents.length = 0;
    this.enrichedWindows.length = 0;
    // Force flush to update the processor status for file-based processors.
    ctx.store.setForceFlush(true);
  }

  private async applyEvent(
    e: OnChainTransaction,
    transactionOrLog: Transaction | Log,
    blockData: any,
    contractAddress: string,
  ): Promise<void> {
    // xxx: need to make sure that we do the proper balance tracking in here as we do with balance deltas with redis
    let { user, asset, amount, meta } = e;

    // data cleaning:
    if (this.indexerMode === 'evm') {
      // For transactions, use transaction.from; for logs, use transaction.from from the log's transaction
      const transaction =
        'from' in transactionOrLog ? transactionOrLog : transactionOrLog.transaction;
      user = (user || transaction?.from || '').toLowerCase();
      asset = asset?.toLowerCase();
    }
    const event: RawEvent = {
      user: user || '',
      asset: asset,
      amount: amount?.toString() || '0',
      meta,
      ts: blockData.ts,
      height: blockData.height,
      txHash: blockData.txHash,
      logIndex: 'logIndex' in transactionOrLog ? transactionOrLog.logIndex : undefined,
      blockNumber: blockData.height,
      blockHash: blockData.blockHash,
      contractAddress: contractAddress,
      gasUsed: blockData.gasUsed,
      gasPrice: blockData.gasPrice,
      from: blockData.from,
      to: blockData.to,
    };
    this.events.push(event);

    await this.redis.hSetNX(
      'assets:tracked',
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      blockData.height.toString(),
    );
    if (e.asset) {
      await this.redis.hSetNX('assets:tracked', e.asset.toLowerCase(), blockData.height.toString());
    }
  }

  protected async applyBalanceDelta(
    e: BalanceDelta,
    blockData: any,
    contractAddress: string,
  ): Promise<void> {
    const ts = blockData.ts;
    const height = blockData.height;

    // data cleaning:
    if (this.indexerMode === 'evm') {
      e.user = e.user.toLowerCase();
      e.asset = e.asset.toLowerCase();
    }

    const key = `bal:${e.asset}:${e.user}:${contractAddress}`;

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

    // create a new window
    if (oldAmt.gt(0) && oldTs < ts) {
      const window: RawBalanceWindow = {
        user: e.user.toLowerCase(),
        asset: e.asset,
        contractAddress: contractAddress,
        startTs: oldTs,
        endTs: ts,
        startBlockNumber: oldHeight,
        endBlockNumber: height,
        trigger: 'BALANCE_CHANGE',
        balanceBefore: oldAmt.toString(),
        balanceAfter: newAmt.toString(),
        prevTxHash: prevTxHash,
        txHash: blockData.txHash,
      };

      // Get or create contract-specific windows array, similar to UniswapV2 processor
      if (!this.windows.has(contractAddress)) {
        this.windows.set(contractAddress, []);
      }
      this.windows.get(contractAddress)!.push(window);
    }

    await Promise.all([
      this.redis.hSet(key, {
        amount: newAmt.toString(),
        updatedTs: String(ts),
        updatedHeight: String(height),
        txHash: blockData.txHash,
      }),
      newAmt.gt(0) ? this.redis.sAdd('ab:gt0', key) : this.redis.sRem('ab:gt0', key),
      // this.redis.sAdd('assets:tracked', e.asset.toLowerCase()),
      this.redis.hSetNX('assets:tracked', e.asset.toLowerCase(), height.toString()),
    ]);
  }

  // behavior:
  // If we're backfilling (finalBlock is set and height < finalBlock): skip flushing for speed.
  // When we reach finalBlock: flush everything INCLUDING the last partial window.
  // In live mode (no finalBlock): only flush fully closed windows, never the current one.
  private async flushPeriodic(nowMs: number, height: number) {
    const w = this.appCfg.flushMs;

    // xxx: wire this dynamically from the processor when we pass in env variables via class
    const finalBlock: number | null = toBlock;
    const reachedFinal = finalBlock != null && height === finalBlock;
    const backfilling = finalBlock != null && height < finalBlock;

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

    const activeKeys = await this.redis.sMembers('ab:gt0');
    if (activeKeys.length === 0) return;

    // ---- READ PHASE (auto-pipelined) ----
    const rows = await Promise.all(
      activeKeys.map((k) =>
        this.redis.hmGet(k, ['amount', 'updatedTs', 'updatedHeight', 'txHash']),
      ),
    );

    // ---- WRITE PHASE (collect promises; auto-pipelined non-atomically) ----
    const writePromises: Array<Promise<unknown>> = [];

    rows.forEach((vals, i) => {
      if (!vals) return;
      const [amountStr, updatedTsStr, updatedHeightStr, txHashStr] = vals as [
        string,
        string,
        string,
        string,
      ];

      const amt = new Big(amountStr || '0');
      if (amt.lte(0)) return; // only flush active balances

      const key = activeKeys[i]!;
      const [_, asset, user, contractAddress] = key.split(':'); // 'bal:{asset}:{user}:{contract}'
      const lastUpdatedTs = Number(updatedTsStr || 0);
      const prevTxHash = txHashStr || null;

      if (reachedFinal) {
        // Case 1: final block — emit once from lastUpdatedTs to final block timestamp
        const finalTs = nowMs; // the block timestamp of the final block
        if (lastUpdatedTs < finalTs) {
          const window: RawBalanceWindow = {
            user,
            asset,
            contractAddress: contractAddress,
            startTs: lastUpdatedTs,
            endTs: finalTs,
            startBlockNumber: Number(updatedHeightStr),
            endBlockNumber: height,
            trigger: 'FINAL',
            balance: amt.toString(),
            prevTxHash: prevTxHash,
          };

          // Get or create contract-specific windows array
          if (!this.windows.has(contractAddress)) {
            this.windows.set(contractAddress, []);
          }
          this.windows.get(contractAddress)!.push(window);

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
            contractAddress: contractAddress,
            startTs: lastUpdatedTs,
            endTs: currentWindowStart,
            startBlockNumber: Number(updatedHeightStr),
            endBlockNumber: height,
            trigger: 'EXHAUSTED',
            balance: amt.toString(),
            prevTxHash: prevTxHash,
          };

          // Get or create contract-specific windows array
          if (!this.windows.has(contractAddress)) {
            this.windows.set(contractAddress, []);
          }
          this.windows.get(contractAddress)!.push(window);

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

    if (writePromises.length) {
      await Promise.all(writePromises);
    }
  }
}
