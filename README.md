## Getting Started

1. Create new directory in adapters (copy `_template`)
2. Generate typed abis

```bash
# ensure you're in the specific adapter directory
npx squid-evm-typegen ./abi abi/*.json
```

```ts
{
  name: 'aavev3',
  semver: '0.0.1',
  trackables: [
    { // positions are always of type 'token_based'
      itemId: 'borrow',
      kind: 'position',
      assets: [{
        role: "variableDebtToken",
        // priceable is encoded in the QtyKind
      }],
      doc: "Balances of variableDebtToken is used to track a user's borrow amount. Borrow amount grows over time."
    },
    {
      itemId: 'lend',
      kind: 'position',
      assets: [{
        role: "aToken",
        // priceable is encoded in the QtyKind
      }],
      doc: "We track aToken for lending."
    }
  ]
}

// uniswap v2
{
    name: 'uniswapv2',
    semver: '0.0.1',
    trackables: [
        {
            itemId: 'lp',
            kind: 'position',
            assets: [{
                role: "lpNftCollection",
                // priceable is encoded in the QtyKind
            }],
            doc: "We track lpToken for LPing."
        },
        {
            itemId: 'swap',
            kind: 'action',
            qtyKind: 'token_based', // amounts can be in raw amounts or valued amounts
            assets: [{
                role: "token0",
            }, {
                role: "token1",
            }],
            doc: "We track swap for swapping."
        }
    ]
}
```

Now how does this translate into the actual configuration provided?
The configuration should be informed by the trackables array so that the user knows what to do.

Another thing to consider: if a configuration for the trackable is not provided, then we shouldn't actually track it.
Right now, we do this via the params that the creator of the adapter provides.

However, that could be enabled

How configuration could look like.
[ ] Problem: we have params and trackables repeated twice.

```ts
{
    id: 'aave-v3',
    version: '0.0.1',
    params: {
        aTokenAddress: '0xBdb9300b7CDE636d9cD4AFF00f6F009fFBBc8EE6',
        variableDebtTokenAddress: '0x05e08702028de6AaD395DC6478b554a56920b9AD'
    },
    trackables: [
        {
            itemId: 'borrow',
            variableDebtToken: "0x05e08702028de6AaD395DC6478b554a56920b9AD"
            config: {
                assetType: 'erc20',
                priceFeed: {
                    kind: 'aavev3vardebt',
                    debtTokenAddress: '0x05e08702028de6AaD395DC6478b554a56920b9AD',
                    underlyingTokenAddress: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf',
                    poolAddress: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
                    underlyingTokenFeed: {
                        assetType: 'erc20',
                        priceFeed: {
                            kind: 'pegged',
                            usdPegValue: 110000
                        }
                    }
                }
            }
        },
        {
            itemId: 'lend',
            aToken: "0xBdb9300b7CDE636d9cD4AFF00f6F009fFBBc8EE6"
            config: {
                assetType: 'erc20',
                priceFeed: {
                    kind: 'pegged',
                    usdPegValue: 100000
                }
            }
        }
    ]
}
```

let's iterate a little bit:

```ts
// manifest
{
  name: "uniswap-v2",
  version: "0.0.1",
  trackableTypes: [
    {
      id: "swap",
      kind: "action",
      quantityType: "token_based",
      requiredInputs: [
        {
          role: "poolAddress",
          requiredWhen: "always",
          description: "The pool address used to see all occurences of the swap."
        },
        {
          role: "token0OrToken1Address",
          requiredWhen: "forPricing",
          description: "The token0 or token1 address used to price the swap. The system will automatically determine which one to use."
        },
      ],
      description: "blah blah blah"
    },
    {
      id: "lp",
      kind: "position",
      quantityType: "token_based",
      requiredInputs: [
        {
          role: "poolAddress",
          requiredWhen: "always"
        },
        {
          role: "token0Address",
          requiredWhen: "forPricing",
          description: "The token0 address used to price the lp."
        },
        {
          role: "token1Address",
          requiredWhen: "forPricing",
          description: "The token1 address used to price the lp."
        },
      ],
      requiredPricer: "univ2nav",
    description: "blah blah blah"
    }
  ]
}
```

