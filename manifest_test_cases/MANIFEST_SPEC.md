```ts
// for adapter manifest
interface Manifest {
    name: string;
    version: string;
    trackableTypes: {
        itemId: string;
        kind: 'action' | 'position';
        quantityType: 'token_based' | 'count' | 'none';
        inputs: {
            role: string;
            requiredWhen: 'always' | 'forPricing' | 'optional';
            description: string;
        }[];
        requiredPricer?: string;
        description: string;
    }[];
}

// for config
interface TrackableInstance {
    itemId: string;
    inputs: <string, any>;
    // same as our existing recursive pricing config
    pricing?: {
        assetType: 'erc20' | 'erc721' | 'spl';
        priceFeed: {
            kind: 'pegged' | 'univ2nav' | 'univ3lp' | 'coingecko' | 'codex';
            [key: string]: any;
        }
    }
}

interface Config {
    adapter: string;
    version: string;
    trackableInstances: TrackableInstance[];
}
```

---

## How this integrates with our pipeline

Pricing is different from tracking.
We backfill pricing for all assets, and then during the enrichment pipeline fetch the price for that asset for the events that we see.
We also ensure that we have at least one price for each "flush" period (which we should probably call something else, like minimum pricing period). It should probably default to once per 24hr.

It does the following: 1. gets all tracked assets from redis 2. get all window boundaries and make sure that prices are only priced after they are made alive 3. call priceAsset on that asset at a particular timestamp + associated block_height (for historical rpc calls)

Price Asset: 1. gets the config 2. sees if there's a config for that asset 3. if so, it constructs a ctx object and invokes the pricing engine

We previously needed to establish a link between the asset tracked and the pricing function.

Now since we made this link explicitly through the manifest, we don't actually need to do this resolution step in this way.

Ex:
When i see a univ2 swap event, i need to make sure that the asset matches token0ortoken1 address.
If i does match, then I use whatever feed pricing gives me.

Ex when i need to price univ2 lp token, I have to make sure the event has the same poolAddress.

In these cases, it's unforuntate because I need to know which address is actually used to match.

What if instead, we could somehow tag each event with a trackable, and then look it up by the pricing attached?

For example, the swap filters for the poolAddress and where token0ortoken1address is the following.
However, we wouldn't know which one is token0 and token1 which kind of ruins our whole de-duping design pattern.

How should pricing work:

1. We need to identify each "asset"
2. Each asset needs a price resolution strategy

ex:

1. swap needs to price either token0 or token1 (asset = assetAddress)
2. lp needs to price the lp token (asset = assetAddress)
3. univ3 lp needs to price the nft lp (asset = collection:tokenid)

We're typically pricing an erc20 or an erc721. <-- this is a core insight that i don't think we're utilizing

Key Insights

1. We're pricing "assets" not events.
2. Pricing is time-driven (schedule-driven), not event-driven.
3. With the new manifest system, this matching logic should move into the adapters themselves since they understand their own event semantics.
4. Inputs are for filtering down data universe to a smaller set of data

Now, the adapter registers an asset to be tracked (rather than the engine being responsible for this). Because of this, it can link the asset address to the pricing function.

Once the adapter registers the asset, the engine just needs to invoke the pricing function at specified intervals for that asset.

Event tagging stays the same (fetching by asset address). The key insight is that asset <-> pricing function is explicitly linked in the adapter, rather than implicitly matched in the engine.

For example: for a swap:

1. get swap

right now we emit sides for token0 and token1, that can stay

if token0ortoken1address is supplied, then we can filter the sides for that asset

We then register the token0ortoken1address, the assetType,

in fact, it CAN be a separate config that the adapter registers ahead of time. This is fine for assets that are known ahead of time.

in fact, it could iterate over the trackables and register the assets ahead of time this way.

need to make sure this works for nft, since we require tagging those assets first.

They key confusion part is:

1. Can a trackable only be used to track one type of asset?
   - this is the simple case, and prevents the need from defining how assets should get priced.
