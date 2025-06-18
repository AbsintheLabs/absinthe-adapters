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
  HEMI = 43111,
}

enum ChainName {
  MAINNET = 'mainnet',
  POLYGON = 'polygon',
  ARBITRUM = 'arbitrum',
  BASE = 'base',
  OPTIMISM = 'optimism',
  HEMI = 'hemi',
}

enum ChainShortName {
  MAINNET = 'eth',
  POLYGON = 'polygon',
  ARBITRUM = 'arbitrum',
  BASE = 'base',
  OPTIMISM = 'optimism',
  HEMI = 'hemi',
}

enum PriceFeed {
  COINGECKO = 'coingecko',
  CODEX = 'codex',
  INTERNAL_TWAP = 'internal-twap',
}

enum BondingCurveProtocol {
  PRINTR = 'printr',
  VUSD_MINT = 'vusd-mint',
  DEMOS = 'demos',
  VOUCHER = 'voucher',
}

enum StakingProtocol {
  HEMI = 'hemi',
  VUSDBRIDGE = 'vusd-bridge',
}

enum GatewayUrl {
  MAINNET = 'https://v2.archive.subsquid.io/network/ethereum-mainnet',
  POLYGON = 'https://v2.archive.subsquid.io/network/polygon-mainnet',
  ARBITRUM = 'https://v2.archive.subsquid.io/network/arbitrum-mainnet',
  BASE = 'https://v2.archive.subsquid.io/network/base-mainnet',
  OPTIMISM = 'https://v2.archive.subsquid.io/network/optimism-mainnet',
  HEMI = 'https://v2.archive.subsquid.io/network/hemi-mainnet',
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
  IZUMI = 'izumi',
}

enum ChainType {
  EVM = 'evm',
}

enum TokenPreference {
  FIRST = 'token0',
  SECOND = 'token1',
}

enum ProtocolVersion {
  V2 = 'v2',
  V3 = 'v3',
}

enum EventType {
  TRANSFER = 'transfer',
  SWAP = 'swap',
  MINT = 'mint',
  BURN = 'burn',
}

enum MessageType {
  TRANSACTION = 'transaction',
  TIME_WEIGHTED_BALANCE = 'timeWeightedBalance',
}

enum TimeWindowTrigger {
  TRANSFER = 'transfer',
  EXHAUSTED = 'exhausted',
}

export {
  Currency,
  ChainId,
  ChainName,
  ChainShortName,
  PriceFeed,
  Dex,
  ChainType,
  TokenPreference,
  ProtocolVersion,
  EventType,
  MessageType,
  TimeWindowTrigger,
  BondingCurveProtocol,
  StakingProtocol,
  GatewayUrl,
};
