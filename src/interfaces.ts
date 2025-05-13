type ChainType = 'evm'; // support for other chains will be added in the future
type Currency = 'usd';

// NOTE: for the time being until we figure out a better more static version for chain information
interface Chain {
    networkId: number;
    name: string;
    chainType: ChainType;
}

interface Price {
    currency: Currency;
    tokenPrice: number;
    updatedAtMs: number;
}

interface Erc20Token {
    tokenType: 'erc20';
    tokenAddress: string;
    tokenName: string;
    tokenSymbol: string;
    decimals: number;
    price?: Price;
}

/**
 - Describes a unique data source (a protocol pool on a chain), 
   including adapter versioning and optional runtime metadata.
*/
export interface DataSource<M = unknown> {
    /**
     - Deterministic key for deduplication.
     - e.g. SHA-256(networkId:protocolName:poolAddress:adapterVersion)
    */
    sourceId: string

    /** The EVM network ID (e.g. 1 for mainnet, 137 for Polygon) */
    chainId: number

    /** Protocol identifier (e.g. 'uniswapv2', 'velodrome') (lowercased) */
    protocolName: string

    /** Contract address of the pool or token (lower-cased hex) */
    poolAddress: string

    /** Adapter version string (semver or git SHA) */
    adapterVersion: string

    /** Optional ID for the specific runner instance (for provenance/troubleshooting) */
    runnerId?: string

    /** Any additional per-source metadata (client info, tags, etc) */
    metadata?: M
}

interface BaseTimeWindow {
    startTs: number; // unix timestamp
    endTs: number; // unix timestamp
    windowDurationMs: number;
    windowId: number; // floor(startTs / window_duration)
}

interface TransferTimeWindow extends BaseTimeWindow {
    trigger: 'transfer';
    startBlocknumber: bigint;
    endBlocknumber: bigint;
    txHash: string; // todo: make it clear that it's the end boundary tx hash?
}

interface ExhaustedTimeWindow extends BaseTimeWindow {
    trigger: 'exhausted';
}

export type TimeWindow = TransferTimeWindow | ExhaustedTimeWindow;

export interface Provenance {
    runnerId: string;             // e.g. machine fingerprint
    adapterVersion: string;       // git SHA or semver
    indexedAt: number;            // unix epoch
    sourceCodeHash?: string;      // optional docker / nix hash
}

export type ActiveBalance = {
    balance: bigint,
    updated_at_block_ts: number,
    updated_at_block_height: number
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
export interface TimeWeightedBalance<M = unknown, N = unknown> {
    version: 1;
    dataType: 'time_weighted_balance';
    user: string;
    chain: Chain;
    amount: number;
    amountType: N;
    timeWindow: TimeWindow;
    protocolMetadata?: M;
    source?: DataSource;  // Reference to the data source that provided this balance. Do this later...
    // api key and timestamp and hash(api_key, timestsamp, required_values). its like _dbt_surrogate_key
}

// in a swap, we also care only about the value
export interface Transaction<M = unknown, N = unknown> {
    version: 1;
    dataType: 'transaction';
    user: string;
    chain: Chain;
    amount: number;
    amountType: N;
    timestampMs: number; // unix timestamp
    blockNumber: bigint;
    txHash: string;
    logIndex: number; // should we have an index to identify if there were multiple in a transaction
    source?: DataSource;  // Reference to the data source that provided this transaction
    protocolMetadata?: M;
}

// Usd Amount Metadata
export type UsdAmountType = {
    amountType: 'usd';
    priceFeed: 'coingecko' | 'codex';
}

export type SimpleTimeWeightedBalance = Pick<TimeWeightedBalance<Partial<UniswapV2TWBMetadata>, UsdAmountType>, 'user' | 'amount' | 'timeWindow' | 'protocolMetadata'>;
export type SimpleTransaction = Pick<Transaction<Partial<UniswapV2SwapMetadata>, UsdAmountType>, 'user' | 'amount' | 'timestampMs' | 'blockNumber' | 'txHash' | 'logIndex' | 'protocolMetadata'>;


// Uniswap Protocol Metadata
export interface UniswapV2TWBMetadata {
    poolAddress: string;
    lpTokenAmount: bigint;
}

export interface UniswapV2SwapMetadata {
    poolAddress: string;
    token0: Erc20Token;
    token1: Erc20Token;
    token0Amount: bigint;
    token1Amount: bigint;
}