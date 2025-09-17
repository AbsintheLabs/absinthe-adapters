import { HandlerFactory } from './interface.ts';

export const peggedFactory: HandlerFactory<'pegged'> = (resolve) => async (args) => {
  return args.assetConfig.priceFeed.usdPegValue;
};
