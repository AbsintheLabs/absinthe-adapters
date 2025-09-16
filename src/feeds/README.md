Read this first: one-sentence mental model

PricingEngine.priceAsset walks a tree of FeedSelectors.
At each node it looks up the proper handler, lets the handler fetch or compute a price, and if that handler needs prices from child nodes it calls recurse(childAssetConfig) which dives one level deeper.
Everything—caching, metadata fetch, decimals—happens on the way down or back up the same call stack.

Hold on to that idea while we zoom in.

⸻

1. Key type aliases (the plumbing)

Alias What it really is Purpose
AssetConfig { assetType: 'erc20'|'spl'; priceFeed: FeedSelector } The “node” we walk. Carries both the selector and the asset type that needs metadata.
FeedSelector A discriminated union with kind field Tells us which handler to use.
ExecutorFn (cfg: AssetConfig, ctx: ResolveContext) => Promise<number> Signature of the recursive resolver.
HandlerFn<K> ({ assetConfig, ctx, recurse }) => Promise<number> What a concrete handler looks like after factory wiring.
HandlerFactory<K> (recurse: ExecutorFn) => HandlerFn<K> Produces a ready handler that already knows how to call recurse for children.

If you get lost, remember:
Factory → returns HandlerFn where recurse already points to PricingEngine.resolveSelector.

⸻

2. Registry boot-up (happens once)

const registry = new HandlerRegistry()

registry.register('coingecko', coinGeckoFactory)
registry.register('pegged', peggedFactory)
registry.initialize(() => pricingEngine.resolveSelector.bind(pricingEngine))

initialize does two things: 1. Calls every factory, injecting the exact same ExecutorFn (the resolver) as recurse. 2. Stores the resulting HandlerFns in handlers for O(1) lookup at runtime.

After this step registry.get('pegged') gives back a function like

async ({ assetConfig }) => assetConfig.priceFeed.usdPegValue

because peggedFactory is that simple.

⸻

3. The life of one priceAsset call

Example input

await priceAsset(
{ // AssetConfig
assetType: 'erc20',
priceFeed: {
kind: 'univ2nav',
token0: { assetType: 'erc20', priceFeed: { kind: 'coingecko', id: 'pepe' } },
token1: { assetType: 'erc20', priceFeed: { kind: 'pegged', usdPegValue: 1 } }
}
},
ctx
)

Step-by-step stack trace

Depth What runs Which AssetConfig is in scope
0 PricingEngine.resolveSelector(rootCfg) univ2nav node
1 univ2navHandler({ recurse }) wants price of token0 so it calls recurse(token0Cfg) token0 cfg (coingecko)
2 resolveSelector(token0Cfg) finds coingeckoHandler, handler may call recurse again if it chains, otherwise returns a price token0 leaf
1 Back in univ2navHandler, now calls recurse(token1Cfg) token1 cfg (pegged)
2 resolveSelector(token1Cfg) finds peggedHandler which just returns usdPegValue token1 leaf
1 univ2navHandler now has both legs, computes NAV, returns it
0 Root resolveSelector receives the price, memoises in cache, returns to caller

Where caching & metadata live
• Metadata: done before handler call, keyed by ctx.asset. Only fetched once per asset.
• Price cache: done after metadata, keyed by JSON.stringify(priceFeed) plus bucket timestamp.
If a value exists, we short-circuit and handler never runs.

⸻

4. Zoom into the wrapper layers

graph TD
A[priceAsset] --> B(resolveSelector)
B --> C{registry.get(kind)}
C -->|handler exists| D[HandlerFn]
D -->|calls| E(recurse)
E -->|is same fn| B

    1.	priceAsset — entry point from your engine or adapter.
    2.	resolveSelector — the universal executor. Handles cache, metadata, handler lookup.
    3.	registry.get — switchboard keyed by priceFeed.kind.
    4.	HandlerFn — custom logic for that kind. It only returns a number.
    5.	recurse — already wired to point back to resolveSelector, so any depth of nesting works.

⸻

5. Concrete handler samples

Pegged

export const peggedFactory: HandlerFactory<'pegged'> =
(recurse) => async ({ assetConfig }) => {
// No recursion needed
return assetConfig.priceFeed.usdPegValue
}

CoinGecko (simplified)

export const coinGeckoFactory: HandlerFactory<'coingecko'> =
(recurse) => async ({ assetConfig, ctx }) => {
const { id } = assetConfig.priceFeed
const resp = await fetch(`https://api.coingecko.com/...${id}`)
return resp.price
}

Univ2 NAV (shows recursion)

export const univ2navFactory: HandlerFactory<'univ2nav'> =
(recurse) => async ({ assetConfig, ctx }) => {
const { token0, token1 } = assetConfig.priceFeed

    const p0 = await recurse(token0) // dives one level
    const p1 = await recurse(token1)

    // Pretend each LP share owns 3 Token0 + 2 Token1
    return 3 * p0 + 2 * p1

}

Notice how token0 and token1 are full AssetConfigs, so the recursion still has assetType for metadata.

⸻

6. Dev cheat-sheet
   • Need metadata? Use ctx.metadataCache.get(ctx.asset) first.
   • Need to price another asset from inside your handler? Build a fresh AssetConfig and call recurse(cfg).
   • Adding a new feed
   1. Write myFactory: HandlerFactory<'myKind'> that returns a HandlerFn.
   2. registry.register('myKind', myFactory) in PricingEngine constructor. Done.
      • Adding a new asset type
   3. Implement AssetTypeHandler.
   4. metadataResolver.set('newType', handler). Metadata will work automatically.

Keep these rules in mind and the stack of wrapper functions stops feeling like magic—it is just a controlled depth-first walk over a JSON tree, with helpers for cache and metadata wired in at the executor layer.
