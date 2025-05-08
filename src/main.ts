// This is the main executable of the squid indexer.
import fs from 'fs'; // todo; remove for production version
import { TypeormDatabase } from '@subsquid/typeorm-store'
import { ApiClient, convertBigIntToString } from './services/apiClient';
import { processor } from './processor';
import * as velodromeAbi from './abi/velodrome';
import * as erc20Abi from './abi/usdc';
import { processValueChange } from './utils/valueChangeHandler';
import { createDataSource } from './utils/sourceId';
import { TimeWeightedBalance, UniswapV2TWBMetadata, TimeWindow } from './interfaces';
import { exit } from 'process';
import Big from 'big.js';
import { Token, PoolConfig, PoolState, ActiveBalances } from './model';

const LP_TOKEN_CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS!;

// Create API client for sending data
const apiClient = new ApiClient({
  baseUrl: process.env.ABSINTHE_API_URL!,
  apiKey: process.env.ABSINTHE_API_KEY!
});

// Set supportHotBlocks to false to only send finalized blocks
const db = new TypeormDatabase({ supportHotBlocks: false })

let lastInterpolatedTs: number | null = null;
// todo; turn this into a class so you can choose the duration from: 1 hour, 12 hours, 1 day
const WINDOW_DURATION_MS = 3600 * 1000 * 12; // 1 day

// todo: these should be pulled from the db state on each batch run
export type ActiveBalance = {
  balance: bigint,
  updated_at_block_ts: number,
  updated_at_block_height: number
}

export type HistoryWindow = {
  userAddress: string,
  assetAddress: string,
  balance: bigint,
  usdValue: number,
  ts_start: number,
  ts_end: number,
  block_start?: number,
  block_end?: number,
  trigger: 'transfer' | 'exhausted'
}
const activeBalancesMap = new Map<string, ActiveBalance>();
const balanceHistoryWindows: HistoryWindow[] = [];
// NOTE: we should use the TimeWeightedBalance interface instead. but for now, we can skip while we do pricing...
// const balanceHistoryWindows: TimeWeightedBalance[] = [];

// >>>>>>>>>>>>>>>>> PRICING STUFF <<<<<<<<<<<<<<<<<<<
// price state
const hourlyPriceCache = new Map<string, number>();
// price getter functions
async function getPriceFromCoingecko(coingeckoId: string, timestampMs: number): Promise<number> {
  const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY!;
  if (!COINGECKO_API_KEY) {
    throw new Error('COINGECKO_API_KEY is not set');
  }
  const options = {
    method: 'GET',
    headers: { accept: 'application/json', 'x-cg-pro-api-key': COINGECKO_API_KEY }
  };
  const date = new Date(timestampMs);
  const formattedDate = `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`;
  const priceUrl = `https://pro-api.coingecko.com/api/v3/coins/${coingeckoId}/history?date=${formattedDate}&localization=false`;
  const priceResp = await (await fetch(priceUrl, options)).json();
  if (priceResp?.status?.error_code) {
    throw new Error(`Error fetching price for ${coingeckoId} on ${formattedDate}: ${priceResp.status.error_message}`);
  }
  const price = priceResp.market_data.current_price.usd;
  return price;
}

async function getHourlyPrice(coingeckoId: string, timestampMs: number): Promise<number> {
  if (!coingeckoId) {
    throw new Error(`Cannot get price: coingeckoId is ${coingeckoId}`);
  }

  if (!timestampMs) {
    throw new Error(`Cannot get price: timestampMs is ${timestampMs}`);
  }

  // round timestamp down to the start of its hour
  const date = new Date(timestampMs)
  date.setMinutes(0, 0, 0)
  const hourBucket = date.getTime() // ms since epoch at top of hour

  const cacheKey = `${coingeckoId}-${hourBucket}` // todo: this could just be the hour, without the id
  const cached = hourlyPriceCache.get(cacheKey)
  if (cached !== undefined) {
    return cached
  }

  // not in cache → fetch and store
  const price = await getPriceFromCoingecko(coingeckoId, timestampMs)
  hourlyPriceCache.set(cacheKey, price)
  return price
}

