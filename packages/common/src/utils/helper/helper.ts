// todo: add this to packages/common
import Big from 'big.js';
import {
  ActiveBalance,
  Chain,
  ProcessValueChangeParams,
  TransactionEvent,
  ValidatedEnvBase,
} from '../../types/interfaces/interfaces';
import {
  HistoryWindow,
  TimeWeightedBalanceEvent,
  Transaction,
} from '../../types/interfaces/interfaces';
import { createHash } from 'crypto';
import {
  ValidatedBondingCurveProtocolConfig,
  ProtocolConfig,
  ValidatedStakingProtocolConfig,
  ValidatedUniv3ProtocolConfig,
} from '../../types/interfaces/protocols';
import { Currency, MessageType, TimeWindowTrigger } from '../../types/enums';
import { VERSION, ZERO_ADDRESS } from '../consts';

function toTimeWeightedBalance(
  historyWindows: HistoryWindow[],
  protocol: ProtocolConfig | ValidatedBondingCurveProtocolConfig | ValidatedStakingProtocolConfig,
  env: ValidatedEnvBase,
  chainConfig: Chain,
): TimeWeightedBalanceEvent[] {
  return historyWindows.map((e) => {
    const eventIdComponents = `${chainConfig.networkId}-${e.userAddress}-${e.startTs}-${e.endTs}-${e.windowDurationMs}-${env.absintheApiKey}`;
    const hash = createHash('md5').update(eventIdComponents).digest('hex').slice(0, 8);

    const apiKeyHash = createHash('md5').update(env.absintheApiKey).digest('hex').slice(0, 8);

    const baseSchema = {
      version: VERSION,
      eventId: hash,
      userId: e.userAddress,
      chain: chainConfig,
      contractAddress: protocol.contractAddress.toLowerCase(),
      protocolName: protocol.name.toLowerCase(),
      protocolType: protocol.type.toLowerCase(),
      runner: {
        runnerId: 'uniswapv2_indexer_001', //todo: get the current PID/ docker-containerId
        apiKeyHash,
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
      currency: e.currency,
      valueUsd: e.valueUsd * (e.endTs - e.startTs),
    };

    return {
      base: baseSchema,
      eventType: MessageType.TIME_WEIGHTED_BALANCE,
      tokenPrice: e.tokenPrice,
      tokenDecimals: e.tokenDecimals,
      balanceBefore: e.balanceBefore,
      balanceAfter: e.balanceAfter,
      timeWindowTrigger: e.trigger,
      startUnixTimestampMs: e.startTs,
      endUnixTimestampMs: e.endTs,
      windowDurationMs: e.windowDurationMs,
      startBlockNumber: e.startBlockNumber,
      endBlockNumber: e.endBlockNumber,
      txHash: e.txHash,
    };
  });
}

function toTransaction(
  transactions: Transaction[],
  protocol: ProtocolConfig | ValidatedBondingCurveProtocolConfig | ValidatedStakingProtocolConfig,
  env: ValidatedEnvBase,
  chainConfig: Chain,
): TransactionEvent[] {
  return transactions.map((e) => {
    const hashMessage = `${chainConfig.networkId}-${e.txHash}-${e.userId}-${e.logIndex}-${env.absintheApiKey}`;
    const hash = createHash('md5').update(hashMessage).digest('hex').slice(0, 8);

    const apiKeyHash = createHash('md5').update(env.absintheApiKey).digest('hex').slice(0, 8);

    const baseSchema = {
      version: VERSION,
      eventId: hash,
      userId: e.userId,
      chain: chainConfig,
      contractAddress: protocol.contractAddress.toLowerCase(),
      protocolName: protocol.name.toLowerCase(),
      protocolType: protocol.type.toLowerCase(),
      runner: {
        runnerId: 'uniswapv2_indexer_001', //todo: get the current PID/ docker-containerId
        apiKeyHash,
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
      currency: e.currency,
      valueUsd: e.valueUsd ?? 0.0,
    };

    return {
      base: baseSchema,
      eventType: MessageType.TRANSACTION,
      rawAmount: e.rawAmount,
      displayAmount: e.displayAmount ?? 0.0,
      unixTimestampMs: e.unixTimestampMs,
      txHash: e.txHash,
      logIndex: e.logIndex,
      blockNumber: e.blockNumber,
      blockHash: e.blockHash,
      gasUsed: e.gasUsed ?? 0.0,
      gasFeeUsd: e.gasFeeUsd ?? 0.0,
    };
  });
}

function processValueChange({
  from,
  to,
  amount,
  usdValue,
  blockTimestamp,
  blockHeight,
  txHash,
  activeBalances,
  windowDurationMs,
  tokenPrice,
  tokenDecimals,
}: ProcessValueChangeParams): HistoryWindow[] {
  const historyWindows: HistoryWindow[] = [];

  function snapshotAndUpdate(userAddress: string, updatedAmount: bigint) {
    // Get the user's balance for this token
    let activeUserBalance = activeBalances.get(userAddress);
    if (!activeUserBalance) {
      // Create new user balance if it doesn't exist
      activeUserBalance = {
        balance: 0n,
        updatedBlockTs: blockTimestamp,
        updatedBlockHeight: blockHeight,
      };
      activeBalances.set(userAddress, activeUserBalance);
    }

    // Create history window if there was a previous balance
    if (activeUserBalance.balance > 0n) {
      const balanceBefore = pricePosition(tokenPrice, activeUserBalance.balance, tokenDecimals);
      historyWindows.push({
        userAddress: userAddress,
        deltaAmount: usdValue,
        trigger: TimeWindowTrigger.TRANSFER,
        startTs: activeUserBalance.updatedBlockTs,
        endTs: blockTimestamp,
        startBlockNumber: activeUserBalance.updatedBlockHeight,
        endBlockNumber: blockHeight,
        txHash: txHash,
        windowDurationMs: windowDurationMs,
        tokenPrice: tokenPrice,
        tokenDecimals: tokenDecimals,
        valueUsd: balanceBefore,
        balanceBefore: activeUserBalance.balance.toString(),
        balanceAfter: (activeUserBalance.balance + updatedAmount).toString(),
        currency: Currency.USD,
      });
    }

    // Update the balance
    activeUserBalance.balance += updatedAmount;
    activeUserBalance.updatedBlockTs = blockTimestamp;
    activeUserBalance.updatedBlockHeight = blockHeight;
  }

  function processAddress(address: string, amount: bigint) {
    if (address && address !== ZERO_ADDRESS) {
      snapshotAndUpdate(address, amount);
    }
  }

  processAddress(from, amount); // from address loses amount
  processAddress(to, amount); // to address gains amount
  return historyWindows;
}

function processValueChangeBalances({
  from,
  to,
  amount,
  usdValue,
  blockTimestamp,
  blockHeight,
  txHash,
  activeBalances,
  windowDurationMs,
  tokenPrice,
  tokenDecimals,
  tokenAddress,
}: ProcessValueChangeParams): HistoryWindow[] {
  const historyWindows: HistoryWindow[] = [];

  function snapshotAndUpdate(userAddress: string, updatedAmount: bigint) {
    console.log(updatedAmount, 'updatedAmount', userAddress, tokenAddress);
    // Get the token balances map for this token
    let tokenBalances = activeBalances.get(tokenAddress);
    if (!tokenBalances) {
      // Create new token balances map if it doesn't exist
      tokenBalances = new Map();
      activeBalances.set(tokenAddress, tokenBalances);
      console.log('Token not found, creating new map', tokenAddress);
    }

    // Get the user's balance for this token
    let activeUserBalance = tokenBalances.get(userAddress);
    if (!activeUserBalance) {
      // Create new user balance if it doesn't exist
      activeUserBalance = {
        balance: 0n,
        updatedBlockTs: blockTimestamp,
        updatedBlockHeight: blockHeight,
      };
      tokenBalances.set(userAddress, activeUserBalance);
    }

    // Create history window if there was a previous balance
    if (activeUserBalance.balance > 0n) {
      const balanceBefore = pricePosition(tokenPrice, activeUserBalance.balance, tokenDecimals);
      historyWindows.push({
        userAddress: userAddress,
        deltaAmount: usdValue,
        trigger: TimeWindowTrigger.TRANSFER,
        startTs: activeUserBalance.updatedBlockTs,
        endTs: blockTimestamp,
        startBlockNumber: activeUserBalance.updatedBlockHeight,
        endBlockNumber: blockHeight,
        txHash: txHash,
        windowDurationMs: windowDurationMs,
        tokenPrice: tokenPrice,
        tokenDecimals: tokenDecimals,
        valueUsd: balanceBefore,
        balanceBefore: activeUserBalance.balance.toString(),
        balanceAfter: (activeUserBalance.balance + updatedAmount).toString(),
        currency: Currency.USD,
      });
    }

    // Update the balance
    activeUserBalance.balance += updatedAmount;
    activeUserBalance.updatedBlockTs = blockTimestamp;
    activeUserBalance.updatedBlockHeight = blockHeight;
  }

  function processAddress(address: string, amount: bigint) {
    if (address && address !== ZERO_ADDRESS) {
      snapshotAndUpdate(address, amount);
    }
  }

  processAddress(from, amount); // from address loses amount
  processAddress(to, amount); // to address gains amount
  return historyWindows;
}

function processValueChangeUniswapV3({
  from,
  to,
  amount,
  usdValue,
  blockTimestamp,
  blockHeight,
  txHash,
  activeBalances,
  windowDurationMs,
  tickUpper,
  tickLower,
  currentTick,
  poolId,
}: {
  from: string;
  to: string;
  amount: bigint;
  usdValue: number;
  blockTimestamp: number;
  blockHeight: number;
  txHash: string;
  activeBalances: Map<string, ActiveBalance>;
  windowDurationMs: number;
  tickUpper: number;
  tickLower: number;
  currentTick: number;
  poolId: string;
}): {
  userAddress: string;
  deltaAmount: number;
  trigger: TimeWindowTrigger;
  startTs: Date;
  endTs: Date;
  startBlockNumber: number;
  endBlockNumber: number;
  txHash: string;
  windowDurationMs: number;
  valueUsd: number;
  balanceBefore: string;
  balanceAfter: string;
  currency: Currency;
  extras: any;
}[] {
  const historyWindows: any = [];

  // function snapshotAndUpdate(userAddress: string, updatedAmount: bigint) {
  //   // Handle both nested and flat map structures
  //   let tokenBalances: Map<string, ActiveBalance>;

  //   if (activeBalances instanceof Map && activeBalances.get(tokenAddress) instanceof Map) {
  //     // Nested map structure (Map<string, Map<string, ActiveBalance>>)
  //     if (!activeBalances.has(tokenAddress)) {
  //       activeBalances.set(tokenAddress, new Map());
  //     }
  //     tokenBalances = activeBalances.get(tokenAddress)!;
  //   } else {
  //     // Flat map structure (Map<string, ActiveBalance>)
  //     tokenBalances = activeBalances as Map<string, ActiveBalance>;
  //   }

  //todo: confirm this from andrew, is this correct ?- we are only pushing the balances for the tokenAddress of this user (not the user balan)

  // const prev = tokenBalances.get(userAddress) ?? {
  //   balance: 0n,
  //   updatedBlockTs: blockTimestamp,
  //   updatedBlockHeight: blockHeight,
  // };

  // if (prev.balance > 0n) {
  //   const balanceBefore = pricePosition(tokenPrice, prev.balance, tokenDecimals);
  //   historyWindows.push({
  //     id: `${userAddress}-${blockHeight}-${txHash}`,
  //     userAddress: userAddress,
  //     deltaAmount: usdValue,
  //     trigger: TimeWindowTrigger.TRANSFER,
  //     poolId: poolId,
  //     startTs: new Date(prev.updatedBlockTs).getTime(),
  //     endTs: new Date(blockTimestamp).getTime(),
  //     startBlockNumber: prev.updatedBlockHeight,
  //     endBlockNumber: blockHeight,
  //     txHash: txHash,
  //     windowDurationMs: windowDurationMs,
  //     valueUsd: balanceBefore,
  //     balanceBefore: prev.balance.toString(),
  //     balanceAfter: (prev.balance + updatedAmount).toString(),
  //     currency: Currency.USD,
  //     extras: {
  //       tickUpper,
  //       tickLower,
  //       currentTick,
  //     },
  // });
  // }

  // tokenBalances.set(userAddress, {
  //   balance: prev.balance + updatedAmount,
  //   updatedBlockTs: blockTimestamp,
  //   updatedBlockHeight: blockHeight,
  // });
  // }

  // function processAddress(address: string, amount: bigint) {
  //   if (address && address !== ZERO_ADDRESS && address !== POSITIONS_ADDRESS) {
  //     snapshotAndUpdate(address, amount);
  //   }
  // }

  // //todo: confirm this
  // processAddress(from, BigInt(-amount));
  // processAddress(to, amount);
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

function pricePosition(price: number, amount: bigint, decimals: number): number {
  return new Big(amount.toString()).div(new Big(10).pow(decimals)).mul(price).toNumber();
}

async function fetchHistoricalUsd(
  id: string,
  tsMs: number,
  coingeckoApiKey: string,
): Promise<number> {
  // const env = validateEnv();
  //todo improve
  const d = new Date(tsMs);
  const date = `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${d.getFullYear()}`;

  const url = `https://pro-api.coingecko.com/api/v3/coins/${id}/history?date=${date}&localization=false`;
  const res = await fetch(url, {
    headers: { accept: 'application/json', 'x-cg-pro-api-key': coingeckoApiKey },
  });
  const j = await res.json();
  if (!j.market_data?.current_price?.[Currency.USD]) {
    // warn: this is not a fatal error, but it should be investigated since position value will be inaccurate
    // throw new Error(`No market data found for ${id} on ${date}`);
    // console.error(`No market data found for ${id} on ${date}`);
    return 0;
  }
  return j.market_data.current_price[Currency.USD];
}

export {
  mapToJson,
  jsonToMap,
  toTimeWeightedBalance,
  toTransaction,
  processValueChange,
  processValueChangeBalances,
  pricePosition,
  fetchHistoricalUsd,
  processValueChangeUniswapV3,
};
