import { Database, LocalDest } from '@subsquid/file-store';
import Big from 'big.js';
import { createClient, RedisClientType } from 'redis';
import { Sink, CsvSink } from './esink';
import {
  AssetFeedConfig,
  HandlerRegistry,
  RedisTSCache,
  RedisMetadataCache,
  ResolveContext,
  PricingEngine,
  AssetConfig,
} from './eprice';

import dotenv from 'dotenv';
dotenv.config();

type MetadataValue = number | string | boolean;
type BalanceDelta = {
  user: string;
  asset: string;
  amount: Big;
  // only support primitive types for metadata with flat structure
  meta?: Record<string, MetadataValue>;
};

type PositionToggle = {
  // implement me!
};

type OnChainEvent = {
  user: string;
  asset?: string;
  amount: Big;
  meta?: Record<string, MetadataValue>;
};

// Adapter interface (you implement this per protocol)
export interface Adapter {
  onLog(
    block: any,
    log: any,
    emit: {
      balanceDelta: (e: BalanceDelta) => Promise<void>;
      positionToggle: (e: PositionToggle) => Promise<void>;
      event: (e: OnChainEvent) => Promise<void>;
      // fixme: figure out how we can also do event based re-pricing, rather than just pricing on a schedule
      // reprice: (e: RepriceEvent) => Promise<void>;
      // add more here as scope grows
    },
  ): Promise<void>;
  // onTransaction(...)
  // priceFeeds?: FeedSelector[];
  // priceAsset?: (timestampMs: number, asset: string, redis: RedisClientType) => Promise<number>;
  feedConfig: AssetFeedConfig;
}

type IndexerMode = 'evm' | 'solana';

class Engine {
  protected db: Database<any, any>;
  // fixme: why is adapter typed with !
  protected adapter!: Adapter;
  // State file path for Subsquid processor checkpoint persistence
  // Each containerized indexer instance uses the same local path since they run in isolation
  // The actual file will be 'status.txt' containing block height and hash for crash recovery
  protected static readonly STATE_FILE_PATH = './state';

  // private lastUpatedTime =

  // fixme: prepend the redis prefix with a unique id to avoid conflicts if multiple containerized indexers are running and using the same redis instance
  // todo: change number to bigint/something that encodes token info
  protected redis: RedisClientType;
  protected windows: any[] = [];
  // fixme: store this persistently so that we can recover from crashes
  private lastFlushBoundary = -1; // memoizes last time-aligned boundary flushed
  private sink: Sink;
  private indexerMode: IndexerMode;

  // caches
  private priceCache: RedisTSCache;
  private metadataCache: RedisMetadataCache;
  private pricingEngine: PricingEngine;
  private ctx: any;

  constructor(
    protected cfg: { flushMs: number; enablePriceCache: boolean },
    protected sqdProcessor: any,
    adapter: Adapter,
    sink: Sink,
  ) {
    // todo, later have this choose based on the adapter type from config
    this.indexerMode = 'evm';

    this.db = new Database({
      tables: {}, // no data tables at all. We use redis, process memory to keep state.
      dest: new LocalDest(Engine.STATE_FILE_PATH), // where status.txt (or your custom file) lives
    });

    // todo: this could later be done during the adapter environment / init step
    // todo: rather than the engine constructor
    if (this.indexerMode === 'evm') {
      // Create a new feedConfig with lowercased keys
      const normalizedFeedConfig: Record<string, AssetConfig> = {};
      for (const [asset, config] of Object.entries(adapter.feedConfig)) {
        normalizedFeedConfig[asset.toLowerCase()] = config;
      }

      // Create a new adapter with normalized config
      this.adapter = {
        ...adapter,
        feedConfig: normalizedFeedConfig,
      };
    } else {
      this.adapter = adapter;
    }

    this.adapter = adapter;

    // note: redis is always enabled for now
    // todo: add namespace to the keys for redis so there are no collisions?
    this.redis = createClient();

    this.sink = sink;
    this.pricingEngine = new PricingEngine();

    this.priceCache = new RedisTSCache(this.redis);
    this.metadataCache = new RedisMetadataCache(this.redis);
  }

