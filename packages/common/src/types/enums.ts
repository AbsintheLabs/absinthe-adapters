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

enum PriceFeed {
    COINGECKO = 'coingecko',
    CODEX = 'codex',
}

enum Dex {
    UNISWAP_V2 = 'uniswap-v2',  
    UNISWAP_V3 = 'uniswap-v3',
    CURVE = 'curve',
    BALANCER = 'balancer',
    PANCAKESWAP = 'pancakeswap',
    JUPITER = 'jupiter',
    JUPITER_TESTNET = 'jupiter-testnet',
    SUSHISWAP = 'sushiswap',
    TRISWAP = 'triswap',
    QUICKSWAP = 'quickswap',
    PANGOLIN = 'pangolin',
    AAVE = 'aave',
    COMPOUND = 'compound',
}

enum ChainType {
    EVM = 'evm',
}

enum TokenPreference {
    FIRST = "token0",
    SECOND = "token1"
}

enum ProtocolVersion {
    V2 = "v2",
    V3 = "v3"
}

enum EventType {
    TRANSFER = "transfer",
    SWAP = "swap",
    MINT = "mint",
    BURN = "burn",
}

export { Currency, ChainId, ChainName, PriceFeed, Dex, ChainType, TokenPreference, ProtocolVersion, EventType };