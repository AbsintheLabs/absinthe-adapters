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
  HelperProtocolConfig,
  ZebuClientConfigWithChain,
} from '../../types/interfaces/protocols';
import { ChainId, Currency, MessageType, ProtocolType, TimeWindowTrigger } from '../../types/enums';
import { VERSION, ZERO_ADDRESS } from '../consts';

function toTimeWeightedBalance(
  historyWindows: HistoryWindow[],
  protocol:
    | ProtocolConfig
    | ValidatedBondingCurveProtocolConfig
    | ValidatedStakingProtocolConfig
    | HelperProtocolConfig,
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
      protocolMetadata: e.tokens,
      currency: e.currency,
      valueUsd: e.valueUsd,
    };

    const currentTime = Date.now();

    return {
      base: baseSchema,
      eventType: MessageType.TIME_WEIGHTED_BALANCE,
      indexedTimeMs: currentTime,
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
  protocol:
    | ProtocolConfig
    | ValidatedBondingCurveProtocolConfig
    | ValidatedStakingProtocolConfig
    | HelperProtocolConfig
    | (ZebuClientConfigWithChain & { type: ProtocolType }),
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
      protocolMetadata: e.tokens,
      currency: e.currency,
      valueUsd: e.valueUsd ?? 0.0,
    };

    const currentTime = Date.now();

    return {
      base: baseSchema,
      eventType: MessageType.TRANSACTION,
      indexedTimeMs: currentTime,
      eventName: e.eventName,
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
        tokens: {},
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
    // Get the token balances map for this token
    let tokenBalances = activeBalances.get(tokenAddress);
    if (!tokenBalances) {
      // Create new token balances map if it doesn't exist
      tokenBalances = new Map();
      activeBalances.set(tokenAddress, tokenBalances);
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
      const balanceBeforeInUSD = pricePosition(
        tokenPrice,
        activeUserBalance.balance,
        tokenDecimals,
      );
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
        valueUsd: balanceBeforeInUSD,
        balanceBefore: activeUserBalance.balance.toString(),
        balanceAfter: (activeUserBalance.balance + updatedAmount).toString(),
        currency: Currency.USD,
        tokens: {}
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

  // Better validation
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    console.warn('jsonToMap: Invalid json input, returning empty map');
    return result;
  }

  try {
    for (const [key, value] of Object.entries(json)) {
      if (key === '__metadata') continue;

      // Validate the value structure
      if (!value || typeof value !== 'object' || !value.balance) {
        console.warn(`jsonToMap: Invalid value for key ${key}, skipping`);
        continue;
      }

      result.set(key, {
        balance: BigInt(value.balance),
        updatedBlockTs: value.updatedBlockTs,
        updatedBlockHeight: value.updatedBlockHeight,
      });
    }
  } catch (error) {
    console.error('jsonToMap: Error processing json:', error);
    return new Map(); // Return empty map on error
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
  try {
    const d = new Date(tsMs);
    const date = `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${d.getFullYear()}`;

    const url = `https://pro-api.coingecko.com/api/v3/coins/${id}/history?date=${date}&localization=false`;
    const res = await fetch(url, {
      headers: { accept: 'application/json', 'x-cg-pro-api-key': coingeckoApiKey },
    });

    if (!res.ok) {
      // console.warn(`CoinGecko API error for ${id}: ${res.status} ${res.statusText}`);
      return 0;
    }

    const j = await res.json();
    if (!j.market_data?.current_price?.[Currency.USD]) {
      console.warn(`No market data found for ${id} on ${date}`);
      return 0;
    }

    return j.market_data.current_price[Currency.USD];
  } catch (error) {
    console.warn(`Failed to fetch historical USD price for ${id}:`, error);
    return 0;
  }
}

export async function getCoingeckoIdFromAddress(
  chainPlatform: string,
  tokenAddress: string,
  coingeckoApiKey: string,
): Promise<string | null> {
  try {
    const url = `https://pro-api.coingecko.com/api/v3/coins/${chainPlatform}/contract/${tokenAddress}`;

    const response = await fetch(url, {
      headers: { accept: 'application/json', 'x-cg-pro-api-key': coingeckoApiKey },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Token ${tokenAddress} not found in CoinGecko`);
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id || null;
  } catch (error) {
    console.warn(`Failed to get CoinGecko ID for token ${tokenAddress}:`, error);
    return null;
  }
}

function getChainEnumKey(chainId: number): keyof typeof ChainId | null {
  const chainIdEntries = Object.entries(ChainId) as [keyof typeof ChainId, number][];
  const found = chainIdEntries.find(([, value]) => value === chainId);
  return found ? found[0] : null;
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
  getChainEnumKey,
};
