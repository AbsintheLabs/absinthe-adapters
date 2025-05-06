// This is the main executable of the squid indexer.
import fs from 'fs'; // todo; remove
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


// // Create data source for this specific protocol
// const PROTOCOL_NAME = "velodrome";
// const CHAIN_ID = 10; // Optimism
// const ADAPTER_VERSION = "1.0.0";
// const dataSource = createDataSource(
//   CHAIN_ID,
//   PROTOCOL_NAME,
//   LP_TOKEN_CONTRACT_ADDRESS,
//   ADAPTER_VERSION,
//   "squid-processor-1" // runner ID
// );

const priceCache = new Map<string, Map<Date, number>>();

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
  const price = priceResp.market_data.current_price.usd;
  return price;
}

// processor.run() executes data processing with a handler called on each data batch.
// Data is available via ctx.blocks; handler can also use external data sources.
processor.run(db, async (ctx) => {
  // We'll make db and network operations at the end of the batch saving massively on IO
  for (let block of ctx.blocks) {
    for (let log of block.logs) {
      // todo; make this more efficient by moving the contract call if we don't have the price
      const contract = new velodromeAbi.Contract(ctx, block.header, LP_TOKEN_CONTRACT_ADDRESS);
      const token0 = await contract.token0();
      const token1 = await contract.token1();
      const token0Contract = new erc20Abi.Contract(ctx, block.header, token0);
      const token1Contract = new erc20Abi.Contract(ctx, block.header, token1);
      const token0Decimals = await token0Contract.decimals();
      const token1Decimals = await token1Contract.decimals();
      const lpDecimals = await contract.decimals();
      const reserve = await contract.getReserves();
      const totalSupply = await contract.totalSupply();

      const r0 = reserve._reserve0;
      const r1 = reserve._reserve1;
      const token0Price = new Big(5); // for sake of example
      const token1Price = new Big(10); // for sake of example

      // Calculate token0 value in USD
      const token0Value = new Big(r0.toString())
        .div(new Big(10).pow(token0Decimals))
        .mul(token0Price);

      // Calculate token1 value in USD
      const token1Value = new Big(r1.toString())
        .div(new Big(10).pow(token1Decimals))
        .mul(token1Price);

      // Total value in the pool
      const totalPoolValue = token0Value.add(token1Value);

      // Calculate price per LP token
      const price = totalPoolValue
        .div(new Big(totalSupply.toString())
          .div(new Big(10).pow(lpDecimals)))
        .toNumber();
      console.log(`price: ${price}`);

      // Case 1: Emit events on transfer
      if (log.address === LP_TOKEN_CONTRACT_ADDRESS && log.topics[0] === velodromeAbi.events.Transfer.topic) {
        const { from, to, value } = velodromeAbi.events.Transfer.decode(log);
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
