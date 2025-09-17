## Pricing Engine Types

The pricing engine is relatively tricky to understand, so this document aims to describe how it works.

### Primitives Overview

_Pricing Engine_
The pricing engine does 3 things:

1. Holds a registry of handlers by kind
2. Picks the right handler for assetConfig.priceFeed.kind
3. Does caching, metadata resolution, and calls the handler

_Handlers_

1. One handler per kind (e.g., coingecko, univ3lp, aavev3vardebt)
2. Each handler knows how to get a price for its selector shape

### Data Flow

AssetConfig -> PricingEngine.resolveSelector -> lookup handler by priceFeed.kind -> call handler -> return { price, metadata }
If the handler needs another price, it calls recurse with a different AssetConfig (nested feeds).

### Types Overview

The handler registry holds a map of `HandlerFactory`.

During the initialize step, the we call the factory to create an actual handler which get stores in the `handlers` map.
The type of each handler is `HandlerFn`.

`HandlerFn` is the type of the function that gets called by the pricing engine to get the price of the feed.
It returns a `number` and a `metadata` object (metadata about the asset (decimals, etc)).

Within the `HandlerFn`, the `recurse` function is called to get the price of the feed.
The implementation can call `recurse` multiple times to get the price of nested feeds.
