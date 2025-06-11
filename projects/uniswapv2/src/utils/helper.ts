// todo: add this to packages/common

import { ActiveBalance, ValidatedEnv } from '@absinthe/common';
import {
  ChainId,
  ChainName,
  ChainShortName,
  ChainType,
  Currency,
  HistoryWindow,
  MessageType,
  ProtocolConfig,
  TimeWeightedBalanceEvent,
  Transaction,
  TransactionEvent,
  TimeWindowTrigger,
  ZERO_ADDRESS,
} from '@absinthe/common';
import { pricePosition } from './pricing';
import { ProcessValueChangeParams } from './types';
import { createHash } from 'crypto';

function toTimeWeightedBalance(
  historyWindows: HistoryWindow[],
  protocol: ProtocolConfig,
  env: ValidatedEnv,
): TimeWeightedBalanceEvent[] {
  return historyWindows.map((e) => {
    const eventIdComponents = `${ChainId.MAINNET}-${e.userAddress}-${e.startTs}-${e.endTs}-${e.windowDurationMs}-${env.absintheApiKey}`;
    const hash = createHash('md5').update(eventIdComponents).digest('hex').slice(0, 8);
    const baseSchema = {
      version: '1.0',
      eventId: hash,
      userId: e.userAddress,
      chain: {
        chainArch: env.chainArch,
        networkId: env.chainId,
        chainShortName: env.chainShortName,
        chainName: env.chainName,
      },
      runner: {
        runnerId: 'uniswapv2_indexer_001', //todo: get the current PID/ docker-containerId
      },
      protocolMetadata: [
        {
          key: 'poolAddress',
          value: protocol.contractAddress,
          type: 'address',
        },
        {
          key: 'protocolName',
          value: 'uniswapv2',
          type: 'string',
        },
      ],
      currency: Currency.USD,
    };

    return {
      base: baseSchema,
      eventType: MessageType.TIME_WEIGHTED_BALANCE,
      balanceBeforeUsd: e.balanceBeforeUsd,
      balanceAfterUsd: e.balanceAfterUsd,
      balanceBefore: e.balanceBefore,
      balanceAfter: e.balanceAfter,
      timeWindowTrigger: e.trigger,
      startUnixTimestampMs: e.startTs,
      endUnixTimestampMs: e.endTs,
      windowDurationMs: e.windowDurationMs,
      startBlockNumber: e.startBlockNumber,
      endBlockNumber: e.endBlockNumber,
      txHash: e.txHash,
      exposureUsdMs: e.balanceBeforeUsd * (e.endTs - e.startTs),
    };
  });
}

function toTransaction(
  transactions: Transaction[],
  protocol: ProtocolConfig,
  env: ValidatedEnv,
): TransactionEvent[] {
  return transactions.map((e) => {
    const hashMessage = `${env.chainId}-${e.txHash}-${e.userId}-${e.logIndex}-${env.absintheApiKey}`;
    const hash = createHash('md5').update(hashMessage).digest('hex').slice(0, 8);
    const baseSchema = {
      version: '1.0',
      eventId: hash,
      userId: e.userId,
      chain: {
        chainArch: env.chainArch,
        networkId: env.chainId,
        chainShortName: env.chainShortName,
        chainName: env.chainName,
      },
      runner: {
        runnerId: 'uniswapv2_indexer_001', //todo: get the current PID/ docker-containerId
      },
      protocolMetadata: [
        {
          key: 'poolAddress',
          value: protocol.contractAddress,
          type: 'address',
        },
        {
          key: 'protocolName',
          value: 'uniswapv2',
          type: 'string',
        },
        {
          key: 'tokens',
          value: e.tokens,
          type: 'string',
        },
      ],
      currency: Currency.USD,
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

function processValueChange({
  from,
  to,
  amount,
  lpTokenSwapUsdValue,
  blockTimestamp,
  blockHeight,
  txHash,
  activeBalances,
  windowDurationMs,
  lpTokenPrice,
  lpTokenDecimals,
}: ProcessValueChangeParams): HistoryWindow[] {
  const historyWindows: HistoryWindow[] = [];
  function snapshotAndUpdate(userAddress: string, updatedAmount: bigint) {
    const prev = activeBalances.get(userAddress) ?? {
      balance: 0n,
      updatedBlockTs: blockTimestamp,
      updatedBlockHeight: blockHeight,
    };

    if (prev.balance > 0n) {
      const balanceBefore = pricePosition(lpTokenPrice, prev.balance, lpTokenDecimals);
      const balanceAfter = pricePosition(
        lpTokenPrice,
        prev.balance + updatedAmount,
        lpTokenDecimals,
      );
      historyWindows.push({
        userAddress: userAddress,
        deltaAmount: lpTokenSwapUsdValue,
        trigger: TimeWindowTrigger.TRANSFER,
        startTs: prev.updatedBlockTs,
        endTs: blockTimestamp,
        startBlockNumber: prev.updatedBlockHeight,
        endBlockNumber: blockHeight,
        txHash: txHash,
        windowDurationMs: windowDurationMs,
        balanceBeforeUsd: balanceBefore,
        balanceAfterUsd: balanceAfter,
        balanceBefore: prev.balance.toString(),
        balanceAfter: (prev.balance + updatedAmount).toString(),
      });
    }

    activeBalances.set(userAddress, {
      balance: prev.balance + updatedAmount,
      updatedBlockTs: blockTimestamp,
      updatedBlockHeight: blockHeight,
    });
  }

  if (from && from !== ZERO_ADDRESS) {
    snapshotAndUpdate(from, BigInt(-amount));
  }
  // if tokens reached a user, add, but ignore zero address
  if (to && to !== ZERO_ADDRESS) {
    snapshotAndUpdate(to, amount);
  }
  return historyWindows;
}

function mapToJson(map: Map<string, ActiveBalance>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of map.entries()) {
    result[key] = {
      balance: value.balance.toString(),
      updatedBlockTs: value.updatedBlockTs,
      updatedBlockHeight: value.updatedBlockHeight,
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
      updatedBlockTs: value.updatedBlockTs,
      updatedBlockHeight: value.updatedBlockHeight,
    });
  }
  return result;
}

export { mapToJson, jsonToMap, toTimeWeightedBalance, toTransaction, processValueChange };
