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

## Next Steps

1. Create Action Type and Swap Action Subtype
2. Emit the action event from the swap
   1. Add conditionals to not track the LP so that testing is MUCH faster while we're doing this part
3. Make sure that we can set immutable labels or attributes on the action so we can match the config on them properly
4. Wire this up so that the proper part of the config gets called for the swap (related to 3)
5. Add new price resolver for actions (start with swap)
6. Test it
7. Start refactoring to fit ports+adapters model so that engine is decoupled properly. Then, we can start running some tests on its component parts.
8. Need to tell lending / borrowing apart for the same adapter (EVEN THOUGH they are both TWB metrics. don’t assume each adapter will have at most 1 of twb or event based tracking)
   1. What would tracking multiple TWB's for one adapter look like? What about multiple Actions for one adapter? It should generalize to many.
9. (edge case) Make sure that index ordering is done correctly (if multiple txs in the same block and the ts will be the same) - order not just on ts but ALSO log index if timestamp is the same (precedence of comparison obv)
