// Asset type handlers for metadata resolution

import Big from 'big.js';
import { AssetTypeHandler } from '../types/pricing.ts';
import { AssetType } from '../config/schema.ts';
import { ResolveContext } from '../types/pricing.ts';
import * as erc20Abi from '../abi/erc20.ts';

// Handlers
export const erc20Handler: AssetTypeHandler = {
  getMetadata: async (ctx: ResolveContext) => {
    const erc20Contract = new erc20Abi.Contract(
      { _chain: ctx.sqdCtx._chain, block: { height: ctx.block.header.height } }, // BlockContext
      ctx.asset,
    );
    const decimals = await erc20Contract.decimals();
    // note: we are omitting symbol and name for now since we don't use them and it's extra RPC calls for this
    return { decimals: Number(decimals) };
  },
  normalizeAmount: (amount: Big, metadata) => amount.div(Big(10).pow(metadata.decimals)),
};

export const erc721Handler: AssetTypeHandler = {
  getMetadata: async (ctx: ResolveContext) => {
    return { decimals: 0 }; // erc721's don't have decimals
  },
  normalizeAmount: (amount: Big, metadata) => amount,
};

// export const splHandler: AssetTypeHandler = {
//     getMetadata: async (assetKey: string, ctx: ResolveContext) => {
//         // todo: implement
//         return { decimals: 9 };
//     }
// };

// todo: clean up the metadata resolver to be co-located with the code that actually uses it
export const metadataResolver = new Map<AssetType, AssetTypeHandler>([
  ['erc20', erc20Handler],
  ['erc721', erc721Handler],
  // ['spl', splHandler],
]);
