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

Let's plan out a game plan. If I can think through how the entire flow is supposed to work, then we can start to implement it and make the actual engineering much simpler.

## Master Implementation Plan

[-] Move manifest definition to be accessible within the adapter.ts - i can access `trackables` within the `build` function - used via zod: answer in gpt in `interface design principles` chat

#### manifest definition:

I currently like the way the manifest is defined. The current problem is:
The manifest gives a structure to the types that can be provided at runtime.
There are the trackable definitions, and then the trackable instances (all of the ones that were supplied).
Each trackable instance allows us to track something.
For example, we can track multiple swap instances or multiple lp instances. With filtering, this becomes a fairly powerful construction.

I want to make sure that give access to the trackable instances in the adapter itself. This means that once we load in the configuration and validate the config, those are going to be the parameters that were passed in by the user.

In short, for each trackable defined, we are going to have an array of those instances.
ex: we define swap as a trackable. That means we have config.swap which is an array of swap instances. - for each instance, we can get the params, filters, and pricing config.
Params are always required, so they will always be present. Filters can exist, but they might not exist (might not be provided). Pricing also can or might not exist. Based on this, it will also change which filters are required or not (but this is runtime validation).

- the 2 cases are:
  - 1. pricing config is provided, so filters that are marked "requiredForPricing" are present
  - 2. pricing config is not provided, so filters that are marked "requiredForPricing" may or may not be present.

finish writing univ2 adapter
[-] Register all logs from the manifest into the sqd processor
[-] Route each event into the proper handler
[ ] Create proper types for the onLog handler
[ ] Implement proper filtering logic for the univ2 adapter
LP Handler:
[ ] emit balanceDelta events
---> for the time being, let's jump ahead slightly to work out the full flow here with balanceDelta() tracking
[ ] only add assets:tracked if pricing config is provided (same logic as setting `shouldPrice`)
[ ] separate function for registering an asset. This will save: the asset key + how to price that asset key (priceFeed config)
[ ] add `shouldPrice` flag to each of the windows (since we call pricing on each of the windows and its stateless)
backfill pricing:
[ ] pulls all assets that we need to track
[ ] invokes priceAsset for each asset based on its config (calls pricing engine to execute for it)
[ ] price engine is stupid since it is stateless and gets told: - asset key - tsMs (number) + block height (number) - priceFeedConfig (how to price it)
enrichment:
[ ] based on shouldPrice flag, either:
[ ] function to scale value and not price it
[ ] function to pull the price for the asset key and TWA it

Swap Handler:

- filter implementation:
  [ ] if swapLegAddress is provided, then we only emit the side that matches swapLegAddress
  [ ] if swapLegAddress is not provided, then we emit both sides
- side note, we had a priceable flag on the action to indicate if it was priceable or not. We no longer need this since the trackable instance will tell us the type, and thus, how we should price it later (should)
  [ ] Trackable aware instance types - if trackableinstance has type: 'asset_based' and has pricing config, then we want action to be "priceable" true and requires the developer to provide the asset field (key + etc) - if trackableinstance has type: 'count' or 'none', then they set priceable to false and don't require the asset field. 'count' requires a quantity field while 'none' doesn't require anything (just a fact that something happened)

the framework should automatically set some of the fields of action() based on the trackable instance type and the config provided. This again allows us to encapsulate the complexity into the manifest and the action prevents degenerate cases from occuring in the first place.

Improved Handler Semantics:
[ ] handler registration in adapter (registration + compile time validation)
[ ] auto-inference system
[ ] zero-boilerplate factory

Event Generalization:
[ ] Create unified event type with different interfaces (aka: subsquid transforms its data into a more general form before it starts to get used through the rest of the framework. This is building an adapter over the data source, rather than just using the data source directly!) - good answer in claude `uniswap manifest config` chat - figure out where this transformation happens in the pipeline

[ ] config validation at runtime. - ensure that we have at least one trackable instnace - pricing stuff (have this linked in this document somewhere above, there are some degenerate conditions)

---

another key mental model shift:

1. Adapter = Event Processing + Routing
2. Handlers = Pure Business Logic + State Changes

This way, the handlers are pure and don't care about the event source.

What we need to watch out for: we can track `asset_based`, `count`, or `none`. How should the action have knowledge of this?

The core issue really becomes the following:

- we need to pass:
  - pricing config from the trackable instance
  - the quantityType from the trackable instance

Solution:

- the handlers SHOULD get an enriched context object. So instead of seeing for existence of something like (if pricing config exists, then true), we should just get a `shouldPrice` flag)

The emit.action() handler will register the asset only if the `shouldPrice` flag is true.
for this, it needs the asset key and the pricing config.

It is enough for the emit.action() to take in: shouldPrice, asset key, and pricing config -> it doesn't need to take in the whole thing.

action doesn't even need an asset field.

Core challenge: we have to reconcile the way we tracked priced and unpriced actions with the way that we define the trackable instance. Once we figure this part out, the rest is solved and easy.

