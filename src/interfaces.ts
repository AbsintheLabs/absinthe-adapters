type ChainType = 'evm'; // support for other chains will be added in the future
type TokenType = 'erc20' | 'erc721' | 'erc1155';

// NOTE: for the time being until we figure out a better more static version for chain information
interface Chain {
    networkId: number;
    name: string;
}

interface BaseToken {
    token_amount: bigint;
    token_type: TokenType;
    chain: Chain;
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

type Price = (PricedToken | UnpricedToken) & Token;

type dataType = 'transaction' | 'time_weighted_balance';

export interface TimeWeightedBalance<M = unknown> {
    dataType: dataType;
    user: string;
    chainType: ChainType;
    price: Price;
    startTs: number; // unix timestamp
    endTs: number; // unix timestamp
    startBlocknumber: bigint;
    endBlocknumber: bigint;
    txHash?: string;
    metadata?: M;
}

export interface Transaction<M = unknown> {
    dataType: dataType;
    user: string;
    chainType: ChainType;
    price: Price;
    timestamp: number; // unix timestamp
    blockNumber: bigint;
    txHash: string;
    logIndex: number; // should we have an index to identify if there were multiple in a transaction
    metadata?: M;
}