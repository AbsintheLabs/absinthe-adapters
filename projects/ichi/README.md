# Primitives

We are tracking assets.
Each asset can have labels (which is just metadata). These labels do NOT change over time and are immutable.
Each asset can have multiple metrics associated with it. These metrics can change over time and are mutable.
Each asset has a price feed definition, which is a way to price an erc20 or erc721 token.

- Different strategies exist for this. For example, the way you'd price a univ3 nft LP is different from pulling the current price of bitcoin from coingecko.

Different events are used for different things:

1. BalanceDelta -> Track ownership of the asset (token or nft)
2. MeasureDelta -> Track a metric of the asset (token or nft)
3. PositionUpdate -> Indicates that we should emit a new row for a position (a measure doesn't necessarily indicate change to a position)
4. PositionStatusChange -> Positions can be active or inactive. This event indicates that the status of a position has changed.
5. Reprice -> Indicates that the price of an asset has changed and should be repriced at this instant.

All of the events above represent changes to the ownership/holding of an asset.

Often, we also want to emit some data for some action that happened on chain.
These are not necessarily related to ownership of an asset over time, but instead represent some instantaneous action.
This could be, a contract function call, a swap, a pool creation, an nft mint, an erc20 mint, etc.

We often want to price these actions as well, but they don't necessarily represent a change in ownership of an asset.
However, they often DO need to be priced (such as pricing the gas fees of a transaction, the price of a swap, the mint price, etc).

Sometimes we know the asset ahead of time, then it's easy.

Swaps are tricky since they relate to two assets, and we often only have price feeds for only one of the assets.
This would require a swap resolver.

Instead, let's create a new first-class concept called an "Action".
Each action is it's own "kind" in a price feed.
Instead of kind "erc20" or "erc721", we have kind "swap", "mint", etc.

Some examples of actions:

1. Swap
2. Mint Price
3. Bridge Amount
4. Auction Bid
5. Claim Amount

Fortunately, most of these will have the same pricing strategy (ex: single asset price).
Swap is the only exception since we have to define which side of the swap we actually care about in the config.

swap:
{
user: string;
asset0: string;
asset1: string;
amount0: Big;
amount1: Big;
}

mint:
{
user: string;
nft_asset: string;
payment_asset: string;
amount: Big;
}

Bridge amount:
{
user: string;
asset: string;
amount: Big;
}

auction bid:
{
user: string;
asset: string;
amount: Big;
metadata: {
saleId: string;
bidIndex: string;
}
}
claim amount:
{
user: string;
asset: string;
amount: Big;
}

auction winner claim:
{
user: string;
metadata: {
saleId: string;
}
}

demos contract verification:
{
user: string;
}

Let's think about how this will be wired together:
Adapter emits swap action
Action needs its own pricing config (so we know how to price it)
Match

## Next Steps

1. Create Action Type and Swap Action Subtype - DONE ✅
2. Emit the action event from the swap
   1. Add conditionals to not track the LP so that testing is MUCH faster while we're doing this part - DONE ✅
   2. Need to pass in tx object into the log as well (since we often do transaction.from and transaction.to from transaction objects) - will do later
3. Make sure that we can set immutable labels or attributes on the action so we can match the config on them properly - DONE
4. Allow AnyIn to have the matcher pass in parameters (like the tokenselector) so that we don't have to double up on the configs to match each side - DONE
5. Wire this up so that the proper part of the config gets called for the swap (related to 3) - i think done?
6. Add new price resolver for actions (start with swap) - Done
7. Test it - DONE
8. Make sure we pass in the event name automatically? rather than manually?. Needs to be done manually, but rather than letting the implementer specify, we can have a couple of common constants for this instead.
9. Need to tell lending / borrowing apart for the same adapter (EVEN THOUGH they are both TWB metrics. don’t assume each adapter will have at most 1 of twb or event based tracking)
   1. What would tracking multiple TWB's for one adapter look like? What about multiple Actions for one adapter? It should generalize to many.
10. Start refactoring to fit ports+adapters model so that engine is decoupled properly. Then, we can start running some tests on its component parts.
11. (edge case) Make sure that index ordering is done correctly (if multiple txs in the same block and the ts will be the same) - order not just on ts but ALSO log index if timestamp is the same (precedence of comparison obv)

## Wiring Events

The complete flow is: Adapter → Emit Function → Engine Handler.

- **Define event types** in `types/core.ts` - Add your custom event interface (e.g., `ActionEvent`, `SwapEvent`) with required fields like user, amounts, meta, and attrs
- **Add emit functions** to `LogEmitFunctions` interface in `types/adapter.ts` - Register new emit methods (e.g., `action`, `swap`) that adapters can call
- **Implement handlers** in `engine/engine.ts` - Wire the emit functions to processing logic that transforms events into `RawEvent` objects for the pipeline

### Pricing Logic

We separate concerns of pricing assets FROM keeping tracking of each users balance.

For balances, we just track every users balance of their asset.
We separately backfill the price of all the active assets.
We then combine the two during the enrichment step to price every users position.

This works for balances of erc20 tokens (fungible) and also erc721 (nonfungible).
If it's fungible, we only need to get the price of the token.
If it's nonfungible, we need to get the price of every tokenId, since each nft is unique and has its own price.

Now, we have to extend this system to pricing actions.
Actions represent some instantaneous action and have an underlying asset that we want to price.

This is pretty easy because each Action already has the user and the asset + amount that we want to price.
The hard part is that an Action is defined by an array of "Amount"s (each with an asset and amount)
so we need to know which one we want to price.

For a swap, we can build this in directly since we can somehow wire up the config to tell it which amount it should price as part of the "swap" price kind.

However, for arbitrary generic actions, we should either price one or all of them. This is a problem, because if we price all of them, then we'll be pricing the same action multiple times. Do we add them up by default? Do we have a separate "action" price kind? This feels clunky and error prone.

The system should be simple and easy.

I would argue to limit the number to only one amount.

The problem is that swaps contain 2 legs, and we don't know ahead of time which one we want to price (since this is configuration driven at runtime).

What are our options?

1. We could emit 2 actions for a swap, one for each leg, and then filter out the one that we don't care to price.
   Pros: Maintain 1 asset per action guarantee.
   Cons: We would have to introduce some kind of idempotency mechanism to avoid pricing the same action multiple times.
   Config must enforce that we know which one we actually care to price.

The swap can simply be a special case and we could abstract sending out the Action two types, with idempotency handling built in. The implementer CAN emit both legs if they'd like manually, but the swap event becomes syntactic sugar over this as it's a common pattern across many adapters.

2. We keep multiple assets per action. Each "kind" has to define which one we actually want to price. By default, we just price the first one.
   Pros:
   Cons: Each new action "type" would require registering a new type of actionKindHandler. This is more work for the implementer and adds more complexity since we have to
   create yet another handler registry.
   Pricing the first by default and discarding the rest is akin to "magic" and can cause confusion since the behavior is not explicitly defined in the types or config.

3. Each action specifies its own strategy for pricing. It accepts multiple assets, but a strategy is defined for each one. Ex: 'first', 'sum', 'last', etc.

4. Each action can be composed of multiple actions. This is essentially a subcase of the first option.

I don't love gpt's recommendation, it's needlessly complex + complicated.

Let's frame it this way:
Let's keep each action to have exactly one asset. We can emit 2 actions for each leg of the swap under the same id.
Then when we have to price an action, we really just have to match at least one price on the action.

Here's a few cases that we'd like to handle:

1. Swap. 2 assets are supplied, but we only care about pricing one of them to track "volume".

- we would emit 2 actions with the same id, but different assets, so the pricing engine would match at least one price on the action.

2. Multi-deposit. We want to track how much volume was deposited, but multiple assets are deposited at the same time.

- this one is easy, we would emit multiple actions with DIFFERENT ids since we care about the 'sum' of the amounts.

We would rarely want to hold a strategy (like first, last, sum) since we can just emit multiple actions with the same id and different assets.
If you care about ordering, we could sort them lexicographically, so you can choose the key you want to sort by, if you really want to? need to think about this,
numeric id is probably better since that's easier to reason about than a string. you can optionally provide an extra key and if you do, then it will be used to sort them.

Even this is probably overkill, so we should not include it for now.

So the types become even simpler:
We have an amount type (asset, amount, role?) and an action type (id, amount:Amount, attrs?)

Let's model this with a swap:

const {
tick: tickBN,
sqrtPriceX96,
liquidity,
amount0,
amount1,
recipient,
sender,
} = decoded;

we would emit 2 actions with the same id, but diff assets:

{
id: hash(transaction.hash+log.logIndex),
amount: {
asset: token0Address,
amount: amount0.abs(),
role: amount0.gt(0) ? 'input' : 'output',
},
user: transaction.from (or sender)
}

So when we price one of the legs, what would we do?
If we don't match on the asset, then we don't have a price for it.

If we only select for one leg, then we don't have a price for the other leg.

If we serendipitously match price for both legs, then it doesn't matter which one we price.

Now the question becomes, at what point does the deduplication occur?

I would argue it should happen at the enrichment step.

Event emittance knows nothing about the deduplication.
Pricing also knows nothing about the events. It just sees the assets it needs to try to fetch the price from.

The enrichment step will look at all actions, and filter out all the ones that don't have a price for the asset.
THEN, it will filter out all the ones that have the same id (leaving only the first one). This ensures that we don't price the same action multiple times,
but only leave the one that we want to price.

There are 2 questions to answer:

1. Typically, configs take in a key, like a pool. But no, we can simply provide the token address that we care about pricing and it will match on that, so i think we're good here. But you would need to know about the token addresses in advance.
   1. FUTURE SCOPE: can we put other events in a quarantine, and then hot-reload in new configuration that could match on the quarantined events and emit them once they're matched? This allows the indexer to keep running, without needing to add new config, restart, etc. You could just see what hasn't been matched, and then extend the config to match on the new events.
2. Some actions don't actually need to be priced. For example, there is no pricing for a contract call (like a function call).

What are some options?:

1. Asset could include a flag to indicate that it should not be priced. In this case, we won't even try to match it on a price feed AND we won't filter it out during the enrichment step.
2. Separate actions into priceable and non-priceable. Cons: introduces more complexity.
3. Make asset null which implies that it should not be priced. Cons: not very intuitive and could create bugs when asset accidentally not supplied. It should be explicit, not implicit.
4. Create a special asset type (magic constant) that indicates that it should not be priced. Cons: requires knowledge of this magic constant which is not intuitive.
5. Create a new variable (like 'priceable') indicating whether it's priceable or not. If it is, then we require asset and amount to be supplied. If it is not, then we don't require them.

Then, next problem: how will this look like for twb, and not actions? For example, number of nfts held means we don't necessarily want to price them, but just want to track how many of each nft is held.

How about for twb?
Use cases for when we don't care to price something in usd:

1. number of tokens held
2. number of nfts held

This would likely be configuration driven?
There could be two modes:

1. Price in usd (must supply assetFeedConfig)
2. Don't price in usd (don't need to supply assetFeedConfig)

