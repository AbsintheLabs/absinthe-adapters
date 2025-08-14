import {
  AbsintheApiClient,
  BalanceDelta,
  checkToken,
  Currency,
  getContainerIdFromCgroup,
  HistoryWindow,
  HOURS_TO_MS,
  PriceService,
  RedisService,
  TimeWindowTrigger,
  TokenMetadata,
  toTimeWeightedBalance,
  TwbAdapter,
  ValidatedEnvBase,
  ZERO_ADDRESS,
} from '../index';
import { BlockData, TwbEngineConfig } from '../types/interfaces/twbEngine';
import { EvmLog } from '@subsquid/evm-processor/lib/interfaces/evm';
import { Database, LocalDest } from '@subsquid/file-store';
import Big from 'big.js';

class TwbEngine {
  protected db: Database<any, any>;
  protected adapter!: TwbAdapter;
  protected redisPrefix: string;
  protected env: ValidatedEnvBase;
  protected refreshWindow: number;
  protected protocol: any; //todo: change this
  // State file path for Subsquid processor checkpoint persistence
  // Each containerized indexer instance uses the same local path since they run in isolation
  // The actual file will be 'status.txt' containing block height and hash for crash recovery
  protected static readonly STATE_FILE_PATH = './state';

  // todo: change number to bigint/something that encodes token info // soln: didn't get it
  protected redisInstance: RedisService;
  protected windows: HistoryWindow[] = [];
  protected apiClient: AbsintheApiClient;
  private tokenChecker?: (tokenAddress: string) => TokenMetadata | null;

  //todo: plan on different pricing methods
  private priceService?: PriceService;

  constructor(
    protected cfg: TwbEngineConfig,
    protected sqdProcessor: any,
    adapter: TwbAdapter,
    protocol: any,
    env: ValidatedEnvBase,
  ) {
    this.db = new Database({
      tables: {}, // no data tables at all. We use redis, process memory to keep state. Absn api is the final sink.
      dest: new LocalDest(TwbEngine.STATE_FILE_PATH), // where status.txt (or your custom file) lives
    });

    this.adapter = adapter;
    this.protocol = protocol;
    this.env = env;
    this.apiClient = new AbsintheApiClient({
      baseUrl: this.env.absintheApiUrl,
      apiKey: this.env.absintheApiKey,
    });
    this.refreshWindow = this.env.balanceFlushIntervalHours * HOURS_TO_MS;
    this.redisPrefix = getContainerIdFromCgroup() || 'default'; //todo:check
    this.redisInstance = RedisService.getInstance();

    // Initialize optional pricing service
    if (cfg.pricing?.enabled && cfg.pricing.priceService) {
      this.priceService = cfg.pricing.priceService;
    }
  }

  async run() {
    this.sqdProcessor.run(this.db, async (ctx: any) => {
      for (const block of ctx.blocks) {
        await this.indexPriceData(block);
        for (const log of block.logs) {
          await this.ingestLog(block, log);
        }

        // note: easy optimization to only flush balances once we're done backfilling
        // will need to average price over all the durations to get the average price before properly creating a row for this
        // this can be generalizable so that we can flush technically at any time, even with degenerate cases
        // fixme: ensure that this checks if the toBlock is set. it should also check if the block is the last block
        // to know when to flush the whole thing
        const blockTimestamp = new Date(block.header.timestamp);
        const now = new Date();
        // if (Math.abs(now.getTime() - blockTimestamp.getTime()) <= 60 * 60 * 1000) {
        await this.flushPeriodic(block.header.timestamp, block.header.height);
        // }
      }
      this.sqdBatchEnd(ctx);
    });
  }

  async indexPriceData(block: any) {
    // 1. given the block timestamp, do we have a price for this last timestamp duration? (ex: 1hr or 1day)
    // 2. if yes, skip
    // 3. if no, invoke the pricing function to get the price for the timestamp
    // 4. store the price in the price store

    // todo: implement me
    // check if we already have the price for a particular time segment
    // something like...
    // const price = await this.adapter.priceAsset(block);
    // return price;
    return 1;
  }