the action handler needs the asset key if we're tracking an asset_based action. it just needs a quantity if it's a count-based action. and it doesn't need anything if it's a none-based action. Asset is only possibly required on the asset_based action.

It shouldn't be the developers responsibility to know what to pass into the action() handler, and instead it should be automatically inferred from the trackable manifest.

This means that somehow, the action handler needs to have knowledge of which trackable instance we're covering so that it can infer the qualifying types.

This indicates a larger question about what it means to "handle" a trackable instance. Can we infer things in the environment or in the types when we realize that we're handling that case?

Some Missing Gaps:

- asset key standardization. Right now, the asset keys can kind of be anything and are set by the adapter. Since each asset is then linked to it's own config (the manifest doesn't really know anything about it, it just maps a string to a config), not sure if it makes sense to standardize them (for better debugability and less indeterminate behavior)
- I don't like the way we're passing trackable instance into the action() + balanceDelta() handlers. It again, couples us with the specific interface of the trackable instance type.
- I also don't like the fact that we define `kind` like `action` or `position` but then don't actually invoke `action()` or `balanceDelta()` on them. There's no checks on this. I could pass something as `lp` and it would be treated as an action, but this is technically incorrect. Yes, the `kind` moreso becomes like a metadata tag, but it's not ideal since it introduces an error surface for the developer, harming the DX.
  [-] Resolve this DX challenge via a new better pattern for handling trackable instances

Refactoring:

- remove rpcCtx from onLog handlers, instead, give a way for the adapters to construct this themselves from the blockheight and chain. this bundles us with the specific interface that sqd provides, rather than cleanly abstracting it away
- block is commonly passed through a lot of functions and interfaces. This again couples us with the specific interface that sqd provides, rather than cleanly abstracting it away
  - instead, we can trace the data from end to front, and only keep in the minimal data that actually gets used. Right now, we're passing in a lot of stuff that is irrelevant
  - this will allow us to then abstract with streams for other indexing frameworks, not just sqd ones (like stellar). aka: can we have events come in via a method that looks different than the way that sqd gives us data? the adapter again becomes the "complexity at the edges" design which is good

## Two-Phase Dispatch (in adapters)

Okay, so now our onLog is emitting a log for everything we could be tracking.
In our case here, we could be tracking

the main goal of the router is to route the log to the appropriate handler.
however,

- multiple different trackables (swap and lp) could be tracking the same log and they both need access to that log
- there are multiple instances of the same trackable type. so for example, we could have 2 instances of swap across 2 diff pools.

we'll do:

- i see a log. how do i know whether to give it to the swap handler or the lp handler? also, for that specific log, it'll be impossible to deliver it back to a single handler alone? we lose information
- instead, why doesn't each trackable instance try to match on the log itself? that way, rather than having the router take responsibility for matching, we invert the responsibility to have each trackable
  match for itself. each trackable for itself.

we could also just say:

- if swap, then send the log to the swap handler. it doesn't need to know anything about the trackable type (but what about filtering?)

We almost have to reverse the mapping between the log and then the trackable instance which is the hard part. we're stumbling into this problem again
since some trackable instnaces have filters and others might not. so when we just get a log, what do we do with it? we have a routing problem here.

let's do two-phase.
if swap, handle swap. if lp, handle lp.

inside the handle swap, we will: 1. decode the log 2. get all instances.swaps where poolAddress matches the log.address 3. for each instance, filter by swapLegAddress if it exists. if none is provided, pass through. if it does, then check against the token0 and token1 addresses for that pool

### Future Scope

There are still a lot of other things to do. What do we work on next?

1. Switch over existing adapters to use new manifest system.
   1. Univ3
   2. Aave v3
   3. Univ2
   4. Demos (transaction based)
   5. regular erc20 token tracking
2. Dockerization + deployment (how to run this locally on my computer via a container rather than a raw nodejs call. This will allow us to deploy into other environments like railway.app)
3. Solana SPL token tracking. This is pretty important to support a wide array of customer use cases.
   1. This will also stress our event generalization efforts. Can we support other types as well?
4. Try to index via rpc only, and without using archive gateways. this will obviously be slower and more expensive, but it will allow us to index more chains and be more evm flexible.
5. Refactoring, lots of passing `block` and `log` throughout the engine which couples us with specific interfaces and makes things hard.
6. we can make the requiredPricer also be from an enum of supported pricers, rather than an arbitrary string.

---

We're seriously overcomplicating the architecture. The core problem is that handlers need to have their type automatically inferred from the manfiest, so we don't allow for bugs like: "using emit.action() on a position trackable like liquidity provided -> this is a duration based metric". Develoeprs have already messed this up in the past where they used transaction type on a position trackable like liquidity provided.

Problem -> Massively Overcomplicating the framework architecture.

for example, poolCreatedTopic is not a trackable. We still track it to know what all the available pools to us are, but it doesn't actually emit any events.