Because tracking TWB necessarily implies that there is some asset, and we can opt in to track it. If we don't, then we don't need to supply an assetFeedConfig and we
don't have to filter out the empty rows from twb.

On the contrary, some actions (like a contract call / verification) has no notion of an asset and so there's nothing to price.
Other actions however, like a swap, do have an asset and so we can price it.

---

There is one remaining problem: if we re-run the indexer one time with pricing and another time without pricing, then our event id will be the same and if we want the row with prices (when before it was without prices), then we'd have to manually go in and delete data.

The fundamental problem is that price sources are not deterministic, and so we cannot use the valueUsd of the position as part of the deterministic event id of a row.

If we omit it however, and we send one row without prices, and later another row with prices, then the row without prices will win, since it's first.

Ideally, the user has the ability to select the data they want properly.

For example, if they just care about one point per nft held per day, then there is no such thing as a valueUsd, but there is a amountBefore and amountAfter.

However, how does the points computation model know which field to select?

Arguably, instead of a valueUsd field, we should just call it a value field, and then there's another field that determines what type that field represents.

For example, if it's priced in usd, the value would be 'usd'. If it's not, we would call it 'raw'.

That way, both of those rows can be stored in the same table, and the user can select on the types (for example: "give me the rows where it's actually priced in usd").

