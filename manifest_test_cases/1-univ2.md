TEST CASE 1: univ2 swaps (priced) + univ2 lp (priced) for a given pool - ok ✔️

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
      inputs: [
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
    },
    {
      id: "lp",
      kind: "position",
      quantityType: "token_based",
      inputs: [
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
    }
  ]
}
```

```ts
// config
{
  adapter: "uniswap-v2",
  version: "0.0.1",
  trackableInstances: [
    {
      itemId: "swap",
      inputs: {
        poolAddress: "0x0621bae969de9c153835680f158f481424c0720a",
        token0OrToken1Address: "0xAA40c0c7644e0b2B224509571e10ad20d9C4ef28"
      },
      pricing: {
        assetType: "erc20",
        priceFeed: {
          kind: "pegged",
          usdPegValue: 2
        }
      }
    },
    {
      itemId: "swap",
      inputs: {
        poolAddress: "0xaf6ed58980b5a0732423469dd9f3f69d9dc6dab5",
        token0OrToken1Address: "0xAA40c0c7644e0b2B224509571e10ad20d9C4ef28"
      },
      pricing: {
        assetType: "erc20",
        priceFeed: {
          kind: "pegged",
          usdPegValue: 1
        }
      }
    },
    {
      itemId: "lp",
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