swap DOES emit an event -> action() (eventually, should be swap event for simplicity)
swap also: - updates the current pool tick - gets all positions affected - emit positionStatusChange for each position

increaseLiquidity, decreaseLiquidity -> emits measureDelta + positionUpdate

transfer -> balanceDelta()s

So we are tracking the following topics:

- poolCreatedTopic -> nothing gets emitted, but we use it to know what all the available pools to us are.
- swap emits action(). if we're not tracking swaps, then we STILL need to track it to update the current pool tick and get all positions affected. (dual purpose)
- increase/decreaseLiquidity -> emits measureDelta + positionUpdate
- transfer -> balanceDelta()s

One way to think about this is:

- trackables

Do we even need handlers? Hm...

The point of the manifest is a clean way to define an instance of "what" we're tracking.
We can provide multiple instances too (although this might be confusing)? Especially with more complex adapters.

---

We come to the central question where we have token_based and we don't really know if we need to price it or not until runtime (not at compile time).

This is because this setting is provided via configuration at runtime.

Given a token_based instance, if a pricingConfig is provided, then we know we need to price it. The next question is: how?

We need to know if we have the pricer attached.
We see this from the trackable instance.
We either:

1. Have the adapter writer extract this and tag
2. Pass through the instance into the handler and have the handler automatically infer (this is less error-prone and since that manifest object does not change, we can depend on this existing)
   - Does that imply that we need to pass the instance into the handler every single time? Not sure....

---

I'm having problems wiring everything up inside the engine.

What we want:

- we get a unified event log (or a unified tx shape)
- that gets passed to the adapter
- the adapter emits an event
- the engine processes the event and calls the event handler
- event handler:
  1. gets old values for the balance
  2. marks new assets to track
  3. updates active balances
  4. updates the actual balance
  5. passes through the unified event log

What we want:

- we don't care how unified event log looks like, balanceDelta only needs a few fields (windowbase) to do its job properly
- we pass in the window base object + unified event log (or whatever this is) into the array (for the pipeline, most of those things then get passed straight through)
  - this allows us to have flexibility on the types that get passed in, as long as we can extract the window base which actually allows the engine to do its windowing logic properly

Why am I stalling here? How do i fix this system, and make sure it's future proof well enough that we can throw more block chains, data types ,etc at it?

- tx has diff shape than log
- i am hedging our design so that we can fit in other data in here too (like solana transaction data as well), although could be prematurely optimizating here but it is the immeidate next thing that we have to implement
- feels like we went from: sqd data shape -> unified event log/tx shape -> engine only needs the window base object to do its job properly (it only concerns about calculating the windows and tracking assets, not anything else) -> after pipeline, we get Base event
  - pipeline operates statlesslessly building the object one bit at a time, agnostic of the underlying object (it explicitly defines dependencies of the input object if it needs it)

If we want all the data to look the same at the end (since we want the same resulting interface, we either need to massage it after the pipeline or before the pipeline)
It's much easier to do it before to make the pipeline simpler and be the last step before the actual output

What could actually look different?

- unifiedlog is diff from unifiedtx
- solana is going to have slightly diff data shape

reqs:

- engine should only see windowcontext (ts,height) and emit windowprimitive
- assembled handles shape conversions
- rawbalancewindow is convergence point before pipeline starts (pipeline can take in that shape to start and do its thing)

---

Before, we completely decoupled the pricing from the thing that was being tracked. This made life hard.
We independently ingested the price and the thing that was being tracked.

Now, instead of matching on asset key, it's better to just price each asset based on trackable id.

Each window or action will have a trackableId (hash of the trackable instance, for example).
When we need to price an asset, we can:

1. register the pricing handler ID
2. invoke the pricing handler for each registered price handler (as we move through time)

When we need to gather a TWAP or price an action at a moment in time, we can:

1. for each row, get it's price handler ID
2. lookup price for that price handler ID

Pro:

- assets that are being priced the same way can be re-used across multiple trackable instances
- trackable instances that are tracking the same asset in different ways can each individually have their own logic

It's incorrect to assume that we have 1 price from the pricefeed for all assets.

What we're really saying is:

- All assets matched by this trackable are going to use this price feed. It's still on a per-asset basis, but all those assets are going to use the same price feed
  - when we reprice, we shouldn't just supply the asset, but the price feed as well?

  the reason we have reprice is because if we don't want to wait for the next pricing period to come around, we can refresh the price at that point in time
  - we could also just reprice by passing in the pricing handler rather than the asset (aka: instead of passing asset key, just pass trackable instance and then the reprice will call the pricing handler for that trackable instance)

Problem:

- each trackable instance can match to multiple assets (for example, univ3 lp matches to multiple nfts that each get priced in the same way)
- we register all of the pricing handlers for each trackable instance
- HOWEVER, it's not enough to invoke the pricing handler alone. since we still need to track each "asset"
  - for example, for univ3, we need to invoke the pricing handler for each diff nft asset

This means, we really have to do this:

