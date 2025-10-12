const currenciesBase = [
  {
    name: 'USDC',
    symbol: 'usd',
    address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    decimals: 6,
  },
  {
    name: 'GHST',
    symbol: 'aavegotchi',
    address: '0xcd2f22236dd9dfe2356d7c543161d4d260fd9bcb',
    decimals: 18,
  },
  {
    name: 'WETH',
    symbol: 'ethereum',
    address: '0x4200000000000000000000000000000000000006',
    decimals: 18,
  },
];

const currenciesArbitrum = [
  {
    name: 'USDC',
    symbol: 'usd',
    address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    decimals: 6,
  },
  {
    name: 'WETH',
    symbol: 'ethereum',
    address: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
    decimals: 18,
  },
];

const currenciesPolygon = [
  {
    name: 'USDC',
    symbol: 'usd',
    decimals: 6,
    address: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
  },
  {
    name: 'MANA',
    symbol: 'decentraland',
    decimals: 18,
    address: '0xa1c57f48f0deb89f569dfbe6e2b7f46d33606fd4',
  },
  {
    name: 'SAND',
    symbol: 'the-sandbox',
    decimals: 18,
    address: '0xbbba073c31bf03b8acf7c28ef0738decf3695683',
  },
  {
    name: 'GHST',
    symbol: 'aavegotchi',
    decimals: 18,
    address: '0x385eeac5cb85a38a9a07a70c73e0a3271cfb54a7',
  },
  {
    name: 'RUM',
    symbol: 'arrland-rum',
    decimals: 18,
    address: '0x14e5386f47466a463f85d151653e1736c0c50fc3',
  },
  {
    name: 'ETH',
    symbol: 'ethereum',
    decimals: 18,
    address: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
  },
];

const nullCurrencyAddresses = [
  '0xDD4d9ae148b7c821b8157828806c78BD0FeCE8C4',
  '0xBEBE4BaF1f02FA150D42A1Be9eD1B4707c5BE49B',
];

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'; //TODO: move to utils/consts.ts file

export {
  currenciesBase,
  currenciesArbitrum,
  currenciesPolygon,
  nullCurrencyAddresses,
  ZERO_ADDRESS,
};
