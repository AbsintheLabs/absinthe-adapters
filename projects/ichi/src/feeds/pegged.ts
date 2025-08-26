import { HandlerFactory } from './interface';

export const peggedFactory: HandlerFactory<'pegged'> = (resolve) => async (args) => {
  return args.assetConfig.priceFeed.usdPegValue;
};
