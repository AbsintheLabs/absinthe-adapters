import { Database, LocalDest } from '@subsquid/file-store';
import Big from 'big.js';
// fixme: we should move to the original redis package (docs say that's the better one)
import Redis from 'ioredis';
import fs from 'fs';
import { format } from '@fast-csv/format';
import axios from 'axios';

// SINK INTERFACES
// One interface all sinks implement
export interface Sink {
  init?(): Promise<void>;
  write(batch: unknown[]): Promise<void>; // or writeOne(e: unknown)
  flush?(): Promise<void>;
  close?(): Promise<void>;
}

// Factory input selected at engine construction
export type SinkConfig =
  | { kind: 'csv'; path: string }
  | { kind: 'absinthe'; url: string; apiKey?: string; rateLimit?: number; batchSize?: number };

export class SinkFactory {
  static create(cfg: SinkConfig): Sink {
    switch (cfg.kind) {
      case 'csv':
        return new CsvSink(cfg.path);
      case 'absinthe':
        throw new Error('Absinthe sink not implemented yet');
      default:
        throw new Error(`Unknown sink kind: ${(cfg as any).kind}`);
    }
  }
}

// CSV SINK IMPLEMENTATION
class CsvSink implements Sink {
  private stream = format({ headers: true });
  private out: fs.WriteStream;

  constructor(private path: string) {
    this.out = fs.createWriteStream(path, { flags: 'a' });
    this.stream.pipe(this.out);
  }

  private flattenObject(obj: any, prefix = ''): Record<string, any> {
    const flattened: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (value === null || value === undefined) {
        flattened[newKey] = '';
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else if (Array.isArray(value)) {
        flattened[newKey] = JSON.stringify(value);
      } else {
        flattened[newKey] = value;
      }
    }
    return flattened;
  }

  async write(batch: any[]) {
    const flattenedBatch = batch.map((row) => this.flattenObject(row));
    for (const row of flattenedBatch) {
      this.stream.write(row);
    }
  }
}
// END SINK STUFF

// PRICE INTERFACES
// Feed-agnostic asset key from your system
type AssetKey = string; // e.g., EVM address lowercased or "chain:addr"

// Deterministic implementer-supplied mapping
type FeedSelector =
  | { kind: 'coingecko'; id: string } // e.g., "ethereum"
  | { kind: 'pegged'; usdPegValue: number };
// | { kind: 'coingeckoToken'; platformId: string; address: string } // /simple/token_price/{platform}
// | { kind: 'defillama'; chain: string; address: string } // "ethereum:0x..."
// | { kind: 'coinpaprika'; id: string }               // e.g., "btc-bitcoin"
// | { kind: 'coincodex'; symbol: string };            // if you add CoinCodex

type AssetFeedConfig = Record<AssetKey, FeedSelector>;

export interface PriceFeedable {
  priceUSD(asset: AssetKey, atMs: number): Promise<number>;
}

/* behavior:
1. set a price (from somewhere) into the timeseries
2. fetch a price from the timeseries (while accounting for null buckets etc)
*/
abstract class PriceCache {
  constructor(
    protected redis: Redis,
    protected providerName: string,
    protected windowMs = 86_400_000, // 24 h
  ) {}

  // ---------- public API ----------
  async setPrice(asset: AssetKey, atMs: number, price: number): Promise<void> {
    const bucket = this.bucketStart(atMs);
    const key = this.seriesKey(asset);

    // create series once with DUPLICATE_POLICY LAST
    await this.ensureSeries(key, asset);

    // idempotent add/overwrite
    await this.redis.call('TS.ADD', [key, String(bucket), String(price), 'ON_DUPLICATE', 'LAST']);
  }

  async getPrice(asset: AssetKey, atMs: number): Promise<number | null> {
    const bucket = this.bucketStart(atMs);
    const key = this.seriesKey(asset);

    // try exact bucket
    const exact = (await this.redis.call('TS.RANGE', [
      key,
      String(bucket),
      String(bucket),
    ])) as any[];

    if (exact.length) return parseFloat(exact[0][1]);

    // fallback – latest sample not after requested bucket
    const prev = (await this.redis.call('TS.REVRANGE', [
      key,
      '0',
      String(bucket),
      'COUNT',
      '1',
    ])) as any[];

    return prev.length ? parseFloat(prev[0][1]) : null;
  }

