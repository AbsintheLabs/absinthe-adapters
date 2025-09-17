const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_DECIMALS = 6;
const FILE_NAME = 'config.json';

const TRACKED_TOKENS = {
  [USDC_MINT]: USDC_DECIMALS,
};

const TOKEN_MINT = [
  'CnaMusggBCMgNafef86yPnKRxXbZQgtBrqnKrDH5Fs4o',
  'A72oRzZQWzwjLMBwWyjLQz4iJJAxrkWNGmi5oLnCPFiU',
  'CJypqK9LYDCLCM4rASZLxTg8j6cyh27gv8HjK5kPaaJ2',
  '9uSLrGnpzahnCuV3naxLpeghss29niXnHqD3r565LdRc',
  '8C5oWtTvPtz7dnPxeQ5XJdQTP8Wvx6PTTf6uzybVYtzV',
  '2DWf4XrEMXeXBDwv8Y3U7ood1KZ3U1bB4xmZ66M9hpkX',
  '8z55HzSfHvrR1M3upPoWrVExhLQZW4ZVgCSGC5xh56in',
  'A7v5HLa5FuykEf7bpzRRNRTRJyXgVXy7Gw8unDiRR5Uy',
  'DW9QhZy1mUrPQUBzVXD2Nzwun5wQdc9RE9LimVzdN8LK',
  '8XvWbpLP9UydV6A7bvAEV6gVeNpSBXpCZj2zk8XEfAyE',
  'Hc68ZQNPYb7EWAE2FucoDNPNEDGAcXmYrtnqXeCsbkxG',
  'BmW4gbnJGQY7tH2SrpDiaar2o7MR5i5EHzs3KaD8Hf5z',
  'Ww8EtftBCJMLiXGmBzNTNuybP3dGn4jNqTc7UA6ZPw3',
  '6mHZicr6QHzXq1Qf1PXMo5Cs7sPUTSdLWySQKfWect4q',
  '6rvJx6Mqzj1hxtBPU2JEz1LwzEf7mJTvcoFtv6VTQDks',
  '4rXnNerheGQxWq58fnupicXEYrcpwiszWXvge9FiNY5M',
  '5MsTpJU5P2zqNBzCFeC4GEM1snFHkb9szxgqpSpnLTRh',
  '4hkqE5ufY4NN6fs7q9QDUNvNYzZTjGSpgvJEhcce4KHn',
  'ARNJkqRSHuapzoLNwD81uT1PrqCtDoVtk15GUqDCrWq5',
  '4bP7R8wRjUV5cNMdGwQvxNt9Nw791apoi4hKRgidXcCr',
  'CfVnB9ezJ9xYUE8g2MaaonWRUMU2UFtxrzHpYzWncLZD',
  'CcExbad96NFVnCekq9rks1kDX8mk3qA12Em3ZY7Gszjf',
  '9u8wMHFpZB991onh7nMgMjqTrMNFoiW9RoaPxLfh4Xh6',
  'F5XAjVMMAmMLKgXXs1EMons1VFFLpZATQ2aERPCajSRj',
  'ApwXMoYuQEvjDUQJzuCRmry9qNpERu3xhB5c3kxnnBUx',
  'GtsHFYTPnDPq3Qrhb2C8JLxzLJ9wTuwDuQ34SsjBrhan',
  '88dDZRwb92Vzkenc5qUhMjFPyZtYVFGxMyWkSokQdFuZ',
];

//todo: uncomment
const WHIRLPOOL_ADDRESSES = [
  // '8uGEM2h7s9EV5tYynAFh5kwve1uLiSEs665V9DYX2Lpj',
  // 'AvVeFoEokqbosw9UWkYEnwpWhTQd96GeWwV48WjFCEMw',
  // 'HWzqj2vg581nwvAryFKoeB3DaNqtNhtxY98wbb8EjLpC',
  'H3TyEdmcRPqU5zHR1cXgp7dD61fsyxPGPRUUgDG6wpR3',
  // '36wzzrLB33yEeMbHrYCY2dkwtK3ob5AyYn6rncEFBLgN',
];

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
    price: 0.22, //avg price
    decimals: 9,
  },
  {
    symbol: 'PayPal',
    address: '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo',
    coingeckoId: 'paypal',
    price: 1,
    decimals: 6,
  },
  {
    symbol: 'USDC.e',
    address: 'Eh6XEPhSwoLv5wFApukmnaVSHQ6sAnoD9BmgmwQoN2sN',
    coingeckoId: 'usd-coin',
    price: 1.19,
    decimals: 9,
  },
  {
    symbol: 'EURO.e',
    address: '2VhjJ9WxaGC3EZFwJG9BDUs9KxKCAjQY4vgd1qxgYWVg',
    coingeckoId: 'euro',
    price: 1.18,
    decimals: 6,
  },
  {
    symbol: 'XSTOCK',
    address: 'XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ',
    coingeckoId: 'xstock',
    price: 331.19,
    decimals: 8,
  },
];

const TOKEN_EXTENSION_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

export {
  TRACKED_TOKENS,
  FILE_NAME,
  WHIRLPOOL_ADDRESSES,
  TOKEN_DETAILS,
  TOKEN_EXTENSION_PROGRAM_ID,
  TOKEN_MINT,
};

//362407532
// 356958812 - init
// 356962718 - current length in 30 mins