  private async init() {
    await this.redis.connect();

    // Add error handling for Redis connection
    this.redis.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, closing Redis connection...');
      await this.redis.quit();
      process.exit(0);
    });
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
      await this.sendDataToSink(ctx);
      this.sqdBatchEnd(ctx);
    });
  }

  async backfillPriceDataForBatch(blocks: any[]) {
    // 1) dedupe to the first block per window
    const windowToFirstBlock = new Map<number, any>();
    for (const block of blocks) {
      const windowStart = Math.floor(block.header.timestamp / this.cfg.flushMs) * this.cfg.flushMs;
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
          console.error(`priceAsset failed for ${t.asset} @ ${t.ts}`, err);
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
      atMs,
      block,
      asset,
      sqdCtx: this.ctx,
      bucketMs: this.cfg.flushMs,
      sqdRpcCtx: {
        _chain: this.ctx._chain,
        block: {
          height: block.header.height,
        },
      },
    };

    return await this.pricingEngine.priceAsset(assetConfig, ctx);
  }

  async enrichWindows(ctx: any) {
    const enrichCtx: any = {
      priceCache: this.priceCache,
      metadataCache: this.metadataCache,
      redis: this.redis,
    };

    if (this.windows.length > 0) {
      const enrichedWindows = await pipeline(
        enrichWithCommonBaseEventFields,
        enrichWithRunnerInfo,
        buildTimeWeightedBalanceEvents,
        enrichWithPrice,
      )(this.windows, enrichCtx);
      // set the windows to be the enriched windows
      this.windows = enrichedWindows;
    }
  }

  async sendDataToSink(ctx: any) {
    // todo: this needs to be passed in as a parameter in the adapter class or fetched from a factory
    // potentially, you can choose from an enum and then the class will be instantiated based on that from a factory (another class)
    if (this.windows.length > 0) {
      await this.sink.write(this.windows);
    }
  }

  // FIXME: this is a placeholder for now. we need to implement this in the adapter class
  async ingestTransaction(block: any, transaction: any) {
    // await this.adapter.onTransaction(block, transaction, {
    //   event: (e: OnChainEvent) => this.applyEvent(e, {
    //     ts: block.header.timestamp,
    //     height: block.header.height,
    //     txHash: transaction.hash,
    //   }),
    // });
    // todo: implement me
  }

  // Subsquid hands logs to this
  async ingestLog(block: any, log: any) {
    await this.adapter.onLog(block, log, {
      balanceDelta: (e: BalanceDelta) =>
        this.applyBalanceDelta(e, {
          ts: block.header.timestamp,
          height: block.header.height,
          txHash: log.transactionHash,
        }),
      positionToggle: (e: PositionToggle) => {
        /* todo: implement me */
        return Promise.resolve();
      },
      event: (e: OnChainEvent) => Promise.resolve(),
      // event: (e: OnChainEvent) => this.applyEvent(e, {
      // ts: block.header.timestamp,
      // height: block.header.height,
      // txHash: transaction.hash,
      // }),
    });
  }

  protected async sqdBatchEnd(ctx: any) {
    // clear windows at the end of the batch
    this.windows = [];
    // force flush to update the processor status. necessary for file based processor
    ctx.store.setForceFlush(true);
  }

  protected async applyBalanceDelta(e: BalanceDelta, blockData: any): Promise<void> {
    const ts = blockData.ts;
    const height = blockData.height;

    // data cleaning:
    if (this.indexerMode === 'evm') {
      e.user = e.user.toLowerCase();
      e.asset = e.asset.toLowerCase();
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

    // create a new window
    if (oldAmt.gt(0) && oldTs < ts) {
      // todo: add a new window to a list of windows to send to the absinthe api
      this.windows.push({
        user: e.user.toLowerCase(),
        asset: e.asset,
        startTs: oldTs,
        endTs: ts,
        startBlockNumber: oldHeight,
        endBlockNumber: height,
        trigger: 'BALANCE_CHANGE',
        balanceBefore: oldAmt.toString(),
        balanceAfter: newAmt.toString(),
        prevTxHash: prevTxHash,
        txHash: blockData.txHash,
      });
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
    const w = this.cfg.flushMs;

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
      if (currentWindowStart === this.lastFlushBoundary) return;
      this.lastFlushBoundary = currentWindowStart;
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
      const [_, asset, user] = key.split(':'); // 'bal:{asset}:{user}'
      const lastUpdatedTs = Number(updatedTsStr || 0);
      const prevTxHash = txHashStr || null;

      if (reachedFinal) {
        // Case 1: final block — emit once from lastUpdatedTs to final block timestamp
        const finalTs = nowMs; // the block timestamp of the final block
        if (lastUpdatedTs < finalTs) {
          this.windows.push({
            user,
            asset,
            startTs: lastUpdatedTs,
            endTs: finalTs,
            trigger: 'FINAL',
            balance: amt.toString(),
            prevTxHash: prevTxHash,
            startBlockNumber: Number(updatedHeightStr),
          });
          writePromises.push(
            this.redis.hSet(key, { updatedTs: String(finalTs), updatedHeight: String(height) }),
          );
        }
      } else {
        // Case 2: live mode — emit once from lastUpdatedTs to currentWindowStart if lastUpdatedTs is NOT in the current window
        if (lastUpdatedTs < currentWindowStart) {
          this.windows.push({
            user,
            asset,
            startTs: lastUpdatedTs,
            endTs: currentWindowStart,
            trigger: 'EXHAUSTED',
            balance: amt.toString(),
            prevTxHash: prevTxHash,
            startBlockNumber: Number(updatedHeightStr),
          });
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

// ------------------------------------------------------------
// Example adapter (the actual implementation steps)
// ------------------------------------------------------------

// fixme: ensure that all keys are lowercased in the engine (if asset type is of erc20)
const feedCfg: AssetFeedConfig = {
  // erc20 example
  // '0x4200000000000000000000000000000000000006': {
  //   assetType: 'erc20',
  //   priceFeed: {
  //     kind: 'coingecko',
  //     id: 'ethereum',
  //   },
  // },

  /*
  asset

  */
  '0xa18a0fc8bf43a18227742b4bf8f2813b467804c6': {
    assetType: 'erc20',
    priceFeed: {
      // xxx: feedhandler broken since we should be getting the token metadata from the resolver but the address is not being passed in anywhere
      kind: 'ichinav',
      token0: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'bitcoin' } },
      token1: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'bitcoin' } },
    },
  },
  '0x983ef679f2913c0fa447dd7518404b7d07198291': {
    assetType: 'erc20',
    priceFeed: {
      // xxx: feedhandler broken since we should be getting the token metadata from the resolver but the address is not being passed in anywhere
      kind: 'ichinav',
      token0: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'bitcoin' } },
      token1: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'bitcoin' } },
    },
  },
  '0x423fc440a2b61fc1e81ecc406fdf70d36929c680': {
    assetType: 'erc20',
    priceFeed: {
      // xxx: feedhandler broken since we should be getting the token metadata from the resolver but the address is not being passed in anywhere
      kind: 'ichinav',
      token0: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'ethereum' } },
      token1: { assetType: 'erc20', priceFeed: { kind: 'pegged', usdPegValue: 1 } },
    },
  },
  '0xf399dafcb98f958474e736147d9d35b2a3cae3e0': {
    assetType: 'erc20',
    priceFeed: {
      // xxx: feedhandler broken since we should be getting the token metadata from the resolver but the address is not being passed in anywhere
      kind: 'ichinav',
      token0: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'ethereum' } },
      token1: { assetType: 'erc20', priceFeed: { kind: 'pegged', usdPegValue: 1 } },
    },
  },
  // // spl example
  // 'jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v': {
  //   assetType: 'spl',
  //   priceFeed: {
  //     kind: 'coingecko',
  //     id: 'jupiter-staked-sol'
  //   }
  // },
  // // univ2 pool example
  // '0xA43fe16908251ee70EF74718545e4FE6C5cCEc9f': {
  //   assetType: 'erc20',
  //   priceFeed: {
  //     kind: 'univ2nav',
  //     token0: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'pepe' } },
  //     token1: { assetType: 'erc20', priceFeed: { kind: 'pegged', usdPegValue: 1 } }
  //   }
  // },
};

