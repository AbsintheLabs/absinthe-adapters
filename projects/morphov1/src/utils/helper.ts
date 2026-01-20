import {
  ActiveBalance,
  Chain,
  Currency,
  HelperProtocolConfig,
  HistoryWindow,
  MessageType,
  pricePosition,
  ProcessValueChangeBalancesParams,
  ProtocolConfig,
  TimeWeightedBalanceEvent,
  TimeWindowTrigger,
  ValidatedEnvBase,
  ValidatedStakingProtocolConfig,
  ValidatedTxnTrackingProtocolConfig,
  VERSION,
  ZERO_ADDRESS,
} from '@absinthe/common';
import { TOKEN_METADATA } from './conts';
import { MarketDataType, TokenMetadata } from './types';
import { createHash } from 'crypto';

function flattenNestedMap(
  nestedMap: Map<string, Map<string, ActiveBalance>>,
): Map<string, ActiveBalance> {
  const flatMap = new Map<string, ActiveBalance>();
  for (const [tokenAddress, userBalances] of nestedMap.entries()) {
    for (const [userAddress, balance] of userBalances.entries()) {
      flatMap.set(`${tokenAddress}-${userAddress}`, balance);
    }
  }
  return flatMap;
}

function flattenNestedMapMarketData(
  nestedMap: Map<string, Map<string, MarketDataType>>,
): Map<string, MarketDataType> {
  const flatMap = new Map<string, MarketDataType>();
  for (const [marketId, userBalances] of nestedMap.entries()) {
    for (const [userAddress, balance] of userBalances.entries()) {
      flatMap.set(`${marketId}-${userAddress}`, balance);
    }
  }
  return flatMap;
}

function mapToJsonMarketData(map: Map<string, MarketDataType>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of map.entries()) {
    result[key] = {
      loanToken: value.loanToken,
      collateralToken: value.collateralToken,
      oracle: value.oracle,
      irm: value.irm,
      lltv: value.lltv.toString(),
      borrowIndex: value.borrowIndex.toString(),
      supplyIndex: value.supplyIndex.toString(),
    };
  }
  return result;
}

function checkToken(token: string): TokenMetadata | null {
  let tokenMetadata = TOKEN_METADATA.find((t) => t.address.toLowerCase() === token.toLowerCase());
  if (!tokenMetadata) {
    console.warn(`Ignoring deposit for unsupported token: ${token}`);
    return null;
  }

  return tokenMetadata;
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
  tokens,
  marketId,
}: ProcessValueChangeBalancesParams): HistoryWindow[] {
  const historyWindows: HistoryWindow[] = [];

  function snapshotAndUpdate(userAddress: string, updatedAmount: bigint) {
    let marketBalances = activeBalances.get(marketId);
    if (!marketBalances) {
      marketBalances = new Map();
      activeBalances.set(marketId, marketBalances);
    }

    let activeUserBalance = marketBalances.get(userAddress);
    if (!activeUserBalance) {
      activeUserBalance = {
        balance: 0n,
        updatedBlockTs: blockTimestamp,
        updatedBlockHeight: blockHeight,
      };
      marketBalances.set(userAddress, activeUserBalance);
    }

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
        tokens: tokens,
      });
    } else if (updatedAmount > 0n) {
      historyWindows.push({
        userAddress: userAddress,
        deltaAmount: usdValue,
        trigger: TimeWindowTrigger.TRANSFER,
        startTs: blockTimestamp, // Same as end timestamp for first time
        endTs: blockTimestamp,
        startBlockNumber: blockHeight, // Same as end block for first time
        endBlockNumber: blockHeight,
        txHash: txHash,
        windowDurationMs: windowDurationMs,
        tokenPrice: tokenPrice,
        tokenDecimals: tokenDecimals,
        valueUsd: 0,
        balanceBefore: '0', // Previous balance was 0
        balanceAfter: updatedAmount.toString(),
        currency: Currency.USD,
        tokens: tokens,
      });
    }
    activeUserBalance.balance += updatedAmount;
    activeUserBalance.updatedBlockTs = blockTimestamp;
    activeUserBalance.updatedBlockHeight = blockHeight;
  }

  function processAddress(address: string, amount: bigint) {
    if (address && address !== ZERO_ADDRESS) {
      snapshotAndUpdate(address, amount);
    }
  }
  processAddress(from, BigInt(-amount)); // from address loses amount
  processAddress(to, amount); // to address gains amount
  return historyWindows;
}

function toTimeWeightedBalance(
  historyWindows: HistoryWindow[],
  protocol:
    | ProtocolConfig
    | ValidatedTxnTrackingProtocolConfig
    | ValidatedStakingProtocolConfig
    | HelperProtocolConfig,
  env: ValidatedEnvBase,
  chainConfig: Chain,
): TimeWeightedBalanceEvent[] {
  return historyWindows.map((e) => {
    const eventIdComponents = `${chainConfig.networkId}-${e.userAddress}-${e.startTs}-${e.endTs}-${e.windowDurationMs}-${env.absintheApiKey}-${e.type || ''}-${e.tokens.positionSide.value || ''}`;
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

export {
  flattenNestedMap,
  checkToken,
  flattenNestedMapMarketData,
  mapToJsonMarketData,
  processValueChangeBalances,
  toTimeWeightedBalance,
};
