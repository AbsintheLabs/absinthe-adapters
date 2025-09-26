TEST CASE 2: univ2 swaps (unpriced) + univ2 lp (unpriced) for a given pool

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
      },
    },
    {
      itemId: "swap",
      inputs: {
        poolAddress: "0xaf6ed58980b5a0732423469dd9f3f69d9dc6dab5",
      },
      },
    },
    {
      itemId: "lp",
      inputs: {
        poolAddress: "0x0621bae969de9c153835680f158f481424c0720a",
      },
      }
    }
  ]
}
```