async function computeLpTokenPrice(poolConfig: PoolConfig, poolState: PoolState, timestampMs?: number): Promise<number> {
  if (!poolConfig) {
    throw new Error('No poolConfig provided to computeLpTokenPrice');
  }

  if (!poolState) {
    throw new Error('No poolState provided to computeLpTokenPrice');
  }

  if (!poolConfig.token0) {
    throw new Error(`poolConfig.token0 is missing in poolConfig ${poolConfig.id}`);
  }

  if (!poolConfig.token1) {
    throw new Error(`poolConfig.token1 is missing in poolConfig ${poolConfig.id}`);
  }

  if (!poolConfig.lpToken) {
    throw new Error(`poolConfig.lpToken is missing in poolConfig ${poolConfig.id}`);
  }

  if (!poolConfig.token0.coingeckoId || !poolConfig.token1.coingeckoId) {
    console.log(`poolConfig: ${JSON.stringify(poolConfig)}`);
    console.log(`poolState: ${JSON.stringify(poolState)}`);
    throw new Error('No coingecko id found for token0 or token1');
  }

  const token0Price = await getHourlyPrice(poolConfig.token0.coingeckoId, timestampMs ?? Number(poolState.lastTsMs));
  const token1Price = await getHourlyPrice(poolConfig.token1.coingeckoId, timestampMs ?? Number(poolState.lastTsMs));

  const token0Value = new Big(poolState.reserve0.toString())
    .div(new Big(10).pow(poolConfig.token0.decimals))
    .mul(token0Price);

  // Calculate token1 value in USD
  const token1Value = new Big(poolState.reserve1.toString())
    .div(new Big(10).pow(poolConfig.token1.decimals))
    .mul(token1Price);

  // Total value in the pool
  const totalPoolValue = token0Value.add(token1Value);

  // Calculate price per LP token
  const price = totalPoolValue
    .div(new Big(poolState.totalSupply.toString())
      .div(new Big(10).pow(poolConfig.lpToken.decimals)))
    .toNumber();

  return price;
}

// Helper functions to convert between Map and JSON for storage
function mapToJson(map: Map<string, ActiveBalance>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of map.entries()) {
    result[key] = {
      balance: value.balance.toString(),
      updated_at_block_ts: value.updated_at_block_ts,
      updated_at_block_height: value.updated_at_block_height
    };
  }
  return result;
}

function jsonToMap(json: Record<string, any>): Map<string, ActiveBalance> {
  const result = new Map<string, ActiveBalance>();
  if (!json) return result;

  for (const [key, value] of Object.entries(json)) {
    if (key === '__metadata') continue;
    result.set(key, {
      balance: BigInt(value.balance),
      updated_at_block_ts: value.updated_at_block_ts,
      updated_at_block_height: value.updated_at_block_height
    });
  }
  return result;
}

