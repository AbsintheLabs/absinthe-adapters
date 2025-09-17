// interface.ts
import { AssetMetadata, ResolveContext } from '../eprice.ts';
import { AssetConfig, AssetKey, FeedSelector } from '../config/schema.ts';

export type ResolveResult = { price: number; metadata: AssetMetadata };

// helper: pick an AssetConfig whose priceFeed.kind === K
export type AssetConfigOf<K extends FeedSelector['kind']> = AssetConfig & {
  priceFeed: Extract<FeedSelector, { kind: K }>;
};

// new signatures
export type ExecutorFn = (
  cfg: AssetConfig,
  asset: AssetKey,
  ctx: ResolveContext,
) => Promise<ResolveResult>;

export type HandlerFn<K extends FeedSelector['kind'] = string> = (args: {
  assetConfig: AssetConfigOf<K>;
  ctx: ResolveContext;
  recurse: ExecutorFn;
}) => Promise<number>;

export type HandlerFactory<K extends FeedSelector['kind'] = string> = (
  recurse: ExecutorFn,
) => HandlerFn<K>;
