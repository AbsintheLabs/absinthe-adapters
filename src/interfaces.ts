type ChainType = 'evm'; // support for other chains will be added in the future
type TokenType = 'erc20' | 'erc721' | 'erc1155';

// NOTE: for the time being until we figure out a better more static version for chain information
interface Chain {
    networkId: number;
    name: string;
    chainType: ChainType;
}

interface BaseToken {
    token_amount: bigint;
    token_type: TokenType;
}

interface ERC20Token extends BaseToken {
    token_type: 'erc20';
    decimals: number;
}

interface ERC721Token extends BaseToken {
    token_type: 'erc721';
}

interface ERC1155Token extends BaseToken {
    token_type: 'erc1155';
}

type Token = ERC20Token | ERC721Token | ERC1155Token;

interface PricedToken {
    type: 'priced';
    usd_denominated: number;
}

interface UnpricedToken {
    type: 'unpriced';
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
    windowId: number; // floor(startBlock / block_interval)
}

interface TransferTimeWindow extends BaseTimeWindow {
    trigger: 'transfer';
    startBlocknumber: bigint;
    endBlocknumber: bigint;
}

interface ExhaustedTimeWindow extends BaseTimeWindow {
    trigger: 'exhausted';
    startBlocknumber?: bigint;
    endBlocknumber?: bigint;
}

type TimeWindow = TransferTimeWindow | ExhaustedTimeWindow;

type Price = (PricedToken | UnpricedToken) & Token;

type dataType = 'transaction' | 'time_weighted_balance';

export interface Provenance {
    runnerId: string;             // e.g. wallet or host fingerprint
    adapterVersion: string;       // git SHA or semver
    indexedAt: number;            // unix epoch
    sourceCodeHash?: string;      // optional docker / nix hash
}

// TODO: we need a pool address or token address or something to identify the topic partition
export interface TimeWeightedBalance<M = unknown> {
    version: number;
    dataType: dataType;
    user: string;
    chain: Chain;
    price: Price;
    timeWindow: TimeWindow;
    source?: DataSource;  // Reference to the data source that provided this balance. Do this later...
    protocolMetadata?: M;
}

export interface Transaction<M = unknown> {
    version: number;
    dataType: dataType;
    user: string;
    chain: Chain;
    price: Price;
    timestamp: number; // unix timestamp
    blockNumber: bigint;
    txHash: string;
    logIndex: number; // should we have an index to identify if there were multiple in a transaction
    source: DataSource;  // Reference to the data source that provided this transaction
    protocolMetadata?: M;
}