  // ---------- helpers ----------
  private bucketStart(ts: number): number {
    return Math.floor(ts / this.windowMs) * this.windowMs;
  }

  private seriesKey(asset: string): string {
    return `price:${asset.toLowerCase()}`;
  }

  private async ensureSeries(key: string, asset: string) {
    try {
      await this.redis.call('TS.CREATE', [
        key,
        'DUPLICATE_POLICY',
        'LAST',
        'LABELS',
        'provider',
        this.providerName,
        'asset',
        asset,
      ]);
    } catch (e: any) {
      // ignore "key exists" error
      if (!String(e?.message).includes('key already exists')) throw e;
    }
  }
}

class CoinGeckoFeed extends PriceCache {
  constructor(
    private cfg: AssetFeedConfig,
    redis: Redis,
    private apiKey?: string,
  ) {
    super(redis, 'coingecko');
  }

  async priceUSD(asset: AssetKey, atMs: number): Promise<number> {
    const sel = this.cfg[asset];
    if (!sel) throw new Error(`No feed mapping for ${asset}`);

    if (sel.kind === 'coingecko') {
      return this.fetchHistoricalPrice(sel.id, atMs);
    }

    throw new Error(`Unsupported selector for CoinGecko: ${JSON.stringify(sel)}`);
  }

  private async fetchHistoricalPrice(id: string, tsMs: number): Promise<number> {
    try {
      const d = new Date(tsMs);
      const date = `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1)
        .toString()
        .padStart(2, '0')}-${d.getFullYear()}`;

      const url = `https://pro-api.coingecko.com/api/v3/coins/${id}/history`;
      const headers = {
        accept: 'application/json',
        ...(this.apiKey && { 'x-cg-pro-api-key': this.apiKey }),
      };

      const r = await axios.get(url, {
        params: { date, localization: 'false' },
        headers,
      });

      if (!r.data?.market_data?.current_price?.usd) {
        console.warn(`No market data found for ${id} on ${date}`);
        return 0;
      }
      return r.data.market_data.current_price.usd;
    } catch (error) {
      console.warn(`Failed to fetch historical USD price for ${id}:`, error);
      return 0;
    }
  }
}

// END PRICE INTERFACES

// Engine contracts
type BalanceDelta = {
  user: string;
  asset: string;
  amount: Big;
  // fixme: we should adapt this to follow the name, value, type format that we expect. aka; disallow nested objects, it should be flat by intention
  meta?: Record<string, unknown>;
};

type PositionToggle = {
  // implement me!
};

// Adapter interface (you implement this per protocol)
export interface TwbAdapter {
  onEvent(
    block: any,
    log: any,
    emit: {
      balanceDelta: (e: BalanceDelta) => Promise<void>;
      positionToggle: (e: PositionToggle) => Promise<void>;
      // add more here as scope grows
    },
  ): Promise<void>;
  priceAsset: (timestampMs: number, asset: string) => Promise<number>;
  // priceAsset?: (
  //   input: { atMs: number; asset: any },
  //   providers: {
  //     usdPrimitive: (
  //       atHourMs: number,
  //       reqs: Array<{ key: string; coingeckoId?: string; address?: string; chain?: string }>,
  //     ) => Promise<Record<string, number>>;
  //   },
  // ) => Promise<number>;
}

type Price = {
  value: number;
  atMs: number;
  source: 'coingecko' | 'uniV3' | 'nav' | 'offchain' | 'defillama' | 'codex';
};

export interface PriceStore {
  get(asset: string, bucketMs: number, atMs: number): Promise<Price | null>;
  put(asset: string, bucketMs: number, atMs: number, price: Price): Promise<void>;
}

export interface PriceProvider {
  // Called only when cache miss; you implement the method (Chainlink, UniV3 TWAP, NAV math, etc.)
  compute(asset: string, atMs: number, ctx: { block: any }): Promise<Price>;
}

class PriceService {
  constructor(
    private store: PriceStore,
    private provider: PriceProvider,
    private priceResolutionMs: number, // e.g., 3_600_000 for hourly, 86_400_000 for daily
  ) {}

  async getOrCompute(asset: string, atMs: number, ctx: { block: any }): Promise<Price> {
    const bucket = Math.floor(atMs / this.priceResolutionMs) * this.priceResolutionMs;
    const cached = await this.store.get(asset, this.priceResolutionMs, bucket);
    if (cached) return cached;

    // Only compute once per bucket across concurrent workers (use Redis SETNX)
    const price = await this.provider.compute(asset, bucket, ctx);
    await this.store.put(asset, this.priceResolutionMs, bucket, price);
    return price;
  }
}