There is still a problem if I send in data again (since my old data was bad), and we can also just change the policy where we don't ignore the row on conflict, but instead update them. This would be a change to the python job that streams from kafka into motherduck.

Instead, we can assume that the user will only send in data once. We include a field name that represents that type of the value field, so you can track both USD value AND raw value at the same time if you prefer.

However, the value field doesn't actually get used in the hash.

What are the next current steps? Let's have achievable and small goals so we can knock them out quickly and move on to the next thing.
There's a lot of time to go back and clean things up. This is necessary, but we should focus on immediate goals first and THEN once we reach some state of completion and the primitives are established, we can architect it hexagonally with adapters AND THEN: we can introduce testing into the framework.

What does this require?
[ ] Passing in event name into the action (so we can easily later categorize it)

- we can have 'raw' and 'usd' as constants for this for now signifying whether it's priced or not.
- logically, what does it mean for an action to have no asset and no amount? For example, a user verification on a contract call is an action, but not one that represents an asset at all, and therefor doesn't have an amount. An asset and amount are linked properties together.
  [/] Init function that allows you to make calls out to contracts -
- need to decide, will we pass through the sqd rpc ctx object from the first block? Or just create a helper method that wraps ethers that will call it at the current block height?
- need to see which is the simplest, since the params returned by onInit() might be used during the processor construction, and so this eliminates us from being able to use the sqd rpc context at all
- we might have to go along with the second method, but then we need to create a simpler interface over the sqd Contract implementation so we can still use all of those goodies
- given how annoying this is, and it could just be a param, let's avoid doing this for now