// processor.run() executes data processing with a handler called on each data batch.
// Data is available via ctx.blocks; handler can also use external data sources.
processor.run(db, async (ctx) => {
  // Load existing poolConfig and poolState or create new ones
  let poolConfig: PoolConfig | undefined = await ctx.store.findOne(PoolConfig, {
    where: { id: LP_TOKEN_CONTRACT_ADDRESS },
    relations: { token0: true, token1: true, lpToken: true }
  });
  let poolState: PoolState | undefined = poolConfig ?
    await ctx.store.findOne(PoolState, {
      where: { pool: { id: poolConfig.id } },
      relations: { pool: true }
    }) :
    undefined;

  // Load active balances state from database
  const ACTIVE_BALANCES_ID = 'active-balances';
  let activeBalancesEntity = await ctx.store.get(ActiveBalances, ACTIVE_BALANCES_ID);

  // Initialize activeBalancesMap from stored state if it exists
  if (activeBalancesEntity) {
    const storedMap = jsonToMap(activeBalancesEntity.activeBalancesMap);
    // Clear the in-memory map and populate it with stored values
    activeBalancesMap.clear();
    for (const [key, value] of storedMap.entries()) {
      activeBalancesMap.set(key, value);
    }

    // Also restore lastInterpolatedTs if it exists in metadata
    if (activeBalancesEntity.activeBalancesMap.__metadata?.lastInterpolatedTs) {
      lastInterpolatedTs = activeBalancesEntity.activeBalancesMap.__metadata.lastInterpolatedTs;
    }
  }

  // We'll make db and network operations at the end of the batch saving massively on IO
  for (let block of ctx.blocks) {
    for (let log of block.logs) {
      // Sync Event
      if (log.address === LP_TOKEN_CONTRACT_ADDRESS && log.topics[0] === velodromeAbi.events.Sync.topic) {
        const contract = new velodromeAbi.Contract(ctx, block.header, LP_TOKEN_CONTRACT_ADDRESS);
        // do this once on initialization or if we don't have poolConfig
        if (!poolConfig) {
          const token0Address = await contract.token0();
          const token1Address = await contract.token1();
          const token0Contract = new erc20Abi.Contract(ctx, block.header, token0Address);
          const token1Contract = new erc20Abi.Contract(ctx, block.header, token1Address);
          const token0Decimals = await token0Contract.decimals();
          const token1Decimals = await token1Contract.decimals();
          const token0CoingeckoId = process.env.TOKEN0_COINGECKO_ID!;
          const token1CoingeckoId = process.env.TOKEN1_COINGECKO_ID!;
          const lpDecimals = await contract.decimals();

          // Create or get tokens
          let token0 = await ctx.store.get(Token, token0Address);
          if (!token0) {
            if (!token0CoingeckoId) {
              ctx.log.error(`No coingeckoId provided for token0 (${token0Address}). Please set TOKEN0_COINGECKO_ID in environment variables.`);
              throw new Error(`TOKEN0_COINGECKO_ID environment variable is required`);
            }
            token0 = new Token({
              id: token0Address,
              address: token0Address,
              decimals: token0Decimals,
              coingeckoId: token0CoingeckoId
            });
            await ctx.store.upsert(token0);
          } else if (!token0.coingeckoId && token0CoingeckoId) {
            // Update coingeckoId if it's missing but we have it now
            token0.coingeckoId = token0CoingeckoId;
            await ctx.store.upsert(token0);
          }

          let token1 = await ctx.store.get(Token, token1Address);
          if (!token1) {
            if (!token1CoingeckoId) {
              ctx.log.error(`No coingeckoId provided for token1 (${token1Address}). Please set TOKEN1_COINGECKO_ID in environment variables.`);
              throw new Error(`TOKEN1_COINGECKO_ID environment variable is required`);
            }
            token1 = new Token({
              id: token1Address,
              address: token1Address,
              decimals: token1Decimals,
              coingeckoId: token1CoingeckoId
            });
            await ctx.store.upsert(token1);
          } else if (!token1.coingeckoId && token1CoingeckoId) {
            // Update coingeckoId if it's missing but we have it now
            token1.coingeckoId = token1CoingeckoId;
            await ctx.store.upsert(token1);
          }

          let lpToken = await ctx.store.get(Token, LP_TOKEN_CONTRACT_ADDRESS);
          if (!lpToken) {
            lpToken = new Token({
              id: LP_TOKEN_CONTRACT_ADDRESS,
              address: LP_TOKEN_CONTRACT_ADDRESS,
              decimals: lpDecimals
            });
            await ctx.store.upsert(lpToken);
          }

          // Create pool config
          poolConfig = new PoolConfig({
            id: LP_TOKEN_CONTRACT_ADDRESS,
            token0,
            token1,
            lpToken
          });
          await ctx.store.upsert(poolConfig);

          // Also refresh our poolConfig with the fully loaded relations
          poolConfig = await ctx.store.findOne(PoolConfig, {
            where: { id: LP_TOKEN_CONTRACT_ADDRESS },
            relations: { token0: true, token1: true, lpToken: true }
          });
        }

        // Update pool state with the new Sync event data
        const reserve = await contract.getReserves();
        const r0 = reserve._reserve0;
        const r1 = reserve._reserve1;
        const totalSupply = await contract.totalSupply();

        if (!poolState && poolConfig) {
          poolState = new PoolState({
            id: `${LP_TOKEN_CONTRACT_ADDRESS}-state`,
            pool: poolConfig,
            reserve0: r0,
            reserve1: r1,
            totalSupply,
            lastBlock: block.header.height,
            lastTsMs: BigInt(block.header.timestamp),
            updatedAt: new Date(block.header.timestamp)
          });
        } else if (poolState && poolConfig) {
          poolState.pool = poolConfig;
          poolState.reserve0 = r0;
          poolState.reserve1 = r1;
          poolState.totalSupply = totalSupply;
          poolState.lastBlock = block.header.height;
          poolState.lastTsMs = BigInt(block.header.timestamp);
          poolState.updatedAt = new Date(block.header.timestamp);
        }

        if (poolState) {
          await ctx.store.upsert(poolState);

          // Reload poolState with all relations to ensure they're available
          poolState = await ctx.store.findOne(PoolState, {
            where: { id: poolState.id },
            relations: { pool: { token0: true, token1: true, lpToken: true } }
          });
        }
      }

      // warn: transfers: assume that we will always index from the beginning of all events so we need pool state + pool config
      // warn: swaps: we can index from anywhere so we only need the pool config (can handle that separately in the swap topic handler)
      // Transfer Event
      if (log.address === LP_TOKEN_CONTRACT_ADDRESS && log.topics[0] === velodromeAbi.events.Transfer.topic) {
        if (!poolConfig) {
          ctx.log.warn(`Cannot process transfer: poolConfig is undefined`);
          continue;
        }

        if (!poolState) {
          ctx.log.warn(`Cannot process transfer: poolState is undefined`);
          continue;
        }

        // Check if required relationships are loaded
        if (!poolConfig.token0 || !poolConfig.token1 || !poolConfig.lpToken) {
          ctx.log.warn(`Cannot process transfer: poolConfig relationships not fully loaded: ${JSON.stringify(poolConfig)}`);

          // Try to reload the poolConfig with relationships
          poolConfig = await ctx.store.findOne(PoolConfig, {
            where: { id: LP_TOKEN_CONTRACT_ADDRESS },
            relations: { token0: true, token1: true, lpToken: true }
          });

          if (!poolConfig || !poolConfig.token0 || !poolConfig.token1 || !poolConfig.lpToken) {
            ctx.log.error(`Failed to reload poolConfig with relationships`);
            continue;
          }
        }

        // Case 1: Emit events on transfer
        const { from, to, value } = velodromeAbi.events.Transfer.decode(log);
        await processValueChange({
          assetAddress: LP_TOKEN_CONTRACT_ADDRESS,
          from,
          to,
          amount: value,
          usdValue: await computeLpTokenPrice(poolConfig, poolState, block.header.timestamp),
          blockTimestamp: block.header.timestamp,
          blockHeight: block.header.height,
          txHash: log.transactionHash, // currently not used for anything
          activeBalances: activeBalancesMap,
          historyWindows: balanceHistoryWindows,
        })
      }
    }

    // for each block...
    // Case 2: Interpolate balances based on block range and flush balances after the time period is exhausted
    if (!poolConfig) {
      ctx.log.warn(`Cannot interpolate balances: poolConfig is undefined`);
      continue;
    }

    if (!poolState) {
      ctx.log.warn(`Cannot interpolate balances: poolState is undefined`);
      continue;
    }

    // Check if required relationships are loaded
    if (!poolConfig.token0 || !poolConfig.token1 || !poolConfig.lpToken) {
      ctx.log.warn(`Cannot interpolate balances: poolConfig relationships not fully loaded: ${JSON.stringify(poolConfig)}`);

      // Try to reload the poolConfig with relationships
      poolConfig = await ctx.store.findOne(PoolConfig, {
        where: { id: LP_TOKEN_CONTRACT_ADDRESS },
        relations: { token0: true, token1: true, lpToken: true }
      });

      if (!poolConfig || !poolConfig.token0 || !poolConfig.token1 || !poolConfig.lpToken) {
        ctx.log.error(`Failed to reload poolConfig with relationships for interpolation`);
        continue;
      }
    }

    const currentTs = block.header.timestamp;
    const currentBlockHeight = block.header.height;
    // set the last interpolated timestamp to the current timestamp if it's not set
    if (!lastInterpolatedTs) lastInterpolatedTs = currentTs;
    while (lastInterpolatedTs + WINDOW_DURATION_MS < currentTs) {
      // Calculate how many complete windows have passed since epoch
      const windowsSinceEpoch = Math.floor(lastInterpolatedTs / WINDOW_DURATION_MS);
      // Calculate the next window boundary by multiplying by window duration
      const nextBoundaryTs: number = (windowsSinceEpoch + 1) * WINDOW_DURATION_MS;
      // ... do periodic flush for each asset in the map ...
      for (let [userAddress, data] of activeBalancesMap.entries()) {
        const oldStart = data.updated_at_block_ts;
        if (data.balance > 0 && oldStart < nextBoundaryTs) {
          balanceHistoryWindows.push({
            userAddress,
            assetAddress: LP_TOKEN_CONTRACT_ADDRESS,
            balance: data.balance,
            usdValue: await computeLpTokenPrice(poolConfig, poolState, currentBlockHeight),
            ts_start: oldStart,
            ts_end: nextBoundaryTs,
            trigger: 'exhausted'
          });
          activeBalancesMap.set(userAddress, {
            balance: data.balance,
            updated_at_block_ts: nextBoundaryTs,
            updated_at_block_height: block.header.height
          });
        }
      }
      lastInterpolatedTs = nextBoundaryTs;
    }

    // // warn: this should be removed before creating the production build
    // // this is temporary to flush the data to a file for debugging
    // if (block.header.height === Number(process.env.TO_BLOCK!)) {
    //   const redacted = convertBigIntToString(balanceHistoryWindows);
    //   const withReadableTS = redacted.map((e: any) => ({ ...e, ts_start: new Date(e.ts_start).toISOString(), ts_end: new Date(e.ts_end).toISOString() }));
    //   fs.writeFileSync('flushed-auditai-data.json', JSON.stringify(withReadableTS, null, 2));
    // }

    // Write balance records to Balances table after each periodic flush
    // Prepare the data to fit the TimeWeightedBalance interface
    const balances: TimeWeightedBalance<UniswapV2TWBMetadata>[] = balanceHistoryWindows.map((e) => {
      const trigger = e.trigger === 'exhausted' ? 'exhausted' as const : 'transfer' as const;
      const windowId = Math.floor(e.ts_start / WINDOW_DURATION_MS);

      // Create appropriate timeWindow based on trigger type
      const baseTimeWindow = {
        startTs: e.ts_start,
        endTs: e.ts_end,
        windowDurationMs: WINDOW_DURATION_MS,
        windowId
      };

      // Add block numbers for transfer triggers
      const timeWindow: TimeWindow = trigger === 'transfer'
        ? {
          ...baseTimeWindow,
          trigger,
          startBlocknumber: BigInt(e.block_start || 0),
          endBlocknumber: BigInt(e.block_end || 0)
        }
        : {
          startTs: e.ts_start,
          endTs: e.ts_end,
          windowDurationMs: WINDOW_DURATION_MS,
          windowId,
          trigger
        };

      return {
        version: 1,
        dataType: 'time_weighted_balance',
        user: e.userAddress,
        chain: { networkId: 1, name: 'mainnet', chainType: 'evm' },
        value: Number(e.usdValue),
        timeWindow,
        protocolMetadata: {
          poolAddress: LP_TOKEN_CONTRACT_ADDRESS,
          lpTokenAmount: e.balance,
        },
      }
    });
    await apiClient.sendBalances(balances);
  }

  // Save active balances to database
  const mapToSave = mapToJson(activeBalancesMap);
  // Store metadata like lastInterpolatedTs
  mapToSave.__metadata = {
    lastInterpolatedTs: lastInterpolatedTs,
    lastUpdated: new Date().toISOString()
  };

  if (!activeBalancesEntity) {
    activeBalancesEntity = new ActiveBalances({
      id: ACTIVE_BALANCES_ID,
      activeBalancesMap: mapToSave
    });
  } else {
    activeBalancesEntity.activeBalancesMap = mapToSave;
  }

  await ctx.store.upsert(activeBalancesEntity);
})