class TwbEngine {
  protected db: Database<any, any>;
  protected adapter!: TwbAdapter;
  // State file path for Subsquid processor checkpoint persistence
  // Each containerized indexer instance uses the same local path since they run in isolation
  // The actual file will be 'status.txt' containing block height and hash for crash recovery
  protected static readonly STATE_FILE_PATH = './state';

  // private lastUpatedTime =

  // fixme: prepend the redis prefix with a unique id to avoid conflicts if multiple containerized indexers are running and using the same redis instance
  // todo: change number to bigint/something that encodes token info
  protected redis: Redis;
  protected windows: any[] = [];
  // fixme: store this persistently so that we can recover from crashes
  private lastFlushBoundary = -1; // memoizes last time-aligned boundary flushed
  private sink: Sink;

  constructor(
    protected cfg: { flushMs: number; enablePriceCache: boolean },
    protected sqdProcessor: any,
    adapter: TwbAdapter,
    sink: Sink,
  ) {
    this.db = new Database({
      tables: {}, // no data tables at all. We use redis, process memory to keep state. Absn api is the final sink.
      dest: new LocalDest(TwbEngine.STATE_FILE_PATH), // where status.txt (or your custom file) lives
    });

    this.adapter = adapter;
    // note: redis is always enabled for now
    // todo: add namespace to the keys for redis so there are no collisions?
    this.redis = new Redis();
    this.sink = sink;
  }

  // note: we probably want to be able to pass other types of processors in here, not just evm ones, but solana too!
  // can make a builder class for evm + solana that gently wraps over the subsquid methods to make sure that we're exposing the right ones
  // this will likely be a simple wrapper on top of the sqd methods on the sqd processor class
  async run() {
    this.sqdProcessor.run(this.db, async (ctx: any) => {
      for (const block of ctx.blocks) {
        for (const log of block.logs) {
          await this.ingestLog(block, log);
        }

        // fixme: ensure that this checks if the toBlock is set.
        // question: why is this not after the block range?
      }
      // we only need to get the timestamp at the end of the batch, rather than every single block
      const lastBlock = ctx.blocks[ctx.blocks.length - 1];
      await this.flushPeriodic(lastBlock.header.timestamp, lastBlock.header.height);
      await this.backfillPriceDataForBatch(ctx.blocks);
      await this.enrichWindows(ctx);
      await this.sendDataToSink(ctx);
      this.sqdBatchEnd(ctx);
    });
  }

  async backfillPriceDataForBatch(blocks: any[]) {
    // 1. Get the first blocks of every window duration (ex: 1hr or 1day)
    const windowToFirstBlock = new Map<number, any>();

    for (const block of blocks) {
      const windowStart = Math.floor(block.header.timestamp / this.cfg.flushMs) * this.cfg.flushMs;

      // Only keep the first block we see for each window
      if (!windowToFirstBlock.has(windowStart)) {
        windowToFirstBlock.set(windowStart, block);
      }
    }

    const blocksOfWindowStarts = Array.from(windowToFirstBlock.values());

    // 2. Get all assets that we need to price
    // fixme: this will need to change in the future based on how we support these multiple assets
    const assets = await this.redis.smembers('assets:tracked');
    // attempt to create timeseries for each of these assets
    // for (const asset of assets) {
    //   await this.redis.call('TS.CREATE', [`price:${asset}`, 'LABELS', 'asset', asset]);
    //   // fixme: need to create a rule for each of the assets so that twa happens automatically and quickly
    // }

    // 3. for each of these blocks, promise.all the price data by invoking the priceAsset function
    const allPricePromises = blocksOfWindowStarts.flatMap((block) =>
      assets.map(async (asset) => {
        const price = await this.adapter.priceAsset(block.header.timestamp, asset);
        return {
          block: block.header.timestamp,
          asset,
          price,
        };
      }),
    );

    const priceData = await Promise.all(allPricePromises);

    // 4. store the price data in the price store
    for (const price of priceData) {
      // pricing with hashes
      // await this.redis.hset(`price:${price.asset}:${price.block}`, 'price', price.price.toString());
      // todo: change this to use the official redis package and the @redis/time-series package
      await this.redis.call('TS.ADD', [
        `price:${price.asset}`,
        String(price.block),
        String(price.price),
        'ON_DUPLICATE',
        'LAST',
      ]);
    }
  }

