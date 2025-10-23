// Asset type handlers for metadata resolution
import Big from 'big.js';
import { AssetTypeHandler } from '../types/pricing.ts';
import { ResolveContext } from '../types/pricing.ts';
import * as erc20Abi from '../abi/erc20.ts';
import { Asset, AssetOfType } from '../types/asset.ts';
import { AssetMetadata } from '../types/index.ts';
import { SqdRpcCtx } from '../types/adapter.ts';

// Handlers
export const erc20Handler: AssetTypeHandler<'erc20'> = {
  getMetadata: async (asset: AssetOfType<'erc20'>, ctx: SqdRpcCtx) => {
    const erc20Contract = new erc20Abi.Contract(
      { _chain: ctx._chain, block: { height: ctx.block.height } },
      asset.address,
    );
    const decimals = await erc20Contract.decimals();
    return { decimals: Number(decimals) };
  },
  normalizeAmount: (amount: Big, metadata) => amount.div(Big(10).pow(metadata.decimals)),
};

export const erc721Handler: AssetTypeHandler<'erc721'> = {
  getMetadata: async () => {
    return { decimals: 0 };
  },
  normalizeAmount: (amount: Big, metadata) => amount,
};

export const customHandler: AssetTypeHandler<'custom'> = {
  getMetadata: async () => {
    return { decimals: 0 };
  },
  normalizeAmount: (amount: Big, metadata) => amount,
};

export const splHandler: AssetTypeHandler<'spl'> = {
  getMetadata: async () => {
    // TODO: implement proper SPL metadata fetching
    return { decimals: 9 };
  },
  normalizeAmount: (amount: Big, metadata) => amount.div(Big(10).pow(metadata.decimals)),
};

/**
 * Type-safe metadata fetcher
 */
export async function getAssetMetadata(asset: Asset, ctx: SqdRpcCtx): Promise<AssetMetadata> {
  switch (asset.type) {
    case 'erc20':
      return await erc20Handler.getMetadata(asset, ctx);
    case 'erc721':
      return await erc721Handler.getMetadata(asset, ctx);
    case 'custom':
      return await customHandler.getMetadata(asset, ctx);
    case 'spl':
      return await splHandler.getMetadata(asset, ctx);
    default: {
      const _exhaustive: never = asset;
      throw new Error(`Unknown asset type: ${(_exhaustive as Asset).type}`);
    }
  }
}

/**
 * Type-safe amount normalizer
 */
export function normalizeAssetAmount(asset: Asset, amount: Big, metadata: AssetMetadata): Big {
  switch (asset.type) {
    case 'erc20':
      return erc20Handler.normalizeAmount?.(amount, metadata) ?? amount;
    case 'erc721':
      return erc721Handler.normalizeAmount?.(amount, metadata) ?? amount;
    case 'custom':
      return customHandler.normalizeAmount?.(amount, metadata) ?? amount;
    case 'spl':
      return splHandler.normalizeAmount?.(amount, metadata) ?? amount;
    default: {
      const _exhaustive: never = asset;
      throw new Error(`Unknown asset type: ${(_exhaustive as Asset).type}`);
    }
  }
}
