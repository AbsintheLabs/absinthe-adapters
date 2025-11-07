const LIQUIDITY_FEE = 3000;
const LIQUIDITY_FEE_BSC = 2500;

const CHAIN_BASE_TOKENS = [
  { address: '0x4200000000000000000000000000000000000006', name: 'WETH', coingeckoId: 'ethereum' }, //WETH on Base
  {
    address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
    name: 'BNB',
    coingeckoId: 'binancecoin',
  }, //BNB on Binance
  {
    address: '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7',
    name: 'AVAX',
    coingeckoId: 'avalanche-2',
  }, //AVAX on Avalanche
  { address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', name: 'WETH', coingeckoId: 'ethereum' }, //WETH on Ethereum
  { address: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', name: 'WETH', coingeckoId: 'ethereum' }, //WETH on Arbitrum
  { address: '0x3bd359c1119da7da1d913d1c4d2b7c461115433a', name: 'WMON', coingeckoId: 'monad' }, //WMON on Monad
];

export { LIQUIDITY_FEE, LIQUIDITY_FEE_BSC, CHAIN_BASE_TOKENS };
