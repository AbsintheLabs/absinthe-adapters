import { HandlerFactory } from './interface';
import * as ichiAbi from '../abi/ichi';
import Big from 'big.js';
import { log } from '../utils/logger';

// Simple function implementation using FeedHandler signature
export const ichinavFactory: HandlerFactory<'ichinav'> = (resolve) => async (args) => {
  const { assetConfig, ctx } = args;
  const { token0, token1 } = assetConfig.priceFeed;

  const ichiContract = new ichiAbi.Contract(
    // eventually, move this typing into the ctx object so it's very easy to set when we need to make an rpc call
    // { _chain: ctx.sqdCtx._chain, block: { height: ctx.block.header.height } },
    ctx.sqdRpcCtx,
    ctx.asset,
  );

  // HACK: get the keys from the rpc calls each time. instead, should allow the implementer to cache them
  // allow each handler to have its own metadata cache for whatever it needs
  // NOTE: this is an optimization, so it can wait
  const token0Address = (await ichiContract.token0()).toLowerCase();
  const token1Address = (await ichiContract.token1()).toLowerCase();

  // xxx: need to have the implementer pass in the new asset key to the resolve call. This needs to be enforced somehow
  // const token0Price = await resolve(tokan0, { ...ctx, asset: token0Address });
  // const token1Price = await resolve(token1, { ...ctx, asset: token1Address });
  const token0Resolved = await resolve(token0, token0Address, ctx);
  const token1Resolved = await resolve(token1, token1Address, ctx);

  // we can assume we'll have the decimals after resolving the token0 and token1 prices above
  // fixme: we should be able to return metadata of the token by the resolve calls as well so we don't have to rely on the metadata cache explicitly
  // xxx: we should be able to access the asset key from the object as well so we can reference it
  // const token0Metadata = await ctx.metadataCache.get(token0Address);
  // if (!token0Metadata) {
  //     throw new Error(`Token metadata not found for ${token0Address}`);
  // }
  // const token0Decimals = token0Metadata.decimals;

  // const token1Metadata = await ctx.metadataCache.get(token1Address);
  // if (!token1Metadata) {
  //     throw new Error(`Token metadata not found for ${token1Address}`);
  // }
  // const token1Decimals = token1Metadata.decimals;

  const token0Decimals = token0Resolved.metadata.decimals;
  const token1Decimals = token1Resolved.metadata.decimals;

  // todo; store this later in the metadata cache
  const ichiTokenDecimals = await ichiContract.decimals();

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