  async enrichWindows(ctx: any) {
    if (this.windows.length > 0) {
      const enrichedWindows = await pipeline(
        enrichWithCommonBaseEventFields,
        enrichWithRunnerInfo,
        buildTimeWeightedBalanceEvents,
        enrichWithPrice,
      )(this.windows, this.redis);
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

  // Subsquid hands logs to this
  async ingestLog(block: any, log: any) {
    await this.adapter.onEvent(block, log, {
      balanceDelta: (e: BalanceDelta) =>
        this.applyBalanceDelta(e, {
          ts: block.header.timestamp,
          height: block.header.height,
          txHash: log.transactionHash,
        }),
      positionToggle: async (e: PositionToggle) => {
        /* todo: implement me */
      },
      // todo: invoke the pricing function on the balances here
    });
  }

  protected async sqdBatchEnd(ctx: any) {
    this.windows = [];
    ctx.store.setForceFlush(true);
  }

  protected async applyBalanceDelta(e: BalanceDelta, blockData: any): Promise<void> {
    const ts = blockData.ts;
    const height = blockData.height;
    // const key = `account:${e.user}`;
    const key = `bal:${e.asset}:${e.user}`;

    // Load current state (single HMGET with pipeline if you batch)
    const [amountStr, updatedTsStr, updatedHeightStr] = await this.redis.hmget(
      key,
      'amount',
      'updatedTs',
      'updatedHeight',
    );
    const oldAmt = new Big(amountStr || '0');
    const oldTs = updatedTsStr ? Number(updatedTsStr) : ts;
    const oldHeight = updatedHeightStr ? Number(updatedHeightStr) : height;

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
        txHash: blockData.txHash,
      });
    }

    // Persist
    const multi = this.redis.multi();
    multi.hset(key, {
      amount: newAmt.toString(),
      updatedTs: ts.toString(),
      updatedHeight: height.toString(),
    });
    // this is an optimization to track balances that are gt 0
    if (newAmt.gt(0)) {
      multi.sadd('ab:gt0', key); // track as active balance
      multi.sadd('assets:tracked', e.asset.toLowerCase()); // Track unique assets
    } else {
      multi.srem('ab:gt0', key); // not active anymore
    }

    await multi.exec();
  }

  // behavior:
  // If we're backfilling (finalBlock is set and height < finalBlock): skip flushing for speed.
  // When we reach finalBlock: flush everything INCLUDING the last partial window.
  // In live mode (no finalBlock): only flush fully closed windows, never the current one.
  private async flushPeriodic(nowMs: number, height: number) {
    const w = this.cfg.flushMs;

    // TODO: wire this dynamically from the processor
    const finalBlock: number | null = 1619450;
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

    const activeKeys = await this.redis.smembers('ab:gt0');
    if (activeKeys.length === 0) return;

    // Bulk read state
    const read = this.redis.pipeline();
    for (const k of activeKeys) read.hmget(k, 'amount', 'updatedTs', 'updatedHeight');
    const rows = await read.exec();

    const writes = this.redis.pipeline();

    rows?.forEach(([, vals], i) => {
      if (!vals) return;
      const [amountStr, updatedTsStr, updatedHeightStr] = vals as [string, string, string];

      const amt = new Big(amountStr || '0');
      if (amt.lte(0)) return; // only flush active balances

      const key = activeKeys[i]!;
      const [_, asset, user] = key.split(':'); // 'bal:{asset}:{user}'
      const lastUpdatedTs = Number(updatedTsStr || 0);

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
          });
          writes.hset(key, { updatedTs: String(finalTs), updatedHeight: String(height) });
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
          });
          // Advance cursor to the start of the current window (we didn't emit the live window)
          writes.hset(key, {
            updatedTs: String(currentWindowStart),
            updatedHeight: String(height),
          });
        }
        // else: lastUpdatedTs is inside the current window, so skip emitting
      }
    });

    await writes.exec();
  }
}

// ------------------------------------------------------------
// Example adapter (the actual implementation steps)
// ------------------------------------------------------------

// todo: add helper to get the decimals dynamically from erc20 contracts (this can be a common util since the abi is shared for many erc20s)
// todo: use builder pattern to only add the gateway, rpc, and logs. transaction should not be modified since we need the txhash

