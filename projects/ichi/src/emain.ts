import { Database, LocalDest } from '@subsquid/file-store';
import Big from 'big.js';
import Redis from 'ioredis';

// Engine contracts
type BalanceDelta = {
  user: string;
  asset: string;
  amount: Big;
  meta?: Record<string, unknown>;
};

// Adapter interface (you implement this per protocol)
export interface TwbAdapter {
  onEvent(block: any, log: any, emit: { balanceDelta: (e: BalanceDelta) => void }): Promise<void>;
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

class TwbEngine {
  protected db: Database<any, any>;
  protected adapter!: TwbAdapter;
  // State file path for Subsquid processor checkpoint persistence
  // Each containerized indexer instance uses the same local path since they run in isolation
  // The actual file will be 'status.txt' containing block height and hash for crash recovery
  protected static readonly STATE_FILE_PATH = './state';

  // fixme: prepend the redis prefix with a unique id to avoid conflicts if multiple containerized indexers are running and using the same redis instance
  // todo: change number to bigint/something that encodes token info
  protected redis: Redis;
  protected windows: any[] = [];

  constructor(
    protected cfg: { flushMs: number; enablePriceCache: boolean },
    protected sqdProcessor: any,
    adapter: TwbAdapter,
  ) {
    this.db = new Database({
      tables: {}, // no data tables at all
      dest: new LocalDest(TwbEngine.STATE_FILE_PATH), // where status.txt (or your custom file) lives
      chunkSizeMb: 16, // irrelevant here; we force-flush
    });
    this.adapter = adapter;
    // note: redis is always enabled for now
    this.redis = new Redis();
  }

  async run() {
    this.sqdProcessor.run(this.db, async (ctx: any) => {
      for (const block of ctx.blocks) {
        for (const log of block.logs) {
          await this.ingestLog(block, log);
        }

        // note: easy optimization to only flush balances once we're done backfilling
        // will need to average price over all the durations to get the average price before properly creating a row for this
        // this can be generalizable so that we can flush technically at any time, even with degenerate cases
        const blockTimestamp = new Date(block.header.timestamp);
        const now = new Date();
        if (Math.abs(now.getTime() - blockTimestamp.getTime()) <= 60 * 60 * 1000) {
          await this.flushPeriodic(block.header.timestamp, block.header.height);
        }
      }
      // todo: this.sendToAbsintheApi();
      this.sqdBatchEnd(ctx);
    });
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
      // todo: invoke the pricing function on the balances here
    });
  }

  protected sqdBatchEnd(ctx: any) {
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

    // create a new window
    if (oldAmt.gt(0) && oldTs < ts) {
      // todo: add a new window to a list of windows to send to the absinthe api
      // nop
    }
    // Apply delta
    const newAmt = oldAmt.plus(e.amount);

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

  // Periodic EXHAUSTED windows up to boundaries
  private async flushPeriodic(nowMs: number, height: number) {
    // Only iterate keys with valid balances
    const activeKeys = await this.redis.smembers('ab:gt0'); // for scale, use SSCAN with cursor
    if (activeKeys.length === 0) return;

    const window = this.cfg.flushMs;
    const pipeline = this.redis.pipeline();

    // read all states in one round trip
    for (const k of activeKeys) pipeline.hmget(k, 'amount', 'updatedTs', 'updatedHeight');
    const rows = await pipeline.exec();

    const writes = this.redis.pipeline();
    rows?.forEach(([, vals], i) => {
      if (!vals) return;
      const [amountStr, updatedTsStr, updatedHeightStr] = vals as [string, string, string];
      const amt = new Big(amountStr || '0');
      if (amt.lte(0)) return; // don't create windows for balances that are lte 0

      let startTs = Number(updatedTsStr || nowMs);
      let startHeight = Number(updatedHeightStr || height);

      // advance in fixed windows
      while (startTs + window <= nowMs) {
        // FIXME: rather than advancing in fixed windows, we should advance to the nearest clamped time-window duration and move in this step
        const endTs = startTs + window;
        this.windows.push({
          user: activeKeys[i]!.split(':').pop()!, // last segment is user
          asset: activeKeys[i]!.split(':').slice(-2, -1)[0]!, // second last segment is asset
          startTs,
          endTs,
          startHeight,
          endHeight: height,
          trigger: 'EXHAUSTED',
          amountAfter: amt.toString(),
        });
        startTs = endTs;
        startHeight = height;
      }

      // write back advanced cursor
      writes.hset(activeKeys[i]!, {
        updatedTs: startTs.toString(),
        updatedHeight: startHeight.toString(),
      });
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
    return 0;
  },
};

// ------------------------------------------------------------
// Final! Running the engine. This is just the driver.
// Will probably load the config from the env anyway so it might even stay the same for all indexers.
// ------------------------------------------------------------
import { processor } from './processor';
// todo: add a feature to not actually send data to the api to allow for testing
const engine = new TwbEngine(
  { flushMs: 1000 * 60 * 10, enablePriceCache: false },
  processor,
  sampleAdapter,
);
engine.run();
