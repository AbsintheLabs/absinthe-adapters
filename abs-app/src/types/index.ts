import {
  ChainType,
  ChainId,
  ChainShortName,
  ChainName,
  Currency,
  MessageType,
  TimeWindowTrigger,
} from './enums';

export interface ApiKeyConfig {
  points: number;
  duration: number;
}

export interface ApiKeys {
  [key: string]: ApiKeyConfig;
}

export interface RateLimiters {
  [key: string]: any; // RateLimiterMemory type
}

export interface LogEntry {
  timestamp: string;
  data: any;
}

export interface Chain {
  chainArch: ChainType;
  networkId: ChainId;
  chainShortName: ChainShortName;
  chainName: ChainName;
}

export interface Runner {
  runnerId: string;
}

export interface ProtocolMetadataItem {
  key: string;
  value: any;
  type: string;
}

export interface BaseEventFields {
  version: string;
  eventId: string;
  userId: string;
  chain: Chain;
  runner: Runner;
  protocolMetadata: ProtocolMetadataItem[];
  currency: Currency;
}

export interface TransactionEvent {
  base: BaseEventFields;
  eventType: MessageType;
  rawAmount: string;
  displayAmount: number;
  unixTimestampMs: number;
  txHash: string;
  logIndex: number;
  blockNumber: number;
  blockHash: string;
}

export interface TimeWeightedBalanceEvent {
  base: BaseEventFields;
  eventType: MessageType;
  balanceBeforeUsd: number;
  balanceAfterUsd: number;
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
