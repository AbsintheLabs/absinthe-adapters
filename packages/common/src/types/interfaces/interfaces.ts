import { ProtocolConfig } from './protocols';
import {
  ChainId,
  ChainName,
  ChainShortName,
  ChainType,
  Currency,
  Dex,
  MessageType,
  TimeWindowTrigger,
} from '../enums';
import { Token } from './tokens';

interface Chain {
  chainArch: ChainType;
  networkId: ChainId;
  chainShortName: ChainShortName;
  chainName: ChainName;
}
interface BaseEventFields {
  version: string;
  eventId: string;
  userId: string;
  chain: Chain;
  runner: Runner;
  protocolMetadata: ProtocolMetadataItem[];
  currency: Currency;
}

interface ProtocolMetadataItem {
  key: string;
  value: any;
  type: string;
}

interface Runner {
  runnerId: string;
}

interface TokenDetails {
  token: Token;
  amount: string;
  amountIn: string;
  amountOut: string;
}

interface Transaction {
  eventType: MessageType;
  tokens: string;
  rawAmount: string;
  displayAmount: number;
  unixTimestampMs: number;
  txHash: string;
  logIndex: number;
  blockNumber: number;
  blockHash: string;
  userId: string;
  gasUsed: number;
  gasFeeUsd: number;
  currency: Currency;
  valueUsd: number;
}

interface TransactionEvent {
  base: BaseEventFields;
  eventType: MessageType;
  rawAmount: string;
  displayAmount: number;
  unixTimestampMs: number;
  txHash: string;
  logIndex: number;
  gasUsed: number;
  gasFeeUsd: number;
  blockNumber: number;
  blockHash: string;
}

interface HistoryWindow {
  userAddress: string;
  deltaAmount: number;
  trigger: TimeWindowTrigger;
  startTs: number; // startUnixTimestampMs
  endTs: number; // endUnixTimestampMs
  startBlockNumber: number;
  endBlockNumber: number;
  txHash: string | null;
  currency: Currency;
  windowDurationMs: number;
  lpTokenPrice: number;
  lpTokenDecimals: number;
  valueUsd: number;
  balanceBefore: string; // raw balance before the transfer
  balanceAfter: string; // raw balance after the transfer
}

interface TimeWeightedBalanceEvent {
  base: BaseEventFields;
  eventType: MessageType;
  lpTokenPrice: number;
  lpTokenDecimals: number;
  balanceBefore: string;
  balanceAfter: string;
  timeWindowTrigger: TimeWindowTrigger;
  startUnixTimestampMs: number;
  endUnixTimestampMs: number;
  windowDurationMs: number;
  startBlockNumber: number;
  endBlockNumber: number;
  txHash: string | null;
  exposureUsdMs: number;
}

type ActiveBalance = {
  balance: bigint;
  updatedBlockTs: number;
  updatedBlockHeight: number;
};

interface ValidatedEnv {
  type: Dex;
  gatewayUrl: string;
  chainId: ChainId;
  chainName: ChainName;
  chainShortName: ChainShortName;
  chainArch: ChainType;
  rpcUrl: string;
  toBlock: number;
  protocols: ProtocolConfig[];
}

interface ValidatedEnvBase {
  balanceFlushIntervalHours: number;
  absintheApiUrl: string;
  absintheApiKey: string;
  coingeckoApiKey: string;
}

export {
  Chain,
  ValidatedEnv,
  TokenDetails,
  TransactionEvent,
  ActiveBalance,
  TimeWeightedBalanceEvent,
  HistoryWindow,
  Transaction,
  ValidatedEnvBase,
};