- when we see a new asset, we register a tuple: (assetAddress, pricingHandlerId)
- the backfill looks at each registered asset, and invokes all the pricingHandlerIds for that asset

Edge Cases to make design more robust:
Ex 1: we have 2 swap trackables. WETH/USDC and WETH/WBTC pools. We select WETH for both (same asset), but want to use different price feeds for each (to enforce better isolation)
SOLUTION: each time we see the swap action, we register (asset, pricingHandlerId). This actually means that we will be backfilling the price both times this way

FLAG: this means that the pricehandlerID is not enough to take the whole thing. It actually is just the top level (the leaf). Is this true?

EDGE CASE:
What happens if we have a recursive price definition, where the top is the same, but the internal is different? Or vice versa? In this case, each pricefeedresolution

Before it was clean since we just priced pure assets. And if we already had the asset price, then we didn't need to get it again (it was cached).
This was very simple to reason about and effective.

However, now we are saying that the same asset can have different price feeds.
Questions:

1. do we really need to cover this case? It will almost never be used. It should only be implemented if it makes the system easier to reason about and less bug prone.
2. It will make it more explicit. If you accidentally have an asset match, it won't be clear why a particular price feed was being used.

The correct mental model is:

- config block defines a pricing strategy. Asset discovery happens at runtime.

The confusing part was NOT that the assetSelectors returns ONE asset. It can return ANY number of assets that should ALL be priced via the same strategy.
Ex: coingecko price feed means we will price likely the 1 asset that represents that token
Ex: univ3 price feed will match on every single nft position and then each asset address will use the univ3 nav pricer. We want to make sure that it matches on the pool address since we define in terms of one asset.

Key insight: each trackable instance needs to resolve pricing to a single asset BUT multiple assets can be matched to that one asset. For example, univ3 pool means each nft of that pool (each nft is diff asset) but we want to price them all via the same strategy that where token1 of the pool is in WETH.

Claude Summary:

## Mental Model Clarification

### The Core Structure

```
Trackable Instance
  ↓
defines pricing in terms of → Reference Asset (the "pricing subject")
  ↓
matches/applies to → Matched Assets (the "things that need prices")
```

### Key Insight (Restated)

**One trackable instance = one pricing strategy = one reference asset**
**But that strategy can apply to MANY matched assets**

