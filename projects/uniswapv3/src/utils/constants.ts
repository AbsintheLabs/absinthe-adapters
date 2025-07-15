export const WETH_ADDRESS = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
export const USDC_WETH_03_POOL = '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8';
export const FACTORY_ADDRESS = '0x1f98431c8ad98523631ae4a59f267346ea31f984';
export const POSITIONS_ADDRESS = '0xc36442b4a4522e871399cd717abdd847ab11fe88';
export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';
export const MULTICALL_ADDRESS = '0x5ba1e12693dc8f9c48aad8770482f4739beed696';
export const MULTICALL_PAGE_SIZE = 100;

// token where amounts should contribute to tracked volume and liquidity
// usually tokens that many tokens are paired with s
export const WHITELIST_TOKENS: string[] = [
  WETH_ADDRESS, // WETH
  '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
  '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
  '0x0000000000085d4780b73119b644ae5ecd22b376', // TUSD
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
  '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643', // cDAI
  '0x39aa39c021dfbae8fac545936693ac917d5e7563', // cUSDC
  '0x86fadb80d8d2cff3c3680819e4da99c10232ba0f', // EBASE
  '0x57ab1ec28d129707052df4df418d58a2d46d5f51', // sUSD
  '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2', // MKR
  '0xc00e94cb662c3520282e6f5717214004a7f26888', // COMP
  '0x514910771af9ca656af840dff83e8264ecf986ca', // LINK
  '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f', // SNX
  '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e', // YFI
  '0x111111111117dc0aa78b770fa6a738034120c302', // 1INCH
  '0xdf5e0e81dff6faf3a7e52ba697820c5e32d806a8', // yCurv
  '0x956f47f50a910163d8bf957cf5846d573e7f87ca', // FEI
  '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0', // MATIC
  '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9', // AAVE
  '0xfe2e637202056d30016725477c5da089ab0a043a', // sETH2
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', // UNI
];

export const WHITELIST_TOKENS_WITH_COINGECKO_ID: {
  symbol: string;
  address: string;
  coingeckoId: string;
}[] = [
  {
    symbol: 'WETH',
    address: WETH_ADDRESS,
    coingeckoId: 'weth',
  },
  {
    symbol: 'DAI',
    address: '0x6b175474e89094c44da98b954eedeac495271d0f',
    coingeckoId: 'dai',
  },
  {
    symbol: 'USDC',
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    coingeckoId: 'usd-coin',
  },
  {
    symbol: 'USDT',
    address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    coingeckoId: 'tether',
  },
  {
    symbol: 'TUSD',
    address: '0x0000000000085d4780b73119b644ae5ecd22b376',
    coingeckoId: 'true-usd',
  },
  {
    symbol: 'WBTC',
    address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    coingeckoId: 'wrapped-bitcoin',
  },
  {
    symbol: 'cDAI',
    address: '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643',
    coingeckoId: 'compound-dai',
  },
  {
    symbol: 'cUSDC',
    address: '0x39aa39c021dfbae8fac545936693ac917d5e7563',
    coingeckoId: 'compound-usd-coin',
  },
  {
    symbol: 'EBASE',
    address: '0x86fadb80d8d2cff3c3680819e4da99c10232ba0f',
    coingeckoId: 'ebase', // listed under “ebase” on some data providers :contentReference[oaicite:1]{index=1}
  },
  {
    symbol: 'sUSD',
    address: '0x57ab1ec28d129707052df4df418d58a2d46d5f51',
    coingeckoId: 'nusd',
  },
  {
    symbol: 'MKR',
    address: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',
    coingeckoId: 'maker',
  },
  {
    symbol: 'COMP',
    address: '0xc00e94cb662c3520282e6f5717214004a7f26888',
    coingeckoId: 'compound-governance-token',
  },
  {
    symbol: 'LINK',
    address: '0x514910771af9ca656af840dff83e8264ecf986ca',
    coingeckoId: 'chainlink',
  },
  {
    symbol: 'SNX',
    address: '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
    coingeckoId: 'havven',
  },
  {
    symbol: 'YFI',
    address: '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e',
    coingeckoId: 'yearn-finance',
  },
  {
    symbol: '1INCH',
    address: '0x111111111117dc0aa78b770fa6a738034120c302',
    coingeckoId: '1inch',
  },
  {
    symbol: 'yCurv',
    address: '0xdf5e0e81dff6faf3a7e52ba697820c5e32d806a8',
    coingeckoId: 'curve-fi-ydai', // example vault; adjust per curve pool
  },
  {
    symbol: 'FEI',
    address: '0x956f47f50a910163d8bf957cf5846d573e7f87ca',
    coingeckoId: 'fei-usd',
  },
  {
    symbol: 'MATIC',
    address: '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0',
    coingeckoId: 'matic-network',
  },
  {
    symbol: 'AAVE',
    address: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
    coingeckoId: 'aave',
  },
  {
    symbol: 'sETH2',
    address: '0xfe2e637202056d30016725477c5da089ab0a043a',
    coingeckoId: 'seth2', // confirmed on CoinGecko :contentReference[oaicite:2]{index=2}
  },
  {
    symbol: 'UNI',
    address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
    coingeckoId: 'uniswap',
  },
];

export let MINIMUM_ETH_LOCKED = 60;
