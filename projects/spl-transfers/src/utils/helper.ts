import { Currency, MessageType } from '@absinthe/common';
import { TRACKED_TOKENS } from './conts';
import { TokenBalance } from './types';

function processTokenTransfers(
  tokenBalances: TokenBalance[],
  block: any,
  tx: string,
  valueUsd: number,
  logIndex: number,
  blockHash: string,
  blockNumber: number,
) {
  const transactions = [];
  for (const tb of tokenBalances) {
    // Ensure mint did not change
    if (tb.preMint !== tb.postMint) continue;

    const mint = tb.preMint;
    const decimals = tb.preDecimals;
    const owner = tb.preOwner;

    if (!(mint in TRACKED_TOKENS)) continue;

    const netChange = Number(tb.postAmount) - Number(tb.preAmount);
    const displayAmount = netChange / Math.pow(10, decimals);

    const transactionSchema = {
      eventType: MessageType.TRANSACTION,
      eventName: 'Transfer',
      tokens: {},
      rawAmount: netChange.toString(),
      displayAmount: displayAmount.toString(),
      unixTimestampMs: block.timestamp,
      txHash: tx,
      logIndex: logIndex,
      blockNumber: blockNumber,
      blockHash: blockHash,
      userId: owner,
      currency: Currency.USD,
      valueUsd: valueUsd,
      gasUsed: 0,
      gasFeeUsd: 0,
    };
    transactions.push(transactionSchema);
  }
  return transactions;
}

export { processTokenTransfers };
