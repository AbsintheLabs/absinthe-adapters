const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_DECIMALS = 6;
const FILE_NAME = 'config.json';

const TRACKED_TOKENS = {
  [USDC_MINT]: USDC_DECIMALS,
};

const WHIRLPOOL_ADDRESSES = [
  '8uGEM2h7s9EV5tYynAFh5kwve1uLiSEs665V9DYX2Lpj',
  'AvVeFoEokqbosw9UWkYEnwpWhTQd96GeWwV48WjFCEMw',
  'HWzqj2vg581nwvAryFKoeB3DaNqtNhtxY98wbb8EjLpC',
];

// const WHIRLPOOL_ADDRESSES = ['H3TyEdmcRPqU5zHR1cXgp7dD61fsyxPGPRUUgDG6wpR3'];

const TOKEN_DETAILS = [
  {
    symbol: 'SOLANA',
    address: 'So11111111111111111111111111111111111111112',
    coingeckoId: 'solana',
    price: 200,
    decimals: 9,
  },
  {
    symbol: 'AM',
    address: '7ddd3rNWdx36MgnLkoUdwEPNoXt1bi9fszorkZungN2E',
    coingeckoId: 'am',
    price: 0.0000118,
    decimals: 6,
  },
  {
    symbol: 'KOLIN',
    address: '4q3Z58YxrZEAVMLtMwnm7eHtodSD3LSpSNt3pDnqpump',
    coingeckoId: 'kolin',
    price: 0.00123,
    decimals: 6,
  },
  {
    symbol: 'USDC',
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    coingeckoId: 'usd-coin',
    price: 1,
    decimals: 6,
  },
  {
    symbol: 'GM30',
    address: '76uBMvo1WL644VaUMhnuzSJSLJtQbNvr8ThubQi7E95n',
    coingeckoId: 'gmx-30-token',
    price: 0.217,
    decimals: 9,
  },
];

export { TRACKED_TOKENS, FILE_NAME, WHIRLPOOL_ADDRESSES, TOKEN_DETAILS };
