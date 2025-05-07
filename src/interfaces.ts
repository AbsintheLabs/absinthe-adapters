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
}

interface ExhaustedTimeWindow extends BaseTimeWindow {
    trigger: 'exhausted';
}

type TimeWindow = TransferTimeWindow | ExhaustedTimeWindow;

export interface Provenance {
    runnerId: string;             // e.g. machine fingerprint
    adapterVersion: string;       // git SHA or semver
    indexedAt: number;            // unix epoch
    sourceCodeHash?: string;      // optional docker / nix hash
}

// TODO: we need a pool address or token address or something to identify the topic partition
// amount + type of asset + declaration of currency (mark that it's usd)
// 1 eth or 1000 usdc
// how to constrain the body of the data? + schema consistency
// can use a schema registry for the structure of that metadata + consistency
// should filter out metadata object that is larger than a certain size

// a timeweightedbalance just needs a: value to operate on
export interface TimeWeightedBalance<M = unknown> {
    version: 1;
    dataType: 'time_weighted_balance';
    user: string;
    chain: Chain;
    value: number;
    timeWindow: TimeWindow;
    source?: DataSource;  // Reference to the data source that provided this balance. Do this later...
    protocolMetadata?: M;
}

// in a swap, we also care only about the value
export interface Transaction<M = unknown> {
    version: 1;
    dataType: 'transaction';
    user: string;
    chain: Chain;
    value: number;
    timestampMs: number; // unix timestamp
    blockNumber: bigint;
    txHash: string;
    logIndex: number; // should we have an index to identify if there were multiple in a transaction
    source: DataSource;  // Reference to the data source that provided this transaction
    protocolMetadata?: M;
}

// Uniswap Protocol Metadata
interface UniswapV2TWBMetadata {
    poolAddress: string;
}

interface UniswapV2SwapMetadata {
    poolAddress: string;
    token0: Erc20Token;
    token1: Erc20Token;
    token0Amount: bigint;
    token1Amount: bigint;
}