import { Database, LocalDest } from '@subsquid/file-store';
import Big from 'big.js';
// fixme: we should move to the original redis package (docs say that's the better one)
import Redis from 'ioredis';

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
      balanceDelta: (e: BalanceDelta) => void;
      positionToggle: (e: PositionToggle) => void;
      // add more here as scope grows
    },
  ): Promise<void>;
  priceAsset?: (
    input: { atMs: number; asset: any },
    providers: {
      usdPrimitive: (
        atHourMs: number,
        reqs: Array<{ key: string; coingeckoId?: string; address?: string; chain?: string }>,
      ) => Promise<Record<string, number>>;
    },
  ) => Promise<number>;
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

  constructor(
    protected cfg: { flushMs: number; enablePriceCache: boolean },
    protected sqdProcessor: any,
    adapter: TwbAdapter,
  ) {
    this.db = new Database({
      tables: {}, // no data tables at all. We use redis, process memory to keep state. Absn api is the final sink.
      dest: new LocalDest(TwbEngine.STATE_FILE_PATH), // where status.txt (or your custom file) lives
    });

    this.adapter = adapter;
    // note: redis is always enabled for now
    // todo: add namespace to the keys for redis so there are no collisions?
    this.redis = new Redis();
  }

  // note: we probably want to be able to pass other types of processors in here, not just evm ones, but solana too!
  // can make a builder class for evm + solana that gently wraps over the subsquid methods to make sure that we're exposing the right ones
  // this will likely be a simple wrapper on top of the sqd methods on the sqd processor class
  async run() {
    this.sqdProcessor.run(this.db, async (ctx: any) => {
      for (const block of ctx.blocks) {
        // the reason we are pricing data per block is so that we can make rpc calls for that block if we need to
        // await this.indexPriceData(block);
        for (const log of block.logs) {
          await this.ingestLog(block, log);
        }

        // note: easy optimization to only flush balances once we're done backfilling
        // will need to average price over all the durations to get the average price before properly creating a row for this
        // this can be generalizable so that we can flush technically at any time, even with degenerate cases
        // fixme: ensure that this checks if the toBlock is set.
        // it should also check if the block is the last block (aka: toBlock) in the case we're ONLY backfilling
        // to know when to flush the whole thing
        // todo: move these conditional checks into the flushPeriodic method so it's easier to read
        const blockTimestamp = new Date(block.header.timestamp);
        const now = new Date();
        // if (Math.abs(now.getTime() - blockTimestamp.getTime()) <= 60 * 60 * 1000) {
        await this.flushPeriodic(block.header.timestamp, block.header.height);
        // }
      }
      // we only need to get the timestamp at the end of the batch, rather than every single block
      await this.backfillPriceDataForBatch(ctx.blocks);
      this.sqdBatchEnd(ctx);
      // replace this.sqdBatchEnd with:
      // this.enrichWindows(ctx);
      // this.sendDataToSink(ctx); <-- this method gets overloaded with the AbsintheApi strategy but can also be the parquet/csv strategy
    });
  }

  // async indexPriceData(block: any) {
  async backfillPriceDataForBatch(blocks: any[]) {
    // this needs to be done in parallel so that we have a more efficient price backfill than doing it per-block
    // 1. get the first blocks of every window duration (ex: 1hr or 1day)
    // 2. get all the valid assets that we need to price (it's okay if we price more than we actually need to)
    // 3. for each of these blocks, promise.all the price data by invoking the priceAsset function
    // 4. store the price data in the price store

    // todo: implement me
    // check if we already have the price for a particular time segment
    // something like...
    // const price = await this.adapter.priceAsset(block);
    // return price;
    return 1;
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
      positionToggle: () => {
        /* todo: implement me */
      },
      // todo: invoke the pricing function on the balances here
    });
  }

  protected async sqdBatchEnd(ctx: any) {
    // enrich all windows before sending to the sink
    if (this.windows.length > 0) {
      const enrichedWindows = await pipeline(
        enrichWithCommonBaseEventFields,
        enrichWithRunnerInfo,
        buildTimeWeightedBalanceEvents,
        enrichWithPrice,
      )(this.windows, ctx);

      // Send to Absinthe API
      // todo: uncomment this when it's ready to send stuff to the api
      // await this.sendToAbsintheApi(enrichedWindows);
    }
    // todo: send to the absinthe api here
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
    } else {
      multi.srem('ab:gt0', key); // not active anymore
    }

    await multi.exec();
  }

  private async flushPeriodic(nowMs: number, height: number) {
    const w = this.cfg.flushMs;

    // Snap "now" to the aligned boundary (tumbling window grid)
    const nowBoundary = Math.floor(nowMs / w) * w;
    if (nowBoundary === this.lastFlushBoundary) return; // nothing closed yet
    this.lastFlushBoundary = nowBoundary;

    // ---- everything below stays the same, but use `processUntil` instead of `nowMs`
    const processUntil = nowBoundary;

    // Only look at keys with a positive balance
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
      if (amt.lte(0)) return;

      const key = activeKeys[i]!;
      const [_, asset, user] = key.split(':'); // 'bal:{asset}:{user}'

      let cursorTs = Number(updatedTsStr || processUntil);
      let cursorHeight = Number(updatedHeightStr || height);

      // Align to the grid
      let prevBoundary = Math.floor(cursorTs / w) * w;
      let boundary = prevBoundary + w;

      // Emit fully elapsed, aligned windows up to the boundary we’re processing
      while (boundary <= processUntil) {
        const winStart = Math.max(cursorTs, prevBoundary);
        const endTs = boundary;

        // fixme: make sure that this is the correct window that is being returned
        if (winStart < endTs) {
          this.windows.push({
            user,
            asset,
            startTs: winStart,
            endTs,
            // startHeight: cursorHeight,
            // endHeight: height,
            trigger: 'EXHAUSTED',
            balance: amt.toString(),
          });
        }

        cursorTs = boundary;
        cursorHeight = height;
        prevBoundary = boundary;
        boundary += w;
      }

      writes.hset(key, { updatedTs: String(cursorTs), updatedHeight: String(cursorHeight) });
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
      emit.balanceDelta({
        user: depositor,
        asset: token,
        amount: new Big(amount.toString()),
      });
    } else if (log.topics[0] === hemiAbi.events.Withdraw.topic) {
      const { withdrawer, token, amount } = hemiAbi.events.Withdraw.decode(log);
      emit.balanceDelta({
        user: withdrawer,
        asset: token,
        amount: new Big(amount.toString()).neg(),
      });
    }
  },
  priceAsset: async (input, providers) => {
    // todo: need to figure out how to abstract away the tokens from the intracacies of each pricing module
    // todo: ex: getting codex implemented is going to be very different from getting something like coingecko
    // todo: since they both require different things to work
    return 0;
  },
};

// ------------------------------------------------------------
// Final! Running the engine. This is just the driver.
// Will probably load the config from the env anyway so it might even stay the same for all indexers.
// ------------------------------------------------------------
import { processor } from './processor';
import { buildTimeWeightedBalanceEvents, enrichWithRunnerInfo, pipeline } from './enrichers';
import { enrichWithCommonBaseEventFields } from './enrichers';
import { enrichWithPrice } from './enrichers';
// todo: add a feature to not actually send data to the api to allow for testing
// todo: what does testing and validation look like before actually hooking it up to the api?
const engine = new TwbEngine(
  { flushMs: 1000 * 60 * 60 * 48, enablePriceCache: false },
  processor,
  sampleAdapter,
);
engine.run();
