enum MessageType {
    TRANSACTION = 'transaction',
    TIME_WEIGHTED_BALANCE = 'timeWeightedBalance'
}


enum ChainType {
    EVM = 'evm',
}

enum ChainId {
    MAINNET = 1,
    POLYGON = 137,
    ARBITRUM = 42161,
    BASE = 8453,
    OPTIMISM = 10,
}

enum ChainName {
    MAINNET = 'mainnet',
    POLYGON = 'polygon',
    ARBITRUM = 'arbitrum',
    BASE = 'base',
    OPTIMISM = 'optimism',
}

enum ChainShortName {
    MAINNET = 'eth',
    POLYGON = 'polygon',
    ARBITRUM = 'arbitrum',
    BASE = 'base',
    OPTIMISM = 'optimism',
}

enum Currency {
    USD = 'usd',
    ETH = 'eth',
    BTC = 'btc',
    USDC = 'usdc',
    USDT = 'usdt',
    DAI = 'dai',
    WETH = 'weth',
    WBTC = 'wbtc',
}

enum TimeWindowTrigger {
    TRANSFER = 'transfer',
    EXHAUSTED = 'exhausted'
}


export { MessageType, ChainType, ChainId, ChainName, ChainShortName, Currency, TimeWindowTrigger };