  // Subsquid hands logs to this
  async ingestLog(block: any, log: EvmLog) {
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
      transaction: () => {
        /* todo: implement me */
      },
      // todo: invoke the pricing function on the balances here
    });

    // Call priceAsset only if the adapter implements it
  }

  protected async sqdBatchEnd(ctx: any) {
    //todo: later you can enrich all windows before sending to the sink
    if (this.windows.length > 0) {
      const chainConfig = {
        chainArch: this.protocol.chainArch,
        networkId: this.protocol.chainId,
        chainShortName: this.protocol.chainShortName,
        chainName: this.protocol.chainName,
      };
      //todo: check type
      const balances = toTimeWeightedBalance(this.windows, this.protocol, this.env, chainConfig);
      await this.apiClient.send(balances);
    }
    this.windows = [];
    ctx.store.setForceFlush(true);
  }

  //note - first time balance tracking is not done here
  //note- case When updatedAmount > 0n AND previous balance was 0 (first-time deposit)
  protected async applyBalanceDelta(e: BalanceDelta, blockData: BlockData): Promise<void> {
    const { ts, height, txHash } = blockData;
    const key = `${this.redisPrefix}:bal:${e.asset}:${e.user}`;

    if (e.user === ZERO_ADDRESS) {
      console.warn(`Ignoring balance delta for zero address: ${e.user}`);
      return;
    }

    // Load current state (single HMGET with pipeline if you batch)
    const [amountStr, updatedTsStr, updatedHeightStr] = await this.redisInstance.execute(
      (client) => {
        return client.hmGet(key, ['amount', 'updatedTs', 'updatedHeight']);
      },
    );
    const oldAmt = new Big(amountStr || '0');
    const oldTs = updatedTsStr ? Number(updatedTsStr) : ts;
    const oldHeight = updatedHeightStr ? Number(updatedHeightStr) : height;

    // Apply delta
    const newAmt = oldAmt.plus(e.amount);

    // create a new window
    //note: removed  && oldTs < ts for testing purposes
    if (oldAmt.gt(0)) {
      this.windows.push({
        userAddress: e.user.toLowerCase(),
        startTs: oldTs,
        endTs: ts,
        startBlockNumber: oldHeight,
        endBlockNumber: height,
        trigger: TimeWindowTrigger.TRANSFER,
        balanceBefore: oldAmt.toString(),
        balanceAfter: newAmt.toString(),
        txHash,
        deltaAmount: Number(e.amount),
        currency: Currency.USD,
        windowDurationMs: ts - oldTs,
        tokenPrice: 0, //todo: add the price
        tokenDecimals: 0, //todo: add the decimals
        valueUsd: 0, //todo: add the value in usd
        tokens: {}, //todo: add the tokens
      });
    }

    // Persist
    await this.redisInstance.execute(async (client) => {
      const multi = client.multi();
      multi.hSet(key, {
        amount: newAmt.toString(),
        updatedTs: ts.toString(),
        updatedHeight: height.toString(),
      });
      // this is an optimization to track balances that are gt 0
      // soln : we can also delete the keys if the balance is 0 (no need to track it separately)
      if (newAmt.gt(0)) {
        multi.sAdd('ab:gt0', key); // track as active balance
      } else {
        multi.sRem('ab:gt0', key); // not active anymore
      }

      return multi.exec();
    });
  }

  private async flushPeriodic(currentBlockTs: number, blockHeight: number) {
    // Get or initialize the last interpolated timestamp from Redis
    const lastInterpolatedTsKey = `${this.redisPrefix}:lastInterpolatedTs`;
    const lastInterpolatedTsStr = await this.redisInstance.execute(async (client) => {
      return await client.get(lastInterpolatedTsKey);
    });

    let lastInterpolatedTs = lastInterpolatedTsStr ? Number(lastInterpolatedTsStr) : currentBlockTs;

    // Process all time windows that have elapsed since the last interpolation
    while (lastInterpolatedTs + this.refreshWindow < currentBlockTs) {
      const windowsSinceEpoch = Math.floor(lastInterpolatedTs / this.refreshWindow);
      const nextBoundaryTs = (windowsSinceEpoch + 1) * this.refreshWindow;

      // Only look at keys with a positive balance
      const activeKeys = await this.redisInstance.execute(async (client) => {
        return await client.sMembers(`${this.redisPrefix}:ab:gt0`);
      });

      if (activeKeys.length === 0) {
        lastInterpolatedTs = nextBoundaryTs;
        continue;
      }

      // Bulk read state from Redis
      const read = await this.redisInstance.execute(async (client) => {
        const multi = client.multi();
        for (const k of activeKeys) {
          multi.hmGet(k, ['amount', 'updatedTs', 'updatedHeight']);
        }
        return multi.exec();
      });
      const rows = Array.isArray(read) ? read : [];

      const writeOperations: Array<{ key: string; updatedTs: string; updatedHeight: string }> = [];

      //todo: check after printing rows
      (rows as any[]).forEach(([, vals], i) => {
        if (!vals || !Array.isArray(vals)) return;
        const [amountStr, updatedTsStr, updatedHeightStr] = vals as [string, string, string];
        const amt = new Big(amountStr || '0');
        if (amt.lte(0)) return;

        const key = activeKeys[i]!;
        const [prefix, asset, user] = key.split(':'); // '{prefix}:bal:{asset}:{user}'

        const oldStart = Number(updatedTsStr || nextBoundaryTs);

        // Only create window if balance exists and the old start is before the boundary
        if (amt.gt(0) && oldStart < nextBoundaryTs) {
          // Check if token is supported

          this.windows.push({
            userAddress: user.toLowerCase(),
            startTs: oldStart,
            endTs: nextBoundaryTs,
            startBlockNumber: Number(updatedHeightStr || blockHeight),
            endBlockNumber: blockHeight,
            trigger: TimeWindowTrigger.EXHAUSTED,
            balanceBefore: amt.toString(),
            balanceAfter: amt.toString(),
            txHash: null,
            deltaAmount: Number(amt),
            currency: Currency.USD,
            windowDurationMs: nextBoundaryTs - oldStart,
            tokenPrice: 0,
            tokenDecimals: 0, //todo: add the decimals
            valueUsd: 0, //todo: add the value in usd
            tokens: {}, //todo: add the tokens
          });

          // Collect write operations instead of immediate pipeline
          writeOperations.push({
            key,
            updatedTs: String(nextBoundaryTs),
            updatedHeight: String(blockHeight),
          });
        }
      });

      // Execute all Redis updates in a single transaction
      if (writeOperations.length > 0) {
        await this.redisInstance.execute(async (client) => {
          const multi = client.multi();
          for (const op of writeOperations) {
            multi.hSet(op.key, {
              updatedTs: op.updatedTs,
              updatedHeight: op.updatedHeight,
            });
          }
          return multi.exec();
        });
      }

      // Update the last interpolated timestamp
      lastInterpolatedTs = nextBoundaryTs;
    }

    // Persist the updated lastInterpolatedTs back to Redis
    await this.redisInstance.execute(async (client) => {
      return await client.set(lastInterpolatedTsKey, String(lastInterpolatedTs));
    });
  }
}

export { TwbEngine };
