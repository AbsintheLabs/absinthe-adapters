// interface.ts
import { AssetConfig, AssetKey, AssetMetadata, FeedSelector, ResolveContext } from '../eprice.ts';

export type ResolveResult = { price: number; metadata: AssetMetadata };

// helper: pick an AssetConfig whose priceFeed.kind === K
type AssetConfigOf<K extends FeedSelector['kind']> = AssetConfig & {
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