// todo: use builder pattern to only add the gateway, rpc, and logs. transaction should not be modified since we need the txhash

import * as hemiAbi from './abi/hemi';
// pricing strategy could be different between twb and transaction events
// example univ2 lp is diff from volume pricing of swaps
// should this be two separate pricing strategies transactions / twb?
// or any for the 2 types of events: twb and transaction they both intake a pricing function? <-- this seems like the better option
// const sampleAdapter: Adapter = {
//   onLog: async (block, log, emit) => {
//     if (log.topics[0] === hemiAbi.events.Deposit.topic) {
//       const { depositor, token, amount } = hemiAbi.events.Deposit.decode(log);
//       // make sure to await!!
//       await emit.balanceDelta({
//         user: depositor,
//         asset: token,
//         amount: new Big(amount.toString()),
//       });
//     } else if (log.topics[0] === hemiAbi.events.Withdraw.topic) {
//       const { withdrawer, token, amount } = hemiAbi.events.Withdraw.decode(log);
//       // make sure to await!!
//       await emit.balanceDelta({
//         user: withdrawer,
//         asset: token,
//         amount: new Big(amount.toString()).neg(),
//       });
//     }
//   },
//   feedConfig: feedCfg,
// };

import * as ichiAbi from './abi/ichi';
const ichiAdapter: Adapter = {
  onLog: async (block, log, emit) => {
    if (log.topics[0] === ichiAbi.events.Transfer.topic) {
      const { from, to, value } = ichiAbi.events.Transfer.decode(log);
      await emit.balanceDelta({
        // fixme: we should make sure that users for evm logs are always lowercased in the engine
        user: from.toLowerCase(),
        // fixme: we should make sure that assets for evm logs are always lowercased in the engine
        asset: log.address.toLowerCase(),
        amount: new Big(value.toString()).neg(),
      });
      await emit.balanceDelta({
        user: to.toLowerCase(),
        asset: log.address.toLowerCase(),
        amount: new Big(value.toString()),
      });
    }
  },
  feedConfig: feedCfg,
};