import * as hemiAbi from './abi/hemi';
// fixme: pricing strategy could be different between twb and transaction events
// example univ2 lp is diff from volume pricing of swaps
// should this be two separate pricing strategies transactions / twb?
// or any for the 2 types of events: twb and transaction they both intake a pricing function? <-- this seems like the better option
const sampleAdapter: TwbAdapter = {
  onEvent: async (block, log, emit) => {
    if (log.topics[0] === hemiAbi.events.Deposit.topic) {
      const { depositor, token, amount } = hemiAbi.events.Deposit.decode(log);
      // make sure to await!!
      await emit.balanceDelta({
        user: depositor,
        asset: token,
        amount: new Big(amount.toString()),
      });
    } else if (log.topics[0] === hemiAbi.events.Withdraw.topic) {
      const { withdrawer, token, amount } = hemiAbi.events.Withdraw.decode(log);
      // make sure to await!!
      await emit.balanceDelta({
        user: withdrawer,
        asset: token,
        amount: new Big(amount.toString()).neg(),
      });
    }
  },
  priceAsset: async (timestampMs, asset, feed: PriceCache) => {
    // todo: the feed config should be passed from the json config
    const feedCfg: AssetFeedConfig = {
      // example config for hemi
      '0xaa40c0c7644e0b2b224509571e10ad20d9c4ef28': { kind: 'coingecko', id: 'bitcoin' },
      '0x4200000000000000000000000000000000000006': { kind: 'coingecko', id: 'ethereum' },
      '0x93919784c523f39cacaa98ee0a9d96c3f32b593e': { kind: 'coingecko', id: 'bitcoin' },
      '0xf469fbd2abcd6b9de8e169d128226c0fc90a012e': { kind: 'coingecko', id: 'bitcoin' },
      '0xe85411c030fb32a9d8b14bbbc6cb19417391f711': { kind: 'coingecko', id: 'bitcoin' },
      '0x6c851f501a3f24e29a8e39a29591cddf09369080': { kind: 'coingecko', id: 'dai' },
      '0x0af3ec6f9592c193196bef220bc0ce4d9311527d': { kind: 'coingecko', id: 'bitcoin' },
      '0x78e26e8b953c7c78a58d69d8b9a91745c2bbb258': { kind: 'coingecko', id: 'bitcoin' },
      '0xf9775085d726e782e83585033b58606f7731ab18': { kind: 'coingecko', id: 'bitcoin' },
      '0xc3eacf0612346366db554c991d7858716db09f58': { kind: 'coingecko', id: 'ethereum' },
      '0xb4818bb69478730ef4e33cc068dd94278e2766cb': { kind: 'coingecko', id: 'usd-coin' },
      '0x8154aaf094c2f03ad550b6890e1d4264b5ddad9a': { kind: 'coingecko', id: 'bitcoin' },
      '0xf6718b2701d4a6498ef77d7c152b2137ab28b8a3': { kind: 'coingecko', id: 'bitcoin' },
      '0x028de74e2fe336511a8e5fab0426d1cfd5110dbb': { kind: 'coingecko', id: 'tether-gold' },
      '0xad11a8beb98bbf61dbb1aa0f6d6f2ecd87b35afa': { kind: 'pegged', usdPegValue: 1 },
      '0x7a06c4aef988e7925575c50261297a946ad204a8': { kind: 'coingecko', id: 'usd-coin' },
      '0xbb0d083fb1be0a9f6157ec484b6c79e0a4e31c2e': { kind: 'coingecko', id: 'tether' },
      '0x03c7054bcb39f7b2e5b2c7acb37583e32d70cfa3': { kind: 'coingecko', id: 'bitcoin' },
      '0x6a9a65b84843f5fd4ac9a0471c4fc11afffbce4a': { kind: 'coingecko', id: 'bitcion' },
      '0x027a9d301fb747cd972cfb29a63f3bda551dfc5c': { kind: 'coingecko', id: 'ethereum' },
      '0x9bfa177621119e64cecbeabe184ab9993e2ef727': { kind: 'coingecko', id: 'bitcoin' },
    };

    // fixme: pass in redis from the class (but not here)
    // const feed = new CoinGeckoFeed(feedCfg, redis, process.env.COINGECKO_API_KEY);
    // return await feed.priceUSD(asset, timestampMs);

    // warn: the below code is test placeholder that is just used for testing
    // // helper methods pricing: univ2NAV
    // // todo: need to figure out how to abstract away the tokens from the intracacies of each pricing module
    // // todo: ex: getting codex implemented is going to be very different from getting something like coingecko
    // // todo: since they both require different things to work
    // if (asset === '0x4200000000000000000000000000000000000006') {
    //   return Math.random() > 0.5 ? 4000 : 5000;
    // } else if (asset === '0x9bfa177621119e64cecbeabe184ab9993e2ef727') {
    //   return Math.random() > 0.5 ? 110000 : 120000;
    // } else if (asset === '0xaa40c0c7644e0b2b224509571e10ad20d9c4ef28') {
    //   return Math.random() > 0.5 ? 110000 : 120000;
    // } else {
    //   return 1; // either hardcoded to 1 or assume that its a stablecoin
    // }
  },
};

