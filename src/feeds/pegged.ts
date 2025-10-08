import { defineFeed } from './define.ts';

export default defineFeed('pegged', (resolve) => async (args) => {
  return args.assetConfig.priceFeed.usdPegValue;
});
