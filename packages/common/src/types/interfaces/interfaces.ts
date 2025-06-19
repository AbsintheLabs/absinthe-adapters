import {
  ChainId,
  ChainName,
  ChainShortName,
  ChainType,
  Currency,
  MessageType,
  TimeWindowTrigger,
} from '../enums';
import { Token } from './protocols';

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
  valueUsd: number;
}

interface ProtocolState {
  balanceWindows: HistoryWindow[];
  transactions: Transaction[];
}

interface BatchContext {
  ctx: any;
  block: any;
  protocolStates: Map<string, any>; // todo: remove any
}

interface ProcessValueChangeParams {
  from: string;
  to: string;
  amount: bigint;
  usdValue: number;
  blockTimestamp: number;
  blockHeight: number;
  txHash: string;
  activeBalances: any; // todo: remove any
  windowDurationMs: number;
  tokenPrice: number;
  tokenDecimals: number;
  tokenAddress?: string;
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
  tokenPrice: number;
  tokenDecimals: number;
  valueUsd: number;
  balanceBefore: string; // raw balance before the transfer
  balanceAfter: string; // raw balance after the transfer
}

interface TimeWeightedBalanceEvent {
  base: BaseEventFields;
  eventType: MessageType;
  tokenPrice: number;
  tokenDecimals: number;
  balanceBefore: string;
  balanceAfter: string;
  timeWindowTrigger: TimeWindowTrigger;
  startUnixTimestampMs: number;
  endUnixTimestampMs: number;
  windowDurationMs: number;
  startBlockNumber: number;
  endBlockNumber: number;
  txHash: string | null;
}

type ActiveBalance = {
  balance: bigint;
  updatedBlockTs: number;
  updatedBlockHeight: number;
};

interface ValidatedEnvBase {
  balanceFlushIntervalHours: number;
  absintheApiUrl: string;
  absintheApiKey: string;
  coingeckoApiKey: string;
  sendToApiFromTimestamp?: number; // Unix timestamp in milliseconds
}

export {
  Chain,
  TokenDetails,
  TransactionEvent,
  ActiveBalance,
  TimeWeightedBalanceEvent,
  HistoryWindow,
  Transaction,
  ValidatedEnvBase,
  ProtocolState,
  BatchContext,
  ProcessValueChangeParams,
};
