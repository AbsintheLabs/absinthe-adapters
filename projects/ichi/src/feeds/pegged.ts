import { HandlerFactory } from './interface';

export const peggedFactory: HandlerFactory<'pegged'> = (resolve) => async (args) => {
  return args.selector.usdPegValue;
};