2. Or can a trackable emit multiple types of assets?
   - this is the more complex case, and requires defining how assets should get priced according to some rules.

For univ3, if we set this:

```ts
      inputs: {
        factoryAddress: "0xCdBCd51a5E8728E0AF4895ce5771b7d17fF71959",
        token0OrToken1Address: "0x4200000000000000000000000000000000000006"
      },
```

then we should be tracking all pools where one of the sides of the pools is 0x420...

- we would want to periodically

For example, the univ3lp works by:

- taking in the asset
- splitting by token id

In this case, we need to price each NFT token id separately (invoke the function uniquely each time)

---

---

### Taking a step back

Truthfully, I think there's still some disconnect with how the manifest works and how it influences the adapter.

Let's have the adapter implement the manifest logic so that we can more clearly take care of pricing.

The confusion stems from trying to use trackable instances for two different purposes:

Event filtering (what events to capture)
Asset discovery (what assets need pricing)

Two Cases:
Known assets vs discovered assets

---

engine becomes a simple scheduler that:

1. Maintains a registry of assets that need pricing
2. Fires pricing jobs on a time schedule for all registered assets
3. Delegates actual pricing logic to the pricing engine with the registered config

Adapters own asset discovery. Engine owns pricing execution.

Currently, the emit.balanceDelta is doing automatic discovery of assets during its execution.

Instead, let's create a new emit like: emit.registerAsset({
asset: string; // how to make sure that this abides by our asset key format? this needs to be consistent.
assetType: 'erc20' | 'erc721' | 'spl';
pricingConfig: object; // passed thru config?
})

let's start with simple case and work our way up:

1. univ2 swaps + lp for a single pool
   1. full implementation of manifest + adapter
   2. asset registration
2. univ2 swalps + lp for factory (dynamic discovery)
   1. full implementation of manifest + adapter
   2. asset registration
3. univ3 swaps + lp for a single pool
   1. full implementation of manifest + adapter
   2. asset registration
4. univ3 swaps + lp for factory
   1. full implementation of manifest + adapter
   2. asset registration

---

(1) univ2 swaps + lp for single pool:

```txt
// init
<!-- for each swap trackable in manifest: -->
processor = subscribe to swap on ${swapTrackable.inputs.poolAddress}
token0 = poolContract.token0()
token1 = poolContract.token1()

// main loop
for each swap in processor.next():
    swapkey = md5Hash(`${swap.transactionHash}${swap.logIndex}`)
    if token0ortoken1address is supplied, then:
        if token0=token0ortoken1address, then:
            asset = token0
        else:
            asset = token1

    emit.swap({
        key: swapkey,
        asset: token0,
        amount: swap.amount,
    })
    emit.swap({
        key: swapkey,
        asset: token1,
        amount: swap.amount,
    })
```

behavior:

- if token0ortoken1address is not supplied, then we emit both sides and dedupe on the key later. this will return the scaled value, not priced value
- if token0ortoken1address is supplied, but pricing is not supplied, then we only emit the side that matches token0ortoken1address. this will return the scaled value, not priced value
- if pricing is supplied, we need token0ortoken1address to be supplied. we then emit the side that matches token0ortoken1address
  - we also ensure that this value ends up getting priced via the pricing function for the asset

Fair tradeoff right now -> only allow one asset per indexer at a time.
Only allow one pool at a time.

Don't allow dynamic discovery of pools / assets right now.

We can track an asset. An asset is both in a: 1) position and a 2) action.
An asset can be priced via some feed OR we can simply return the scaled value (unpriced).
Every asset is able to have this dual-behavior.

It doesn't make sense to treat them differently in the adapter since we'd have to do this for each adapter and they are the same thing.

An adapter has to either emit an: action or balanceDelta (which is an update to a position).

We could also: 1) create a position and then update it via a a balanceDelta

---

### Adapters

The adapters need to know: which assets do i tell the engine to track from when, and how should you price them? - the base value that the adapter is operating on is the trackable instance config. - an instance defines: the asset, any config it needs, and how to price that asset if we want it to be priced?