```ts
//config
// User Configuration
// IMPORTANT MENTAL SHIFT: input filters
{
  adapter: "uniswap-v2",
  version: "0.0.1",
  trackableInstances: [
    {
      itemId: "swap",
      enabled: true,
      inputs: {
        poolAddress: "0x0621bae969de9c153835680f158f481424c0720a",
        token0OrToken1Address: "0xAA40c0c7644e0b2B224509571e10ad20d9C4ef28"
      },
      pricing: {
        // can we instead have assetType passed through in the manifest? we never should really
        // need to price a feed for a non-erc20 asset, this is a degenerate case
        assetType: "erc20",
        priceFeed: {
          kind: "pegged",
          usdPegValue: 115764.58
        }
      }
    },
    {
      itemId: "lp",
      enabled: true,
      inputs: {
        poolAddress: "0x0621bae969de9c153835680f158f481424c0720a",
        token0Address: "0xAA40c0c7644e0b2B224509571e10ad20d9C4ef28",
        token1Address: "0xad11a8BEb98bbf61dbb1aa0F6d6F2ECD87b35afA"
      },
      pricing: {
        assetType: "erc20",
        priceFeed: {
          kind: "univ2nav",
          token0: {
            assetType: "erc20",
            priceFeed: { kind: "pegged", usdPegValue: 115764.58 }
          },
          token1: {
            assetType: "erc20",
            priceFeed: { kind: "pegged", usdPegValue: 1 }
          }
        }
      }
    }
  ]
}
```

```ts
// example without pricing
{
  adapter: "uniswap-v2",
  version: "0.0.1",
  trackables: [
    {
      itemId: "swap",
      enabled: true,
      inputs: {
        poolAddress: "0x0621bae969de9c153835680f158f481424c0720a",
      },
    }
  ]
}
```

---

---

let's brainstorm a bit more what the factory contract is even doing.
with univ2, we will say:

- i know a factory address.
- from that, you can find all the pools created by that factory.
- from each pool, you can find the token0 and token1 addresses.
- that means you have enough information purely from the factory contract to track swaps and LPs.

However, if you want to price in usd, i will also need to tell you the price of token0 or token1 for each pool.

In the unpriced scenario, I give you: factory address, and that's it to track ALL swaps.

- q: what if i don't want to track all swaps, but only some of them (for the pools that I tell you about?)
  - in this case, you should probably not use the factory address, but instead run an indexer for each pool. In fact, you could provide multiple trackables in one config which would make life really easy.

in the priced scenario, I give you: factory address, and the price of token0 and token1 for each pool.
Or instead, you track everything, and as long as token0 or token1 is one of the tokens i provide, then you price it.

this could just look like providing multiple trackable instances with factoryAddress and token0OrToken1Address as inputs.

what about if i want to get scaled amounts of ANY pool from the factory contract as long as one of the assets is one of the assets i provide?
related to: - q: what if i don't want to track all swaps, but only some of them (for the pools that I tell you about?)

```ts
// manifest. factory contrat (don't know the pools ahead of time)
{
  name: "uniswap-v2-factory",
  version: "0.0.1",
  trackableTypes: [
    {
      id: "swap",
      kind: "action",
      quantityType: "token_based",
      requiredInputs: [
        {
          role: "factoryAddress",
          requiredWhen: "always",
          description: "Uniswap V2 factory contract address"
        },
        {
            role: "token0OrToken1Address",
            requiredWhen: "pricedOnly",
            description: "The token0 or token1 address used to price the swap. The system will automatically determine which one to use."
        }
      ],
      description: "Track swaps across all pools created by this factory"
    },
    {
      id: "lp",
      kind: "position",
      quantityType: "token_based",
      requiredInputs: [
        {
          role: "factoryAddress",
          requiredWhen: "always",
          description: "Uniswap V2 factory contract address"
        },
        {
          role: "pricingTokens",
          requiredWhen: "pricedOnly",
          multiple: true,
          description: "List of token addresses for LP pricing - LP tokens will be priced if they contain any of these tokens"
        }
      ],
      requiredPricer: "univ2nav",
      description: "Track LP positions across all pools created by this factory"
    }
  ]
}
```

```ts
// univ3
{
  id: "lp",
  kind: "position",
  quantityType: "token_based",
  inputs: [
    {
      role: "factoryAddress",
      requiredWhen: "always",
      description: "Uniswap V3 factory contract address"
    },
    {
      role: "nonFungiblePositionManagerAddress",
      requiredWhen: "always",
      description: "NFT position manager contract address"
    },
    {
      role: "token0Address",
      requiredWhen: "optional",
      description: "Filter LP positions by token0 address"
    },
    {
      role: "token1Address",
      requiredWhen: "optional",
      description: "Filter LP positions by token1 address"
    },
    {
      role: "fee",
      requiredWhen: "optional",
      description: "Filter LP positions by fee tier (e.g., 500, 3000, 10000)"
    },
    {
      role: "tickLower",
      requiredWhen: "optional",
      description: "Filter LP positions by lower tick bound"
    },
    {
      role: "tickUpper",
      requiredWhen: "optional",
      description: "Filter LP positions by upper tick bound"
    }
  ],
  requiredPricer: "univ3lp",
  description: "Track LP NFT positions with optional filtering by underlying properties"
}

```