// note: both univ2nav and pricefeed should implement cachable (which means that values that have already
// been found should be returned immediately rather than requerying)

// case 1: we need to fetch an underlying price (which we already have that day) which means it will be re-cached
// case 2: we need to fetch the pricing of univ2 nav to price the LP token. We will price the lp token each day as well for simplicity.

// UNIV2 NAV PRICING
class UniV2Nav {
  constructor(
    private feed: PriceFeed,
    private ctx: any,
    private assetMap: Record<string, AssetKey>,
  ) {}

  /** Total pool USD value at time `atMs` */
  async poolValueUSD(lp: string, atMs: number): Promise<number> {
    const { token0, token1 } = await this.r.getPairTokens(lp);
    const [{ r0, r1 }, dec0, dec1] = await Promise.all([
      this.r.getReserves(lp, atMs),
      this.r.getDecimals(token0),
      this.r.getDecimals(token1),
    ]);

    const a0 = Number(r0) / 10 ** dec0;
    const a1 = Number(r1) / 10 ** dec1;

    // Map on-chain address -> your AssetKey, then -> CoinGecko id via feed config
    const key0 = this.assetMap[token0.toLowerCase()];
    const key1 = this.assetMap[token1.toLowerCase()];
    if (!key0 || !key1) throw new Error('Missing asset mapping for token0 or token1');

    const [p0, p1] = await Promise.all([
      this.feed.priceUSD(key0, atMs),
      this.feed.priceUSD(key1, atMs),
    ]);

    return a0 * p0 + a1 * p1;
  }

  /** Price of 1 LP token in USD at time `atMs` */
  async lpTokenPriceUSD(lp: string, atMs: number): Promise<number> {
    const [poolUsd, totalSupplyRaw] = await Promise.all([
      this.poolValueUSD(lp, atMs),
      this.r.getTotalSupply(lp, atMs),
    ]);
    // LP token has 18 decimals on typical UniV2-like pairs, but don’t assume
    const lpDecimals = 18; // read if you store it
    const totalSupply = Number(totalSupplyRaw) / 10 ** lpDecimals;
    if (totalSupply === 0) return 0;
    return poolUsd / totalSupply;
  }
}

// END UNIV2 NAV PRICING

// ------------------------------------------------------------
// Final! Running the engine. This is just the driver.
// Will probably load the config from the env anyway so it might even stay the same for all indexers.
// ------------------------------------------------------------
import { processor } from './processor';
import { buildTimeWeightedBalanceEvents, enrichWithRunnerInfo, pipeline } from './enrichers';
import { enrichWithCommonBaseEventFields } from './enrichers';
import { enrichWithPrice } from './enrichers';

const sink = new CsvSink('windows.csv');

// todo: add a feature to not actually send data to the api to allow for testing
// todo: what does testing and validation look like before actually hooking it up to the api?
const engine = new TwbEngine(
  { flushMs: 1000 * 60 * 60 * 48, enablePriceCache: false },
  processor,
  sampleAdapter,
  sink,
);
engine.run();

// NAV might be the same
// however, underlying price might be different
// coingecko vs defillama vs codex vs univ3
// not to mention that they need to provide configuration per asset or could try to optimistically price everything

/*
mapping our price wiring:
  1. find the first block of the window duration (which is the start of the window)
  2. invoke the priceAsset function on that window
  3. store the result of that computation into the price cache (aka: store the price for that window)
  final output: redis timeseries that has one price per asset for that particular window

  enrichment step:
  1. for each window, we get the twa price for that particular duration by iterating over the price key in redis
  2.

*/
