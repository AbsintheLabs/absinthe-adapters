// This is the main executable of the squid indexer.
import fs from 'fs'; // todo; remove
import { TypeormDatabase } from '@subsquid/typeorm-store'
import { ApiClient, convertBigIntToString } from './services/apiClient';
import { processor } from './processor';
import * as velodromeAbi from './abi/velodrome'
import { processValueChange } from './utils/valueChangeHandler';
import { createDataSource } from './utils/sourceId';

const LP_TOKEN_CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS!;

// Create API client for sending data
const apiClient = new ApiClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'api_key_2'
});

// Set supportHotBlocks to false to only send finalized blocks
const db = new TypeormDatabase({ supportHotBlocks: false })

let lastInterpolatedTs: number | null = null;
const WINDOW_DURATION_MS = 3600 * 1000 * 24; // 1 day

// todo: these should be pulled from the db state on each batch run
// fix: this assumes a one token per contract scenario. With factories, we'd see multiple tokens per contract
export type ActiveBalance = { balance: bigint, updated_at_block_ts: number, updated_at_block_height: number }
export type HistoryWindow = { userAddress: string, assetAddress: string, balance: bigint, ts_start: number, ts_end: number, block_start: number, block_end: number }
const activeBalancesMap = new Map<string, Map<string, ActiveBalance>>();
const balanceHistoryWindows: HistoryWindow[] = [];

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

// processor.run() executes data processing with a handler called on each data batch.
// Data is available via ctx.blocks; handler can also use external data sources.
processor.run(db, async (ctx) => {
  // We'll make db and network operations at the end of the batch saving massively on IO
  for (let block of ctx.blocks) {
    for (let log of block.logs) {
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
    const currentTs = block.header.timestamp;
    // set the last interpolated timestamp to the current timestamp if it's not set
    if (!lastInterpolatedTs) lastInterpolatedTs = currentTs;
    while (lastInterpolatedTs + WINDOW_DURATION_MS < currentTs) {
      // Calculate how many complete windows have passed since epoch
      const windowsSinceEpoch = Math.floor(lastInterpolatedTs / WINDOW_DURATION_MS);
      // Calculate the next window boundary by multiplying by window duration
      const nextBoundaryTs: number = (windowsSinceEpoch + 1) * WINDOW_DURATION_MS;
      // ... do periodic flush for each asset in the map...
      for (let [assetAddress, mapping] of activeBalancesMap.entries()) {
        for (let [userAddress, data] of mapping.entries()) {
          const oldStart = data.updated_at_block_ts;
          if (data.balance > 0 && oldStart < nextBoundaryTs) {
            balanceHistoryWindows.push({ userAddress, assetAddress, balance: data.balance, ts_start: oldStart, ts_end: nextBoundaryTs, block_start: data.updated_at_block_height, block_end: block.header.height });
            mapping.set(userAddress, { balance: data.balance, updated_at_block_ts: nextBoundaryTs, updated_at_block_height: block.header.height });
          }
        }
      }
      lastInterpolatedTs = nextBoundaryTs;
    }

    if (block.header.height === Number(process.env.TO_BLOCK!)) {
      const redacted = convertBigIntToString(balanceHistoryWindows);
      const withReadableTS = redacted.map((e: any) => ({ ...e, ts_start: new Date(e.ts_start).toISOString(), ts_end: new Date(e.ts_end).toISOString() }));
      fs.writeFileSync('flushed-auditai-data.json', JSON.stringify(withReadableTS, null, 2));
    }

    // Write balance records to Balances table after each periodic flush
    // await apiClient.sendBalances(balanceHistoryWindows);
  }
})
