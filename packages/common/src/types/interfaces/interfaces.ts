import { ProtocolConfig } from "./protocols";
import { ChainId, ChainName, ChainShortName, ChainType, Currency, EventType, MessageType, PriceFeed, TimeWindowTrigger } from "../enums";
import { Token } from "./tokens";

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
}
  
interface TransactionEvent {
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

  interface HistoryWindow {
    userAddress: string;
    deltaAmount: number;
    trigger: TimeWindowTrigger;
    startTs: number; // startUnixTimestampMs
    endTs: number; // endUnixTimestampMs
    startBlockNumber: number;
    endBlockNumber: number;
    txHash: string | null;
    windowDurationMs: number;
    balanceBeforeUsd: number; // USD value before the transfer
    balanceAfterUsd: number; // USD value after the transfer
    balanceBefore: string; // raw balance before the transfer
    balanceAfter: string; // raw balance after the transfer
}
  
  interface TimeWeightedBalanceEvent {
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
  
type ActiveBalance = {
    balance: bigint,
    updatedBlockTs: number,
    updatedBlockHeight: number
}

interface ValidatedEnv {
    dbName: string;
    dbPort?: number;
    dbUrl?: string;
    gatewayUrl: string;
    chainId: number;
    chainName: string;
    chainShortName: string;
    rpcUrl: string;
    toBlock?: number;
    balanceFlushIntervalHours: number;
    protocols: ProtocolConfig[];
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
    Transaction
}