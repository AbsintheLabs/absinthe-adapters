// This is the main executable of the squid indexer.
import fs from 'fs'; // todo; remove for production version
import { TypeormDatabase } from '@subsquid/typeorm-store'
import { ApiClient, convertBigIntToString } from './services/apiClient';
import { processor } from './processor';
import * as velodromeAbi from './abi/velodrome';
import * as erc20Abi from './abi/usdc';
import { processValueChange } from './utils/valueChangeHandler';
import { createDataSource } from './utils/sourceId';
import { TimeWeightedBalance } from './interfaces';
import { exit } from 'process';
import Big from 'big.js';

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
export type ActiveBalance = { balance: bigint, updated_at_block_ts: number, updated_at_block_height: number }
export type HistoryWindow = { userAddress: string, assetAddress: string, balance: bigint, ts_start: number, ts_end: number, block_start: number, block_end: number }
const activeBalancesMap = new Map<string, ActiveBalance>();
const balanceHistoryWindows: HistoryWindow[] = [];
// NOTE: we should use the TimeWeightedBalance interface instead. but for now, we can skip while we do pricing...
// const balanceHistoryWindows: TimeWeightedBalance[] = [];

// warn: this was premature optimization, opting for a single map instead for one pool
// const activeBalancesMap = new Map<string, Map<string, ActiveBalance>>();

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
  // First - get the token id from the contract address
  // This doesn't work for obscure assets
  // const tokenDataUrl = `https://pro-api.coingecko.com/api/v3/${chainId}coins/id/contract/${tokenAddress}`;
  // const tokenDataResp = await (await fetch(tokenDataUrl, options)).json();
  // const tokenId = tokenDataResp.id;
  // if (!tokenId) {
  //   throw new Error(`Token id not found for contract address ${tokenAddress}`);
  // }
  // Second - get the price from the token id
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

async function computeLpTokenPrice(pool: Pool, timestampMs?: number): Promise<number> {
  const { config, state } = pool;
  const token0Price = await getHourlyPrice(config.token0.coingeckoId!, timestampMs ?? state.lastTsMs);
  const token1Price = await getHourlyPrice(config.token1.coingeckoId!, timestampMs ?? state.lastTsMs);

  const token0Value = new Big(state.reserve0.toString())
    .div(new Big(10).pow(config.token0.decimals))
    .mul(token0Price);

  // Calculate token1 value in USD
  const token1Value = new Big(state.reserve1.toString())
    .div(new Big(10).pow(config.token1.decimals))
    .mul(token1Price);

  // Total value in the pool
  const totalPoolValue = token0Value.add(token1Value);

  // Calculate price per LP token
  const price = totalPoolValue
    .div(new Big(state.totalSupply.toString())
      .div(new Big(10).pow(config.lpToken.decimals)))
    .toNumber();

  return price;
}

// end price getter functions

// pricing stuff
interface Token {
  address: string;
  decimals: number;
  coingeckoId?: string; // only relevant for token0 and token1
}
interface PoolConfig {
  token0: Token;
  token1: Token;
  lpToken: Token;
}
interface PoolState {
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
  lastBlock: number;
  lastTsMs: number
}
interface Pool {
  config: PoolConfig;
  state: PoolState;
}

let pool: Partial<Pool> = {};

// processor.run() executes data processing with a handler called on each data batch.
// Data is available via ctx.blocks; handler can also use external data sources.
processor.run(db, async (ctx) => {
  // We'll make db and network operations at the end of the batch saving massively on IO
  for (let block of ctx.blocks) {
    for (let log of block.logs) {
      // Sync Event
      if (log.address === LP_TOKEN_CONTRACT_ADDRESS && log.topics[0] === velodromeAbi.events.Sync.topic) {
        const contract = new velodromeAbi.Contract(ctx, block.header, LP_TOKEN_CONTRACT_ADDRESS);
        // do this once on initialization
        if (!pool.config) {
          const token0 = await contract.token0();
          const token1 = await contract.token1();
          const token0Contract = new erc20Abi.Contract(ctx, block.header, token0);
          const token1Contract = new erc20Abi.Contract(ctx, block.header, token1);
          const token0Decimals = await token0Contract.decimals();
          const token1Decimals = await token1Contract.decimals();
          const token0CoingeckoId = process.env.TOKEN0_COINGECKO_ID!;
          const token1CoingeckoId = process.env.TOKEN1_COINGECKO_ID!;
          const lpDecimals = await contract.decimals();
          pool.config = {
            token0: { address: token0, decimals: token0Decimals, coingeckoId: token0CoingeckoId },
            token1: { address: token1, decimals: token1Decimals, coingeckoId: token1CoingeckoId },
            lpToken: { address: LP_TOKEN_CONTRACT_ADDRESS, decimals: lpDecimals }
          }
        }
        // do this for each sync event
        const reserve = await contract.getReserves();
        const r0 = reserve._reserve0;
        const r1 = reserve._reserve1;
        const totalSupply = await contract.totalSupply();
        pool.state = {
          reserve0: r0,
          reserve1: r1,
          totalSupply: totalSupply,
          lastBlock: block.header.height,
          lastTsMs: block.header.timestamp
        }
      }

      // warn: transfers: assume that we will always index from the beginning of all events so we need pool state + pool config
      // warn: swaps: we can index from anywhere so we only need the pool config (can handle that separately in the swap topic handler)
      // Transfer Event
      if (log.address === LP_TOKEN_CONTRACT_ADDRESS && log.topics[0] === velodromeAbi.events.Transfer.topic) {
        // Case 1: Emit events on transfer
        const { from, to, value } = velodromeAbi.events.Transfer.decode(log);
        console.log('price of LP triggered by transfer: ', await computeLpTokenPrice(pool as Pool, block.header.timestamp));
        await processValueChange({
          assetAddress: LP_TOKEN_CONTRACT_ADDRESS,
          from,
          to,
          amount: value,
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
    // We do this for each block since we don't want to miss the case where we leave a gap in the data if there are 2 transfers spaced far apart in the same batch
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
      // for (let [assetAddress, mapping] of activeBalancesMap.entries()) {
      for (let [userAddress, data] of activeBalancesMap.entries()) {
        const oldStart = data.updated_at_block_ts;
        if (data.balance > 0 && oldStart < nextBoundaryTs) {
          // bug: the updated_at_block_height is not correct since we're not doing it on the block, but instead on the last interpolated timestamp
          balanceHistoryWindows.push({ userAddress, assetAddress: LP_TOKEN_CONTRACT_ADDRESS, balance: data.balance, ts_start: oldStart, ts_end: nextBoundaryTs, block_start: data.updated_at_block_height, block_end: block.header.height });
          activeBalancesMap.set(userAddress, { balance: data.balance, updated_at_block_ts: nextBoundaryTs, updated_at_block_height: block.header.height });
        }
      }
      // }
      lastInterpolatedTs = nextBoundaryTs;
    }

    // warn: this should be removed before creating the production build
    // this is temporary to flush the data to a file for debugging
    if (block.header.height === Number(process.env.TO_BLOCK!)) {
      const redacted = convertBigIntToString(balanceHistoryWindows);
      const withReadableTS = redacted.map((e: any) => ({ ...e, ts_start: new Date(e.ts_start).toISOString(), ts_end: new Date(e.ts_end).toISOString() }));
      fs.writeFileSync('flushed-auditai-data.json', JSON.stringify(withReadableTS, null, 2));
    }

    // Write balance records to Balances table after each periodic flush
    await apiClient.sendBalances(balanceHistoryWindows);
  }
})
