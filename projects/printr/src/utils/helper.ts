// todo: add this to packages/common

import {
  BondingCurveProtocolConfig,
  Chain,
  Currency,
  MessageType,
  Transaction,
  TransactionEvent,
  ValidatedEnvBase,
  validateEnv,
} from '@absinthe/common';
import { createHash } from 'crypto';

const env = validateEnv();

function toTransaction(
  transactions: Transaction[],
  bondingCurveProtocol: BondingCurveProtocolConfig,
  env: ValidatedEnvBase,
  chainConfig: Chain,
): TransactionEvent[] {
  return transactions.map((e) => {
    const hashMessage = `${chainConfig.networkId}-${e.txHash}-${e.userId}-${e.logIndex}-${env.absintheApiKey}`;
    const hash = createHash('md5').update(hashMessage).digest('hex').slice(0, 8);
    const baseSchema = {
      version: '1.0',
      eventId: hash,
      userId: e.userId,
      chain: {
        chainArch: chainConfig.chainArch,
        networkId: chainConfig.networkId,
        chainShortName: chainConfig.chainShortName,
        chainName: chainConfig.chainName,
      },
      runner: {
        runnerId: 'printr_indexer_001', //todo: get the current PID/ docker-containerId
      },
      protocolMetadata: [
        {
          key: 'poolAddress',
          value: bondingCurveProtocol.contractAddress,
          type: 'address',
        },
        {
          key: 'protocolName',
          value: 'printr',
          type: 'string',
        },
        {
          key: 'tokens',
          value: e.tokens,
          type: 'string',
        },
      ],
      currency: e.currency,
    };

    return {
      base: baseSchema,
      eventType: MessageType.TRANSACTION,
      rawAmount: e.rawAmount,
      displayAmount: e.displayAmount,
      unixTimestampMs: e.unixTimestampMs,
      txHash: e.txHash,
      logIndex: e.logIndex,
      blockNumber: e.blockNumber,
      blockHash: e.blockHash,
    };
  });
}

export async function fetchHistoricalUsd(id: string, tsMs: number): Promise<number> {
  const d = new Date(tsMs);
  const date = `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${d.getFullYear()}`;

  const url = `https://pro-api.coingecko.com/api/v3/coins/${id}/history?date=${date}&localization=false`;
  const res = await fetch(url, {
    headers: { accept: 'application/json', 'x-cg-pro-api-key': env.baseConfig.coingeckoApiKey },
  });
  const j = await res.json();
  if (!j.market_data?.current_price?.[Currency.USD]) {
    // warn: this is not a fatal error, but it should be investigated since position value will be inaccurate
    // throw new Error(`No market data found for ${id} on ${date}`);
    console.error(`No market data found for ${id} on ${date}`);
    return 0;
  }
  return j.market_data.current_price[Currency.USD];
}

export { toTransaction };