The reference asset defines **how** to price (e.g., "price token1 of this UniV3 pool via CoinGecko WETH feed").
The matched assets define **what** needs those prices (e.g., NFT #42, NFT #108, NFT #299 from that pool).

---

## Examples

### Example 1: ERC20 Swap (Simple Case)

```json
{
  "params": { "poolAddress": "0x..." },
  "assetSelectors": { "swapLegAddress": "0xWETH" },
  "pricing": { "priceFeed": { "kind": "coingecko", "coinId": "weth" } }
}
```

- **Reference asset**: `0xWETH` (the thing we're defining pricing for)
- **Matched assets**: `[0xWETH]` (just one—the same token)
- **Strategy**: CoinGecko WETH feed

**Mental model**: The reference asset and matched assets are the same because ERC20 tokens don't have sub-instances.

---

### Example 2: UniV3 LP (Complex Case)

```json
{
  "params": { "poolAddress": "0xUNIV3_WETH_USDC" },
  "pricing": {
    "assetType": "univ3-lp",
    "navPricing": {
      "token0": { "priceFeed": { "kind": "coingecko", "coinId": "weth" } },
      "token1": { "priceFeed": { "kind": "pegged", "usdPegValue": 1 } }
    }
  }
}
```

- **Reference asset**: The pool itself (conceptually: "a position in WETH/USDC pool")
- **Matched assets**: `[NFT #42, NFT #108, NFT #299, ...]` (all NFTs for this pool)
- **Strategy**: UniV3 NAV pricer using WETH CoinGecko + USDC peg

**Mental model**:

- The pricing strategy is defined **once** in terms of the pool's tokens
- But it gets **applied** to every NFT that represents a position in that pool
- Each NFT is a different asset address, but they all use the same strategy

---

## The Indirection Chain

```
Config Block
  ↓ defines
Pricing Strategy (references pool's token0/token1)
  ↓ applies to
Matched Assets (NFT #42, #108, #299...)
  ↓ each needs
Handler invocation: resolve(strategyId, nftAddress, block)
  ↓ which internally
Looks up pool for that NFT → gets token0/token1 → prices them → calculates NAV
```

---

## Why This Model Works

### 1. **Pricing is defined once, applied many times**

- You configure the strategy **once** (e.g., "price this pool's positions using WETH feed")
- The system discovers **N assets** (NFTs) that need that strategy
- The handler is invoked **N times** with different asset addresses

### 2. **The handler needs the asset address**

```typescript
resolve(pricingHandlerId, assetAddress, block);
```

- For NFTs, `assetAddress` is the NFT token ID
- The handler looks up: "which pool does this NFT belong to?"
- Then applies the pool's pricing strategy (already captured in `pricingHandlerId`)

### 3. **Asset selectors vs params**

- **`params`**: Define what trackable instance we're configuring (e.g., which pool)
- **`assetSelectors`**: Define which assets within that instance to price (for swaps: which leg; for LPs: implicit—all NFTs)

---

## Reconciling Your Original Confusion

> "Each trackable instance needs to resolve pricing to a single asset BUT multiple assets can be matched to that one asset"

**Reframed**: Each trackable instance defines a pricing strategy in terms of **one reference context** (e.g., a pool), but that strategy **applies to multiple matched assets** (e.g., NFTs).

The "single asset" is not literally one asset address—it's one **pricing definition** (one strategy). The matched assets are the actual things that get priced using that strategy.

# Checklist

- Identify where the engine currently assumes one asset per trackable instance
- Modify registration to store `(trackableInstanceId, asset) → pricingHandlerId` mapping
- Update backfill to iterate over all registered `(trackableInstance, asset)` pairs
- Ensure handlers receive the specific asset address when invoked

---

## Current Problem in the Engine

The engine registers pricing handlers per **trackable instance** but doesn't account for the fact that:

1. Multiple assets can be emitted for the same trackable instance (e.g., both sides of a swap)
2. The pricing handler needs the specific **asset address** to resolve pricing

Looking at this code:

```typescript
// Track asset for pricing for token_based actions with pricing configured
let pricingHandlerId: string | undefined;
if (quantityType === 'token_based' && e.trackableInstance.pricing !== undefined) {
  pricingHandlerId = await this.registerPricingHandler(e.trackableInstance.pricing);
}
```

**Issue**: This registers the handler once per trackable instance, but doesn't associate it with the specific asset being emitted.

---

## Proposed Changes

### 1. Change Registration Model

**Before**: `pricingHandlerId` stored per event
**After**: Register `(trackableInstanceId, asset) → pricingHandlerId` in Redis

```typescript
/**
 * Register an asset for pricing under a specific trackable instance.
 * This allows multiple assets to share the same pricing strategy.
 */
private async registerAssetForPricing(
  trackableInstanceId: string,
  asset: string,
  pricingConfig: AssetConfig
): Promise<string> {
  const pricingHandlerId = generatePricingHandlerId(pricingConfig);

  // Store the pricing config (if not already stored)
  const handlerKey = `pricing:handler:${pricingHandlerId}`;
  await this.redis.setnx(handlerKey, JSON.stringify(pricingConfig));
  await this.redis.sadd('pricing:handlers:registry', pricingHandlerId);

  // Register the (trackableInstance, asset) → handler mapping
  const registryKey = `pricing:assets:${trackableInstanceId}`;
  await this.redis.hset(registryKey, asset, pricingHandlerId);

  return pricingHandlerId;
}
```

### 2. Update `applyAction` to Register Per Asset

```typescript
private async applyAction<T extends UnifiedBase>(e: ActionEvent, d: T): Promise<void> {
  const quantityType = e.trackableInstance.quantityType;

  // Track asset for pricing for token_based actions with pricing configured
  let pricingHandlerId: string | undefined;
  if (quantityType === 'token_based' && e.trackableInstance.pricing !== undefined) {
    const asset = (e as any).asset;

    // Generate a stable trackable instance ID
    const trackableInstanceId = this.generateTrackableInstanceId(e.trackableInstance);

    // Register this specific asset for this trackable instance
    pricingHandlerId = await this.registerAssetForPricing(
      trackableInstanceId,
      asset,
      e.trackableInstance.pricing
    );
  }

  // ... rest of the function remains the same
}
```

### 3. Update `applyBalanceDelta` Similarly

```typescript
private async applyBalanceDelta<T extends UnifiedBase>(
  e: BalanceDelta,
  d: T,
  ti: InstanceFrom<TrackableDef>,
  reason: WindowReason,
) {
  // ... existing code ...

  // Track the asset in Redis if this trackable is priceable
  let pricingHandlerId: string | undefined;
  if (ti.pricing !== undefined) {
    const trackableInstanceId = this.generateTrackableInstanceId(ti);
    pricingHandlerId = await this.registerAssetForPricing(
      trackableInstanceId,
      e.asset,
      ti.pricing
    );
  }

  // ... rest of the function remains the same
}
```

### 4. Add Helper to Generate Trackable Instance ID

```typescript
/**
 * Generate a stable ID for a trackable instance based on its configuration.
 * This ID uniquely identifies a pricing strategy scope.
 */
private generateTrackableInstanceId(ti: InstanceFrom<TrackableDef>): string {
  // Hash the trackable instance's identifying properties
  // For UniV3: adapterId + kind + poolAddress
  // For Swap: adapterId + kind + poolAddress + swapLegAddress (from assetSelectors)
  const key = JSON.stringify({
    adapterId: ti.adapterId,
    kind: ti.kind,
    params: ti.params,
    // Include assetSelectors if present (for swaps)
    ...(ti.assetSelectors && { assetSelectors: ti.assetSelectors }),
  });
  return md5Hash(key);
}
```

### 5. Update Backfill to Handle Multiple Assets per Trackable

In `pricing-backfill.ts`, the backfill needs to:

1. Scan all registered trackable instances
2. For each trackable, get all its registered assets
3. Price each asset using its handler

```typescript
// In pricing-backfill.ts
export async function backfillPriceDataForBatch(blocks, deps) {
  // Get all registered trackable instances
  const trackableKeys = await deps.redis.keys('pricing:assets:*');

  for (const trackableKey of trackableKeys) {
    const trackableInstanceId = trackableKey.replace('pricing:assets:', '');

    // Get all assets registered for this trackable instance
    const assetToPricingHandler = await deps.redis.hgetall(trackableKey);

    // Price each asset
    for (const [asset, pricingHandlerId] of Object.entries(assetToPricingHandler)) {
      const pricingConfig = await getPricingHandler(pricingHandlerId, deps.redis);

      for (const block of blocks) {
        await pricePricingHandler(
          pricingHandlerId,
          pricingConfig,
          asset, // ← Pass the specific asset
          block.header.timestamp,
          block,
          deps,
        );
      }
    }
  }
}
```

---

## Key Changes Summary

| **Aspect**             | **Before**                  | **After**                                                     |
| ---------------------- | --------------------------- | ------------------------------------------------------------- |
| **Registration**       | Per trackable instance      | Per `(trackableInstance, asset)` pair                         |
| **Redis Structure**    | `pricing:handler:{id}`      | `pricing:assets:{trackableId}` → hash of `{asset: handlerId}` |
| **Handler Invocation** | `resolve(handlerId, block)` | `resolve(handlerId, asset, block)`                            |
| **Backfill**           | One price per trackable     | One price per asset per trackable                             |

---

## Validation

✅ **Multiple assets per trackable**: Swap emits two assets → both registered under same trackable
✅ **Same pricing strategy**: Both assets use the same `pricingHandlerId` (derived from trackable config)
✅ **Handler gets asset context**: Backfill passes specific asset address to handler
✅ **No duplicate registration**: `hset` ensures each asset is registered once per trackable

**Proceed?** This allows the engine to track multiple assets per trackable instance while maintaining a single pricing strategy definition.

---

This now has to do more with the way we do pricing:
Price fields that are required. Let's start simple:

- quantityBasis
- quantity
<!-- - valueUsd (how much is the position worth)
- tokenPriceUsd (how much is each asset worth)
- pricingMethodLeaf (how did we price this?) -->

Values for quantityBasis:

- none (nothing at all) -> this count as 1 by default
- count (just a number)
- asset_amt (how much of that asset? accounting for decimals)
- monetary_value (how much is this worth in usd?)

logic for each:

- `quantityBasis`
  if quantityType = token_based AND pricingHandlerId is defined -> then monetary_value
  if quantityType = token_based AND pricingHandlerId is not defined -> then asset_amt
  if quantityType = count -> then count
  if quantityType = none -> then 1

- `quantity`
  if quantityType = token*based, then resolve the number of decimals for the asset
  tokenQuantity = quantity / (10 \** decimals)
  then, if quantityBasis = monetary*value, fetch the twap price for the asset
  monetary_value = quantity * assetPriceUsd
  if quantityBasis = asset_amt
  asset_amt = tokenQuantity

if count -> then quantity
if none -> then 1

Easiest way is to define the shape:

```ts
{
  user: string;
  asset: AssetInfo:
  activity: Activity;
  meta?: Record<string, any>;
  ts: number;
  height: number;
  value: string;
  txRef: string;
  chainCtx?: Record<string, any>;
  quantity: string;
  quantityBasis: string;
  pricingHandlerId?: string;
}
```

---

Here's what we need.

I'm building a pipeline in typescript.
Each of these is an enricher, that is stateless and operates on a single item at a time. This makes it very easy to reason about, and test.

They will do things like:

- dedupe row
- add runtime information to each row
- format existing keys
- delete extraneous keys
- enrich with token price
- format metadata in the proper way
- check if the address is an EOA or contract, and removes the row if it's not

In effect, it's enrichment, filtering, formatting, etc. Any transformations can go through here.

The pipeline has the following gaurantees:

1. It takes in data that fits a certain shape
2. Each step can be:
   1. independent (doesn't require any data from the previous step)
   2. or require a field (which was in the original data shape OR added by a previous step)

At the end, we have to confirm that the data shape after processing fits the end shape of the data.

This way we have full end to end type safety, and if we change the final shape, the pipeline will fail to compile (fail fast which is good!)

The current architecture doesn't seem to be working, can you please help me create a better set of primitives to do this? We are very overdue on the project, and it needs to be done well and explainable to the team.

---

Let's set some requirements:

1. The adapter code needs to register the price feed handlers
   1. Question: should they be registered in the defineAdapter function, or is it enough to just call `defineFeed` anywhere where they export it?
      Answer: do it in the defineAdapter function so the code is self-documenting and very clear.

2. When registering a price feed handler, what does the developer need to provide?

- name (via the key in the priceHandler array)
- define which assetType the handler works for (erc20, erc721, spl, custom with prefix?). This will also give the type of assetConfig that will be passed to the handler so we can easily get the address, tokenid, etc from this typed object
  - the feed handler then will invoke the asset key method so we get an already properly created object from the key
  - if we're dealing with custom, then the price handler will be responsible for getting the proper object from the key (rather than those objects being provided).

3. what happens when exported?

- in the defineAdapter hook, we will also register the handler in the price feed registry (we essentially call defineFeed on the handler)

4. how do we ensure that the right asset is passed to the price feed handler?

- rather than the developer doing it, we should do it automatically based on the assetType that they provide
- this gets harder if it's a custom one since they would need to provide the `prefix` if it's custom

Need to make the new handler and the old handlers compatibile. Need to define type definition that works for both and migrate. We shouldn't have 2 defintions of handlers as this is error prone + confusing.

---

Scope for moving pricing handlers into adapters AND stable asset keys for engine:

Adapter says: (2 new features)

- I am registering these handlers
- Some of my trackables might require a handler that's defined in the core framework OR that I registered in the adapter myself

Questions for adapter feed registration:

- Where is config defined?: config is defined as part of the adapter feed definition (this tells us what the adapter needs)
- When is the config validated?: config is validated at runtime when we pass in the runtime config. it matches against the zod schema of that particular price feed config
- What about recursive pricing configs?: This should probably be done by zod. Need to figure out how we can do this with intput/output asset types so that it's clear what types we can select and we can fail at runtime for incorrect configurations. For example, univ3lp that then defines a config for univ2nav will fail because this makes no sense. Recursive configs should be done by zod. <-- THIS DESPERATELY NEEDS MORE THOUGHT SO WE DON'T BLOW UP THE SCOPE OUT OF PROPORTION. NEEDS MORE EXAMPLES.
  - This recursive step is closely tied to the `resolve` implementation and signature.

Register Adapter:

- registers the price feed handlers
  - handlers are auto-prefixed by the adapter name
  - if there ever is a collision, we error everything and prevent the adapter from running
  - Does manifest.trackables[].requiredPricer reference a handler that exists?: This needs to be derisked. not clear how this can happen .

Adapter Emit Fns:

- anywhere where there is an `asset` field now takes in an AssetType (type, address, etc). This is what allows us to have a stable key across the engine.
  - framework calls getAssetKey and passes it to the emit functions (inside that factory that maps emit functions)
  - redis stores the full key (erc20:0x123, erc721:0x123:999, etc)

Price Feed Handler:

- I take in the following types (ex: 'erc20' or 'spl'). KEY INSIGHT: this changes the type of assetConfig that I recieve

Should the price handlers define what they take in and what dependencies they should take? This will allow us to flag incorrect pricing configs at runtime (and help us compose these price handlers the right way)

For example:

- erc20 can be priced via univ3pool. that pool needs a price feed for the asset (since we just get an exchange rate). This is also an erc20 asset. So univ3pool prices and erc20 and outputs an erc20 asset.

Metadata Resolver:

- Based on the asset type, we pick the right metadata resolver. This is already done in the core framework, so we don't have to do anything here. Custom key handlers DO NOT return a metadata object (or 0 decimals)

Price handlers can say:
What do the types give us?

calling an univ3lp handler on a regular nft (that's not an lp nft) will fail anyway at runtime
coingecko doesn't need to price an erc20 since it takes in a coingecko id (not even the address) so it's a moot point

It only helps us for the configuration so that we know:

univ3 : requires a univ3lp pricer
the univ3lp pricer can define any erc20 pricer (including coingecko) so then the config screen will only display the erc20 pricers (it won't display)

Rather than mentioning a required pricer, we only really care for a trackable to use a price handler that is provided by the adapter itself. We would never add a price handler through the adapter if we weren't going to use it (otherwise, we'd write it as part of the core framework)

Instead of this, we can provide the requiredPricer not with a string but with the actual implementation of the price handler. Then we can register the price handler in the manifest rather than a separate field altogether (which makes more sense anyway)

For now, let's not worry about the input/output types of price handlers. We can do that later if necessary. You can select any of the core framework price handlers if needed in that case (we would never expose the adapter price handlers to the configurator anyway)

Instead, we can add a manifest to the core price handlers so that we can get typings (in the same way that we have for the manifest to know what types of assets its good for, etc). This doesn't need to be part of the type system, it can just be done as part of the manifest for the price handlers themselves (since its at config-time only information)

Pricers define what type of asset key they operate on so they have better type safety and we don't need to separate the asset keys in the handlers themselves (this is a framework responsibility)

When the handler recurses, it should pass in the AssetType object rather than the raw string.
--> The big change here would be that we get an assetType object instead of a string so we can properly make sense.

The handlers would still need to define if it takes in a certain asset (ex: pegged / coingecko take in any since it doesn't depend on the asset type). But univ3lp nav would take in a erc721 asset (although we don't care if it's the right nft, that's a runtime error). univ2nav would take in a erc20 asset.

The framework checks if the assetType matches what the handler expects. if it doesn't, we error at runtime.

NOTE: at runtime, if top-level feed doesn't match the requiredPricer name, we error.

## Feed handlers

A feed handler definition defines a few things about each price feed handler:

- the name
- the config schema that it takes (that we can provide at runtime)
- narrow to an asset type it can price OR if it can price any asset type (coingecko doesn't care about the asset type) -> this is mainly for runtime protection although I would argue it's not really necessary. so we should just skip this.
- manifest -> helps us define the config screen by saying what it works with etc
- handler itself -> the function that actually prices the asset and can call other handlers downstream

One you define the feed handler, it gets registered.

When you call price asset, it needs to know which pricer to call. The pricing handler is passed through the trackableInstance.

---

#

## End to end flow of the pricing system

Right now this is terribly confusing, we're in the middle of a migration and it's not clear at all how the pricing stuff is supposed to work.

We have successfully moved the pricing handler into the adapters to keep things a bit simpler. Now, we have to figure out how the framework works for this.

Pricing happens on a schedule, not based on an event for holding data.

However, when we do `applyAction` we actually only need to price that asset at that time (or within some bound).

So if nothing happens, we actually don't need to keep getting the price for that asset. Let's put a pin in this, this is a pretty important difference (that we both have to support pricing on a schedule AND pricing on demand depending on what we're actually tracking).

So this is what happens (just when we price on a schedule):

### Price Feed Registration

At startup, all the pricing handlers are registered in the pricing engine.
When we invoke "registerAdapter" we also look at the pricing handlers that are defined in the manifest and register them in the pricing engine. This is important so that we load in all the pricing handler code into the registry.

This will check that the price

### Runtime Config Validation

We need to ensure that the provided price feed object:

1. Matches the required price feed handler at the top if the price handler defines a price feed handler (this can also be config time only check, although better at runtime as well)
2. Nested price feeds are all valid and properly defined

### Engine Code

in `applyBalanceDelta`, just save AssetKey And FeedConfig (this is "registering" the asset)
(we will probably need to change pricing-backfill)

### Pricing-Backfill

Get all assets, parse the FeedConfig, and then call PriceAsset for that pair.

### Resolving (new)

The responsibility of the resolver is:

- take a nested feed config, call each of the parts recursively, and return a final number.
- it also takes in a timeMs / blockHeight.

Feed configs:

```ts
{
  feed: {
    "kind": "univ2nav",
    "token0": {
      "kind": "pegged",
      "usdPegValue": 115764.58
    },
    "token1": {
      "kind": "coingecko",
      "id": "pepe"
    }
  }
}
```

or something like:

```ts
{
  feed: {
    kind: "coingecko",
    id: "usd-coin"
  }
}
```

Order of operations:

1. Change engine.ts to save `pricing:(toString(Asset), JSON.stringify(FeedConfig))` in applyBalanceDelta + applyAction
2. Change pricing-backfill to fetch all the keys. For each key, we invoke priceAsset with the Asset and FeedConfig at that ts/blockheight
3. Pricing engine in `priceAsset`:
   1. gets handler that was imported/registered
   2. confirms that handler type matches the assetType (in the key)
   3. calls the handler (recurses through the feed config)

<!-- ### Asset Registration
When we do `applyBalanceDelta`, we need to register the asset (that we need to start pricing it periodically).
We save the following things (need to confirm if we even need all of these things):
  - trackable instance id (how was this discovered?)
  - asset (full string key?)
  - pricing config (type: 'erc20', handlerConfig: { type: 'coingecko', id: 'pepe' }) -->

<!-- ### Pricing
During the backfill price data for batch, we need to:
1. fetch all the trackable instances
2. for each trackable instance, fetch all the assets that it has registered
3. once we have a pairing of: (asset, trackableInstanceId), we can invoke the pricing handler for that pair -->

#### Resolving

Once we decide to price it, we need to figure out a way to actually resolve the handlerConfig.

1. The handlerConfig can be nested, so it needs to recurse through the nested config to get the price.
2. We need to make sure we're passing in the right asset type to that handler. (can't pass erc20 to a univ3lp handler)

Open question about scheduling vs within hour time:

- If a trackable instance if an 'action' based one, and we already have a price within the hour, it can just skip it. This is more of an optimization than a different flow? We still price on a schedule (every hour?)

---

Additional context:
The way pricing works:

- pricing happens on a schedule. We have a multitude of assets (that are found at runtime)
- each of those assets is matched to a feed known at the beginning that determins HOW to price it (this is deterministic and fixed at the beginning by the config)

As we discover new assets, we need to register them with the trackable instance/pricing config that is responsible for that event so we know how to find that new asset that we found at runtime.
