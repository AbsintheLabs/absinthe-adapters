# Uniswap V3 Adapter

A manifest-based adapter for tracking Uniswap V3 swaps and liquidity positions (LP NFTs).

## Features

### Trackables

#### `swap` - Swap Volume Tracking

Tracks swap events on Uniswap V3 pools.

**Parameters:**

- `factoryAddress` (required): The Uniswap V3 Factory contract address
- `nonFungiblePositionManagerAddress` (required): The Uniswap V3 NonFungiblePositionManager contract address

**Asset Selectors:**

- `swapLegAddress` (required when pricing): The token0 or token1 address to price. Since each swap involves two tokens, you must specify which leg to track.

**Example Config:**

```json
{
  "swap": [
    {
      "params": {
        "factoryAddress": "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        "nonFungiblePositionManagerAddress": "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"
      },
      "assetSelectors": {
        "swapLegAddress": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
      },
      "pricing": {
        "priceFeed": {
          "kind": "coingecko",
          "id": "weth"
        }
      }
    }
  ]
}
```

#### `lp` - Liquidity Position Tracking

Tracks Uniswap V3 LP positions (NFTs) including transfers and liquidity changes.

**Parameters:**

- `factoryAddress` (required): The Uniswap V3 Factory contract address
- `nonFungiblePositionManagerAddress` (required): The Uniswap V3 NonFungiblePositionManager contract address

**Required Pricer:** `univ3lp`

**Example Config:**

```json
{
  "lp": [
    {
      "params": {
        "factoryAddress": "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        "nonFungiblePositionManagerAddress": "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"
      },
      "pricing": {
        "assetType": "erc721",
        "priceFeed": {
          "kind": "univ3lp",
          "token0": {
            "priceFeed": {
              "kind": "coingecko",
              "id": "weth"
            }
          },
          "token1": {
            "priceFeed": {
              "kind": "pegged",
              "usdPegValue": 1
            }
          }
        }
      }
    }
  ]
}
```

## Architecture

### Trackable Mental Model

Following the Absinthe adapter guide:

**Swaps:**

- A swap event involves TWO tokens (token0 and token1)
- The user must pick ONE to price via `swapLegAddress` selector
- Without `swapLegAddress`, both sides are emitted (unpriced mode)
- With `swapLegAddress`, only the selected token's volume is measured

**LP Positions:**

- The NFT tokenId uniquely identifies the position
- Asset key format: `erc721:{nfpmAddress}:{tokenId}`
- No assetSelectors needed - the NFT itself is the asset
- The `univ3lp` pricer internally handles token0/token1 pricing
- ONE pricing strategy applies to MANY NFT assets (one per position)

### Events Handled

1. **PoolCreated**: Indexes pools created by the factory
2. **Swap**: Emits swap volume actions
3. **Transfer**: Tracks NFT position ownership changes (balance deltas)
4. **IncreaseLiquidity**: Triggers position repricing when liquidity is added
5. **DecreaseLiquidity**: Triggers position repricing when liquidity is removed

### Key Patterns

- **Config-based Tracking**: Following the canonical pattern from UniswapV2, whether to track swaps or LP positions is determined by what's in the runtime config. Simply include or exclude trackable instances to control what gets indexed.
- **Pool Indexing**: Only tracks pools created by the configured factory
- **NFT Position Labels**: Automatically fetches and caches position metadata (token0, token1, fee, ticks, pool)
- **Position Updates**: IncreaseLiquidity and DecreaseLiquidity trigger repricing without changing NFT balance
- **Reverse Indexing**: Maintains `pool:{address}:positions` sets for efficient pool-level queries

## Simplified Architecture

This implementation follows the simplified manifest-based pattern from the adapter guide. It does NOT include:

- Tick tracking and position active/inactive status changes
- MeasureDelta for separate liquidity metric tracking
- Complex tick crossing logic

These features can be added as enhancements later. The current implementation focuses on:

- Clean swap volume tracking with asset selectors
- NFT position balance tracking
- Position repricing on liquidity changes

## References

- [Uniswap V3 Documentation](https://docs.uniswap.org/protocol/concepts/V3-overview/concentrated-liquidity)
- [Absinthe Adapter Guide](.cursor/rules/adapters.mdc)
- [UniswapV2 Reference Adapter](../uniswap-v2/)