Each trackable instance matches against an asset -> this can work.

However, for univ3lp, each nft asset is numbered by token id. So it's infeasible to have a trackable instance for each nft asset.

Manifest defines the types that are allowed in our trackable instances.

Each trackable instance allows you to match against a specific asset, or multiple assets.

Workflow is:

- adapter tracks all events that it can possibly see
- only the events that are matched by trackable instances are actually passed through. this makes asset selection explicit, even for rule-based matching.
- if an asset is matched by a trackable instance (rule), then we register the asset with the engine
- the engine will schedule pricing for it via the pricing engine
- enrichers simply lookup the price for the asset, calculate the position, etc
  - if no pricing is provided for that asset, then we simply scale the value
  - existence of the pricing field is required for the adapter to register the asset with the engine

point of confusion:

- the inputs can be used to filter WHILE ALSO be required for pricing, but not clear how it's connected to the pricing?

#### Mental Model

- Assets are the fundamental unit - Everything revolves around tracking and optionally pricing specific assets (ERC20 tokens, ERC721 NFTs, etc.)
- Trackable instances are asset selectors - They declaratively specify which assets you care about and how to identify them from blockchain events
- Pricing is orthogonal to tracking - Any tracked asset can optionally have a pricing rule attached, but tracking and pricing are separate concerns
- Two discovery patterns coexist:
  1. Direct selection: "Track this specific ERC20 token"
  2. Rule-based matching: "Track any ERC721 that matches these label criteria"
- Time-driven pricing: Once an asset is registered (either directly or via matching rules), the engine prices it on a schedule regardless of event activity

### Engine

The engine only sees: tell me which assets to track and how, and I'll schedule them.

### Price Engine

The price engine only needs to know: tell me the asset, the ts, and block and I'll resolve the price.

### Enrichers

The enrichers need to know: I see a window or an action. Should i lookup the saved price or should i scale it?

---

Before (which worked but was hacky): - the adapter config is given parameters to track. it doesn't say what it does track - the pricing config was provided independently. if there was a match, then we would price each of those components.

---

q: Side question for later:

1. Can we ensure that if we don't provide a pricer, then we will return a value that's scaled rather than priced? This is more of how to pass through the trackable instance config through to make sure we get the right result.

---

---

---

---

---

---

---

---

---

---

---

Let's keep thinking here. I think we're getting close to the correct model.

A trackable instance defines parameters AND filters that return a set of assets.
This set must have the same pricing config, if we want to price them. This is a
requirement. Currently, this is not enforced, but not sure if this is possible to enforce in the first place.

If these assets are given a pricing config, then we know we should price them.
If we do not, then we should scale the value. - might make sense to register the asset with the engine and either provide a config or not during registration.

### Clear Mental Model

A trackable instance defines parameters to declare a set of assets that all share the same pricing config.

Adapter has two implementations per trackable type. This is how it's going to treat each "thing" that it has to track.

Before, the user had to have knowledge of what the adapter was tracking and then how to price it via the config.

For example:
Let's take uniswap v2: which has 2 trackable types: 1) swap and 2) lp

Each one will:

1. define what data it needs
2. decode that data

each trackable will route it's subscribed to events to the proper implementation
swap -> track the swap topic on the poolAddress (sqd config)

1. adapter tells sqd that it needs to subscribe to swap topic on the pool address
2. all swap events then get routed to the swap implementation
3. that swap event matches against our list of trackable instances
   a. if it matches, then we register the asset with the engine (including the pricing config/function. an empty pricing config is allowed, and means we will simply scale the value)
   b. if it doesn't match, then we skip it
4. the engine will emit events / balanceDeltas on the data that was matched

this way we're pushing price matching and discovery into the adapter

for example:

```txt

```

Engine -> recieves a list of assets to track and their pricing configs. it just schedules them for pricing on a schedule.