Next protocols to derisk primitives before we start cleaning:
[x] Demos contract verification (no asset + transaction based)
[-] Passing in 'priceable' flag into the action so we know whether we should later price it or not (should this automatically change the currency to something else?) - NOT TESTED!! ❌
[ ] Aave v3 lending and borrowing (each erc20 asset has to be priced separately) + introducing new primitives for lending and borrowing
[ ] Raw erc20 token tracking (what happens when we don't want to price the tokens at all?)
[ ] Layer3 cubes erc721 tracking
[ ] Curve - YAP (yet another protocol) to add into the mix
[ ] Require a separate asset even for each erc20 token for variable debt token since they cannot be transferred and need to be priced separately
[ ] Curve needs separate lp price adapter. aTokens are easy since they can be priced 1:1 via underlying
[ ] re-introduce ichi + gamma as they are already written (but with configuration built in)

### Refactoring Problems

[x] Figure out why univ3 stopped running with the new changes - // BUG!!

[ ] Enrichment types are horribly fucked and need reworking
[ ] Enrichment does not support things like api key, runnerid, eventid hashing, etc
[ ] Univ3 adapter is horribly complicated to read + understand. Would benefit from refactoring and/or further abstractions.
[ ] Cross reference the actual final data we want. Things we might be missing:
[ ] event name on actions
[ ] Registration of adapter happens in adapters/index.ts. Can we do this on the adapter itself? What if we want to add an adapter that we don't know of yet? maybe this is fine, can't have too many things happen at runtime...
[ ] remove the io / projectors from the adapter definition, they currently muddy things up and are confusing
[ ] protocol type
[ ] metadata on actions
[ ] metadata on twb

### Future down the road problems (not for right now)

[ ] Redis doesn't have key prefixing. Either we connect to another internal DB (easiest solution) or support key prefixing so that we can use instance for many adapters
[ ] Auto-promise resolver with jitter + exponential backoff. Nice utility function we can use around the indexer
[ ] Some params from the config should actually be loaded in from the env (like the rpc url if it's api key gated)
[ ] Support proper indexer ordering (by logindex if multiple txs in the same block)

### Next Extensions

[ ] Create a univ3 price feed that resolves the price to the other token (it will only make sense if you tie it to a stable pair to get the usd price)

## The transaction/log metadata problem

The sqd processor returns essentially 2 arrays: an array of event logs and an array of transactions that we're tracking.
We currently have a handler called onLog() that runs over every single event log emitted.

The reason we have these handlers is because they attach metadata to the events that we want to track: (for example, which block did something come from?) what was the block hash? what's the txhash? what's the time stamp? what about the gas of the transaction?

I don't want to create separate functions between logs and transactions since events are independent of where they come from.

What the applyLog does is attach metadata that is used for visibility later.

The easiest thing to do would be to have transactions + logs have the same handler, and fields that don't apply by one or the other are just null.
We COULD have separate handlers and a router between them, but I don't think it's worth the complexity given that Solana data is going to break our mental model around this very soon anyway.

We probably want to keep onLog and onTransaction separate, since it makes it much easier to reason about where data is coming from.

We want the same emit events to be returned from both onLog and onTransaction.

I had to look into ts type narrowing to understand and how ts-pattern does clean pattern matching. Research time was helpful in this regard.

In the engine, every time we see a log or a transaction, we route it to the adapter onLog handler.
This call path is a bit confusing, but is really where the adapter library shines.

1. sqd run() process sees a log
2. engine.ingest() is called
3. ingest() calls the adapters onLog or onTransaction handler and passes in the engine internals as the context
4. if the onLog adapter code calls any emit functions, the engine will then call the appropriate internal engine method to update any state that it might need to

The event handlers typically take in a context that holds the txHash, blockheight, ts.

We can abstract this so that regardless of whether we're calling onLog, onTransaction, or if we have an EVM context or a solana context, we can still get this to work.

For now, we are passing in the entire block, but this could prove problematic if we want to include solana later since we're passing in a huge unstructured object deep into the call stack, only to use some parameters. This makes separation of concerns quite difficult.

there's a few paths:

1. construct the normalized ctx based on whether it's a log, a transaction, or solana
   1. this feels like the perfect use case for factory pattern (or factory function)
      ex. if 'evmlog' do this. if 'evmtx' do this. if 'solanalog' do this.
      [ ] need to create a normalized ctx type
2. pass in ctx to each of the emit functions that require it
3. FOR NOW, keep block in there but make a note to remove it with //xxx:

## The priceable problem

The problem is that the final data shape expects an asset to be priced.
What if we want to just say that something "happened"?

Now, we can price certain things ANYWAY and then claim existence of that row => something happened.

But this implies there is an asset to even price and complicates the configuration (now you have to worry about these details even though you don't care about them).

Instead, you can opt in whether an action is priceable or not.

If it is priceable, you are required to supply an asset and amount.
If it is not priceable, you are not required to supply an asset and amount.

Priceable actions that do not match to a price will be filtered out during the enrichment step.
Non-priceable actions will be included in the data shape, since there is no price to match on.

Sometimes, a non-priceable action ALSO has an asset and amount, we just choose not to price it.

For example, a user verification on a contract call is an action, but not one that represents an asset at all, and therefor doesn't have an amount. An asset and amount are linked properties together.

So we need to have a data shape that can represent:

1. A priced action in usd (which has an asset and amount)
2. A non-priceable action (which has an asset and amount)
3. A non-priceable action that does not have an asset and amount, and so there is by definition, nothing to price

Current data shape: we would want to have valueUsd be null and instead just have a rawAmount.
However, downstream, the models need to know what to look on. It's better to be explicit and have one value field that always gets used for calculation
so that the models could sum or aggregate on it, even if things are not priced.

```ts
// Full TransactionEvent when flattened:
interface TransactionEvent {
  // From BaseEventFields
  version: string;
  eventId: string;
  userId: string;
  chain: Chain;
  contractAddress: string;
  protocolName: string;
  protocolType: string;
  runner: Runner;
  protocolMetadata: { [key: string]: { value: string; type: string } };
  currency: Currency;
  valueUsd: number;

  // TransactionEvent specific fields
  eventType: MessageType;
  rawAmount: string;
  displayAmount: number;
  unixTimestampMs: number;
  txHash: string;
  logIndex: number;
  gasUsed: number;
  gasFeeUsd: number;
  blockNumber: number;
  blockHash: string;
}
```

Instead, we can have:

```ts
type ValueKind = 'usd' | 'raw';
type Metric = {
  kind: ValueKind;
  value: string; // bc bigint
};
```

So we need to have a data shape that can represent:

1. A priced action in usd (which has an asset and amount)
   {
   const metric: Metric = {
   kind: 'usd',
   value: '100'
   }
   }
2. A non-priceable action (which has an asset and amount)
3. A non-priceable action that does not have an asset and amount, and so there is by definition, nothing to price
