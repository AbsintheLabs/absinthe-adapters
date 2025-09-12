const currencies = [
  {
    name: 'USDC',
    symbol: 'usd',
    decimals: 6,
  },
  {
    name: 'MANA',
    symbol: 'decentraland',
    decimals: 18,
  },
  {
    name: 'SAND',
    symbol: 'the-sandbox',
    decimals: 18,
  },
  {
    name: 'GHST',
    symbol: 'aavegotchi',
    decimals: 18,
  },
  {
    name: 'RUM',
    symbol: 'arrland-rum',
    decimals: 18,
  },
  {
    name: 'ETH',
    symbol: 'ethereum',
    decimals: 18,
  },
];

const nullCurrencyAddresses = [
  {
    name: 'xyz-7',
    contractAddress: '0xDD4d9ae148b7c821b8157828806c78BD0FeCE8C4',
    chainId: 137,
    fromBlock: 73490308,
  },
  {
    name: 'bify',
    contractAddress: '0xBEBE4BaF1f02FA150D42A1Be9eD1B4707c5BE49B',
    chainId: 8453,
    fromBlock: 33033160,
  },
  {
    name: 'footium',
    contractAddress: '0x7cED531Bb384dE4e70C0A543dBC5707bDB67632a',
    chainId: 42161,
    fromBlock: 370444915,
  },
  {
    name: 'xyz-8',
    contractAddress: '0x506900B4bE61dcdCD11c5ce90DCF16d8fDeC600d',
    chainId: 8453,
    fromBlock: 34196308,
  },
];

export { currencies, nullCurrencyAddresses };
