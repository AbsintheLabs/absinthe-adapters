import { ProtocolConfig } from "./protocols";
import { ChainId, ChainName, ChainShortName, ChainType, Currency, EventType, MessageType, PriceFeed } from "../enums";
import { Token } from "./tokens";

interface Chain {
    chainArch: ChainType;
    networkId: ChainId;
    chainShortName: ChainShortName;
    chainName: ChainName;
}

// interface Price {
//     currency: Currency;
//     value: number;
//     unixTimestampMs: number;
//     source: PriceFeed;
// }

// interface Erc20Token {
//     tokenType: 'erc20';
//     tokenAddress: string;
//     tokenName: string;
//     tokenSymbol: string;
//     decimals: number;
//     price?: Price;
// }

export interface BaseEventFields {
    version: string; //default "1.0"
    eventId: string; // todo: from andrew
    userId: string; // userAddress // todo: change to userAddress
    chain: Chain;
    runner: Runner;
    protocolMetadata: ProtocolMetadataItem[]; // protocol specific metadata
    currency: Currency;
  }

interface ProtocolMetadataItem {
    key: string;
    value: string;
    type: string;
}

interface Runner {
    runnerId: string;
}

interface TokenDetails {
    token: Token;
    amount: string;      // Total amount involved - amount0 + amount1
    amountIn: string;    // Amount going into the pool
    amountOut: string;   // Amount coming out of the pool
}
  
interface TransactionEvent {
    base: BaseEventFields;
    eventType: MessageType;
    tokens: TokenDetails[];
    rawAmount: string;
    displayAmount: number; 
    unixTimestampMs: number;
    txHash: string;
    logIndex: number;
    blockNumber: number;
    blockHash: string;
  }
  
  interface TimeWeightedBalanceEvent extends BaseEventFields {
    eventType: MessageType.TIME_WEIGHTED_BALANCE;
    balanceBefore: number;
    balanceAfter: number;
    timeWindowTrigger: number;
    startUnixTimestampMs: number;
    endUnixTimestampMs: number;
    windowDurationMs: number;
    startBlockNumber?: number | null;
    endBlockNumber?: number | null;
    txHash?: string | null;
  }
  
//   type AdapterEvent = TransactionEvent | TimeWeightedBalanceEvent;

// interface BaseTimeWindow {
//     startTs: number; // unix timestamp
//     endTs: number; // unix timestamp
//     windowDurationMs: number;
//     windowId: number; // floor(startTs / window_duration)
// }

// interface TransferTimeWindow extends BaseTimeWindow {
//     trigger: EventType.TRANSFER;
//     startBlocknumber: bigint;
//     endBlocknumber: bigint;
//     txHash: string; // todo: make it clear that it's the end boundary tx hash?
// }

// interface ExhaustedTimeWindow extends BaseTimeWindow {
//     trigger: 'exhausted';
// }

// type TimeWindow = TransferTimeWindow | ExhaustedTimeWindow;

type ActiveBalance = {
    balance: bigint,
    updatedBlockTs: number,
    updatedBlockHeight: number
}

// export type SimpleHistoryWindow = {
//     userAddress: string,
//     assetAddress: string,
//     balance: bigint,
//     usdValue: number,
//     ts_start: number,
//     ts_end: number,
//     block_start?: number,
//     block_end?: number,
//     trigger: 'transfer' | 'exhausted',
//     txHash?: string
// }

// export type SimpleTransaction = {
//     userAddress: string,
//     assetAddress: string,
//     usdValue: number,
//     timestampMs: number,
//     blockNumber: bigint,
//     txHash: string,
//     logIndex: number,
// }

// TODO: we need a pool address or token address or something to identify the topic partition
// amount + type of asset + declaration of currency (mark that it's usd)
// 1 eth or 1000 usdc
// how to constrain the body of the data? + schema consistency
// can use a schema registry for the structure of that metadata + consistency
// should filter out metadata object that is larger than a certain size

// a timeweightedbalance just needs a: value to operate on

// 1) who 2) for how long 3) how much
// interface TimeWeightedBalance<M = unknown, N = unknown> {
//     version: 1;
//     dataType: 'time_weighted_balance';
//     user: string;
//     chain: Chain;
//     amount: number;
//     amountType: N;
//     timeWindow: TimeWindow;
//     protocolMetadata?: M;
//     // api key and timestamp and hash(api_key, timestsamp, required_values). its like _dbt_surrogate_key
// }

// interface ValueChangeArgs {
//     assetAddress: string      
//     from: string             
//     to: string               
//     amount: bigint            
//     usdValue: number          
//     blockTimestamp: number      
//     txHash: string
//     blockHeight: number
//     windowDurationMs: number
//     activeBalances: Map<string, ActiveBalance>
// }

// Uniswap Protocol Metadata
interface UniswapV2TWBMetadata {
    poolAddress: string;
    lpTokenAmount: bigint;
}

interface UniswapV2SwapMetadata {
    poolAddress: string;
    token0: Token;
    token1: Token;
    token0Amount: bigint;
    token1Amount: bigint;
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
    UniswapV2TWBMetadata,
    UniswapV2SwapMetadata,
    TokenDetails,
    TransactionEvent,
    ActiveBalance,
    TimeWeightedBalanceEvent

}