enrichers -> recieves an array of positions or actions. we can attempt to price that asset if the asset registration has a pricer associated with it. even better, we can pass through if the pricing config exists via the pricer into the actual event itself (alongside the asset address). This tells it whether to look up the price or not.

The trick right now is:

- how can we encode configuration that if we provide a pricer, we allow the adapter to define one type of pricing strategy?

The adapter writer needs to be able to define this.

For example, for univ2 swap, we need to filter token0 or token1 address by an asset
so that we can price the volume of the swap.

For univ2 lp, we only need to make sure we provide the pool address since token0 and token1 are both encoded in that pool (and we enforce us to use the univ2nav pricer which
requests the token0 and token1 addresses internally with recursive resolution)

We don't need to narrow to a singular asset if we don't need to price. But if we're going to price, then yes, we need to narrow to a singular asset (or kind of asset) that we can invoke the same pricing strategy for.

This is why we allow for optional filters that are required for pricing.

Sometimes, we'll need complicated mechanics like one or the other. In this case, we can allow the developer to write their own zod schema to validate the inputs.

params are required.
filters are optional (but sometimes required for pricing).

We could also define the filters separately that are needed to determine asset (we kind of already do this with the requiredForPricing flag). Would it make sense to have two different types of filters?

Filters can define:

- asset scope

Pricing requires asset scope.

Let's think about what requires minimal filters for asset scoping:
uni-v2/v3 swap:

- swapLegAddress
  uni v2 lp:
- comes for free. poolAddress = asset address
  uni v3 lp:
- token1 address
  aave v3:
- we are just tracking erc20's with no filters.

Next Steps:

1. how does adapter define the manifest?
2. How to make the manifest more clear that a certain set of filters are required to narrow down to a single set of same-priceable assets? -> requireForPricing flag for now
3. how does the adapter register the assets with the engine?
   - need to create manifest type to validate against with a zod schema.
4. how does the adapter know which log to pass to which manifest tracker? It should pass certain events to certain trackable instances to remove the if/else noise in our implementation.
5. figure out why we had the priceable flag on the action? Ah, i think to show if it was even priceable or not (but shouldn't we get that with the inclusion of asset? maybe i had it in there to be explicit).
6. where do the filters get applied? Is it when we get an asset we apply the filters that are provided to it?
7. where do we implement validation? likely in zod. this will make sure that the adapter is not given a config that is invalid.
   conditions:
   1. if pricer is provided, but not all filters that are required for pricing, then this is an incorrect configuration.
   2. if not all params are provided, this is an incorrect configuration.
   3. if the wrong top level pricer is provided from the one that that manifest requires, this is an incorrect configuration.
   4. if an extra parameter is provided (strict), then this is an incorrect configuration.
   5. degenerate condition: if all pricing is provided, but we still try to price a window and no price exists, then something went wrong. we likely want to log an error in the adapter and quit / exit to not push buggy data.

---

if topic is transfer, then send to lp handler. if topic is swap, then send to swap handler.

perhaps we don't destructure the log param so we can easily pass it through to the handlers.

lp handler needs:

1. decoded instruction
2. trackable instance
3. emit obj to call emit.balanceDelta()

swap handler needs:

1. decoded instruction
2. trackable instance (what is the filter or config?)
3. emit obj to call emit.action()

If pricing is provided, we need to register the asset with the engine. - can the events do this themselves? if pricing is provided so it's not explicit? - This is done by seeing if the pricing object is configured. - if no pricing object is provided, we assume they want a scaled value and don't track that asset.

Next step: work through entire path

1. adapter emits event
   1. balance delta OR action registers the asset with the engine if trackable instance has pricing correctly configured
   2. these two handlers will tag the asset with a `shouldPrice` flag based on the pricing object.
2. engine then backfills on all active assets via the proper resolver by calling it to the pricing-engine
3. Then, the enrichers will know if they need to lookup the price or use a scaled amount for it

manifest: is a defined zod object
config: adheres to the manifest zod object (is parsed at runtime for correctness)
the build function then has access to the entire manifest (more specifically, the trackable instances)
