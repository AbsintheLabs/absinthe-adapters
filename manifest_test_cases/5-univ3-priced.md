TEST CASE 5: univ3 - priced

## manifest

```ts
{
  name: "univ3",
  version: "0.0.1",
  trackableTypes: [
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
      description: "Track LP positions in all pools created by this factory. Filter by nft asset labels to select specific pools or specific positions."
    },
    {
      id: "swap",
      kind: "action",
      quantityType: "token_based",
      inputs: [
        {
          role: "factoryAddress",
          requiredWhen: "always",
          description: "Uniswap V3 factory contract address"
        },
        {
          role: "token0OrToken1Address",
          requiredWhen: "forPricing",
          description: "The token0 or token1 address used to price the swap. The system will automatically determine which one to use."
        }
      ],
    }
  ]
}
```

## config

```ts
{
  adapter: "univ3",
  version: "0.0.1",
  trackableInstances: [
    // LP Position tracking - specific position from old config
    {
      itemId: "lp",
      inputs: {
        factoryAddress: "0xCdBCd51a5E8728E0AF4895ce5771b7d17fF71959",
        nonFungiblePositionManagerAddress: "0xe43ca1dee3f0fc1e2df73a0745674545f11a59f5",
        token0Address: "0x4200000000000000000000000000000000000006",
        token1Address: "0xad11a8beb98bbf61dbb1aa0f6d6f2ecd87b35afa",
        tickLower: "-202673",
        tickUpper: "-202653"
      },
      pricing: {
        assetType: "erc721",
        priceFeed: {
          kind: "univ3lp",
          nonfungiblepositionmanager: "0xe43ca1dee3f0fc1e2df73a0745674545f11a59f5",
          tokenSelector: "token1",
          token: {
            assetType: "erc20",
            priceFeed: {
              kind: "pegged",
              usdPegValue: 1
            }
          }
        }
      }
    },
    // Swap tracking - ETH swaps
    {
      itemId: "swap",
      inputs: {
        factoryAddress: "0xCdBCd51a5E8728E0AF4895ce5771b7d17fF71959",
        token0OrToken1Address: "0x4200000000000000000000000000000000000006"
      },
      pricing: {
        assetType: "erc20",
        priceFeed: {
          kind: "pegged",
          usdPegValue: 4000
        }
      }
    },
    // Swap tracking - USDC/USDT swaps
    {
      itemId: "swap",
      inputs: {
        factoryAddress: "0xCdBCd51a5E8728E0AF4895ce5771b7d17fF71959",
        token0OrToken1Address: "0xad11a8beb98bbf61dbb1aa0f6d6f2ecd87b35afa"
      },
      pricing: {
        assetType: "erc20",
        priceFeed: {
          kind: "pegged",
          usdPegValue: 1
        }
      }
    },
    // Swap tracking - BTC swaps
    {
      itemId: "swap",
      inputs: {
        factoryAddress: "0xCdBCd51a5E8728E0AF4895ce5771b7d17fF71959",
        token0OrToken1Address: "0x03c7054bcb39f7b2e5b2c7acb37583e32d70cfa3"
      },
      pricing: {
        assetType: "erc20",
        priceFeed: {
          kind: "pegged",
          usdPegValue: 110000
        }
      }
    }
  ]
}
```