// note: both univ2nav and pricefeed should implement cachable (which means that values that have already
// been found should be returned immediately rather than requerying)

// case 1: we need to fetch an underlying price (which we already have that day) which means it will be re-cached
// case 2: we need to fetch the pricing of univ2 nav to price the LP token. We will price the lp token each day as well for simplicity.

// ------------------------------------------------------------
// Final! Running the engine. This is just the driver.
// Will probably load the config from the env anyway so it might even stay the same for all indexers.
// --------------DRIVER CODE--------------
// ------------------------------------------------------------
import { processor, toBlock } from './processor';
import { buildTimeWeightedBalanceEvents, enrichWithRunnerInfo, pipeline } from './enrichers';
import { enrichWithCommonBaseEventFields } from './enrichers';
import { enrichWithPrice } from './enrichers';
import { TransactionReceipt } from '@subsquid/evm-processor/lib/ds-rpc/rpc-data';

const sink = new CsvSink('windows.csv');

// core problem:
/*
- certain tokens that we're tracking (like for balance delta) are not priced by coingecko but a diff strategy
- we can't determine by asset address (since they might both be erc20s)
- dynamic pricing is hard. let's not do that. pass in everything in the config.
*/

// const univ2Adapter: Adapter = {
//   async onLog(block, log, transaction, emit) {
//     if (log.topics[0] === univ2Abi.events.Swap.topic) {
//       const { sender, amount0In, amount1In, amount0Out, amount1Out } = univ2Abi.events.Swap.decode(log);
//       await emit.event({
//         user: transaction.from,
//         meta: {
//           amount0In: amount0In.toString(),
//           amount1In: amount1In.toString(),
//           amount0Out: amount0Out.toString(),
//           amount1Out: amount1Out.toString(),
//           sidePriced: "token0",
//         },
//         asset: log.address,
//         amount: new Big(amount0Out.toString()), // or whichever side we are actually pricing, token0 or token1
//       })
//     }
//   },
//   priceFeeds: [
//     // {
//     //   kind: 'newPricing',
//     //   // can add more config fields here
//     //   handler: async (args) => {
//     //     const { selector, atMs, ctx, resolve } = args;
//     //     // todo: implement me
//     //     return 0;
//     //   }
//     // }
//   ],
//   // todo: this should be passed in by file configuration, NOT through cod
//   // todo: this can even be loaded in by the engine class (or by a loader class that the engine calls)
//   feedConfig: feedCfg,
// }

// todo: add a feature to not actually send data to the api to allow for testing
// todo: what does testing and validation look like before actually hooking it up to the api?
const engine = new Engine(
  // fixme: remove this enable price cache flag since its not being used for anything
  { flushMs: 1000 * 60 * 60 * 48, enablePriceCache: false },
  processor,
  ichiAdapter,
  sink,
);
engine.run();
