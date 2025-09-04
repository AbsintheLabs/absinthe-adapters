const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_DECIMALS = 6;
const FILE_NAME = 'config.json';

const TRACKED_TOKENS = {
  [USDC_MINT]: USDC_DECIMALS,
};

const WHIRLPOOL_ADDRESSES = [
  '8uGEM2h7s9EV5tYynAFh5kwve1uLiSEs665V9DYX2Lpj',
  // 'AvVeFoEokqbosw9UWkYEnwpWhTQd96GeWwV48WjFCEMw',
  // 'HWzqj2vg581nwvAryFKoeB3DaNqtNhtxY98wbb8EjLpC',
];

export { TRACKED_TOKENS, FILE_NAME, WHIRLPOOL_ADDRESSES };
