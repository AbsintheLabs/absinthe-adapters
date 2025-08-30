import { HandlerFactory } from './interface';
import * as ichiAbi from '../abi/ichi';
import Big from 'big.js';
import { log } from '../utils/logger';

// Handler name constant for ICHI NAV pricing
const ICHI_NAV_HANDLER = 'ichinav';

// Simple function implementation using FeedHandler signature
export const ichinavFactory: HandlerFactory<'ichinav'> = (resolve) => async (args) => {
  const { assetConfig, ctx } = args;
  const { token0, token1 } = assetConfig.priceFeed;

  const ichiContract = new ichiAbi.Contract(ctx.sqdRpcCtx, ctx.asset);

  // Cache key for ICHI vault configuration
  const vaultConfigKey = ctx.asset.toLowerCase();

  // Try to get cached vault configuration first
  let vaultConfig = await ctx.handlerMetadataCache.get(ICHI_NAV_HANDLER, vaultConfigKey);

  if (!vaultConfig) {
    // Get token addresses and ICHI token decimals from the vault and cache them
    const [token0Address, token1Address, ichiTokenDecimals] = await Promise.all([
      ichiContract.token0(),
      ichiContract.token1(),
      ichiContract.decimals(),
    ]);

    vaultConfig = {
      token0Address: token0Address.toLowerCase(),
      token1Address: token1Address.toLowerCase(),
      ichiTokenDecimals: Number(ichiTokenDecimals.toString()),
    };

    // Cache the vault configuration
    await ctx.handlerMetadataCache.set(ICHI_NAV_HANDLER, vaultConfigKey, vaultConfig);
  }

  // Use cached token addresses
  const token0Address = vaultConfig.token0Address;
  const token1Address = vaultConfig.token1Address;

  const token0Resolved = await resolve(token0, token0Address, ctx);
  const token1Resolved = await resolve(token1, token1Address, ctx);

  // Get token decimals from the resolved price data
  const token0Decimals = token0Resolved.metadata.decimals;
  const token1Decimals = token1Resolved.metadata.decimals;

  // Use cached ICHI token decimals
  const ichiTokenDecimals = vaultConfig.ichiTokenDecimals;

  const { total0, total1 } = await ichiContract.getTotalAmounts();
  const totalSupply = await ichiContract.totalSupply();

  // if total supply is 0, we can't compute a price
  if (Number(totalSupply) === 0) {
    return 0;
    // return { price: 0, metadata: { decimals: } };
  }

  // computation
  const totalValue = new Big(total0.toString())
    .div(10 ** token0Decimals)
    .mul(token0Resolved.price)
    .add(new Big(total1.toString()).div(10 ** token1Decimals).mul(token1Resolved.price));
  // const price = totalValue.div(totalSupply.toString());

  // scale by decimals
  const price = totalValue.div(new Big(totalSupply.toString()).div(10 ** ichiTokenDecimals));

  // return { price: price.toNumber(), metadata: { decimals: ichiTokenDecimals } };
  return price.toNumber();
};
