# Extensible Pricing System Guide

The pricing system has been enhanced to allow integrators to create custom pricing feeds for their specific protocols. This guide explains how to implement and use custom pricing feeds.

## Overview

The core pricing system provides built-in feeds like:

- `coingecko`: Fetch prices from CoinGecko API
- `pegged`: Use a fixed USD value
- `ichinav`: Calculate prices based on ICHI vault NAV
- `univ2nav`: Calculate prices for Uniswap V2 style pools

However, integrators can now add their own custom pricing feeds without modifying the core library.

## Architecture Changes

### 1. Extensible FeedSelector Type

The `FeedSelector` type now supports custom feed kinds:

```typescript
// Core feeds provided by the library
export type CoreFeedSelector =
  | { kind: 'coingecko'; id: string }
  | { kind: 'pegged'; usdPegValue: number }
  | { kind: 'univ2nav'; token0: TokenSelector; token1: TokenSelector }
  | { kind: 'ichinav'; token0: TokenSelector; token1: TokenSelector };

// Extensible feed selector that allows custom implementations
export type FeedSelector = CoreFeedSelector | { kind: string; [key: string]: any };
```

### 2. Adapter Interface Enhancement

Adapters can now register custom feed handlers:

```typescript
export interface Adapter {
  // ... existing properties
  feedConfig: AssetFeedConfig;
  // Optional custom pricing feed handlers
  customFeeds?: CustomFeedHandlers;
}

export interface CustomFeedHandlers {
  [feedKind: string]: HandlerFactory<any>;
}
```

### 3. PricingEngine Integration

The `PricingEngine` automatically registers custom feeds from adapters during initialization.

## Creating Custom Pricing Feeds

### Step 1: Define Your Feed Selector Type

```typescript
type MyCustomFeedSelector = {
  kind: 'mycustomfeed';
  parameter1: string;
  parameter2: number;
  // Add any parameters your feed needs
};
```

### Step 2: Implement the Handler Factory

```typescript
const myCustomFeedFactory: HandlerFactory<'mycustomfeed'> =
  (recurse) =>
  async ({ assetConfig, ctx }) => {
    const feedConfig = assetConfig.priceFeed as MyCustomFeedSelector;

    try {
      // Your custom pricing logic here
      // You can:
      // - Make RPC calls using ctx.sqdRpcCtx._chain.client.call()
      // - Access block data from ctx.block
      // - Use recurse() to price dependent assets
      // - Cache results using ctx.priceCache

      const price = calculateMyCustomPrice(feedConfig, ctx);
      return price;
    } catch (error) {
      console.warn(`Failed to price asset ${ctx.asset}:`, error);
      return 0;
    }
  };
```

### Step 3: Register the Handler in Your Adapter

```typescript
const customFeeds: CustomFeedHandlers = {
  mycustomfeed: myCustomFeedFactory,
  // Add more custom feeds as needed
};

export function createMyAdapter(feedConfig: AssetFeedConfig): Adapter {
  return {
    // ... your adapter implementation
    feedConfig,
    customFeeds, // Register your custom feeds
  };
}
```

### Step 4: Use Your Custom Feed in Configuration

```typescript
const feedConfig: AssetFeedConfig = {
  '0x1234...': {
    // Your asset address
    assetType: 'erc20',
    priceFeed: {
      kind: 'mycustomfeed',
      parameter1: 'value1',
      parameter2: 42,
    },
  },
};
```

## Example: Uniswap V2 LP Token Pricing

The `univ2.ts` adapter demonstrates a complete implementation of a custom feed called `univ2lpnav` that prices Uniswap V2 LP tokens using the structured contract approach:

```typescript
type Univ2LpNavFeedSelector = {
  kind: 'univ2lpnav';
  token0: TokenSelector;
  token1: TokenSelector;
  poolAddress: string;
};

// Implementation using contract ABI:
const univ2LpNavFactory: HandlerFactory<'univ2lpnav'> =
  (recurse) =>
  async ({ assetConfig, ctx }) => {
    const feedConfig = assetConfig.priceFeed as Univ2LpNavFeedSelector;

    // Create contract instance using the subsquid framework
    const lpContract = new univ2Abi.Contract(ctx.sqdRpcCtx, feedConfig.poolAddress);

    // Get data using typed contract methods
    const [reservesData, totalSupply] = await Promise.all([
      lpContract.getReserves(),
      lpContract.totalSupply(),
    ]);

    // Price calculation logic...
  };

// Usage in feed configuration:
const feedConfig: AssetFeedConfig = {
  '0x1234...': {
    // LP token address (same as poolAddress)
    assetType: 'erc20',
    priceFeed: {
      kind: 'univ2lpnav',
      poolAddress: '0x1234...', // Uniswap V2 pair contract address
      token0: {
        assetType: 'erc20',
        priceFeed: { kind: 'coingecko', id: 'ethereum' },
      },
      token1: {
        assetType: 'erc20',
        priceFeed: { kind: 'coingecko', id: 'usd-coin' },
      },
    },
  },
};
```

## Best Practices

1. **Use Contract Framework**: Prefer using the subsquid contract framework (`new ContractAbi.Contract(ctx.sqdRpcCtx, address)`) over raw RPC calls for type safety and proper ABI encoding/decoding
2. **Error Handling**: Always wrap your pricing logic in try-catch blocks and return 0 on errors
3. **Recursion**: Use the `recurse` function to price dependent assets (like underlying tokens in an LP)
4. **Caching**: The system automatically handles caching, but you can access `ctx.priceCache` if needed
5. **RPC Efficiency**: Batch contract calls when possible using `Promise.all()` to improve performance
6. **Type Safety**: Define strong TypeScript types for your feed selectors and use contract ABI types
7. **Documentation**: Document your custom feeds with clear examples

## Benefits

- **No Core Changes**: Add custom pricing without modifying library code
- **Composability**: Custom feeds can use core feeds through recursion
- **Caching**: Automatic price caching and metadata handling
- **Type Safety**: Full TypeScript support for custom feed parameters
- **Performance**: Efficient handler registration and lookup

## Migration Path

If your custom feed proves useful for others, it can be moved from your adapter to the core library:

1. Move the handler factory to `src/feeds/mycustomfeed.ts`
2. Add the feed selector to `CoreFeedSelector`
3. Register it in `PricingEngine` constructor
4. Remove it from your adapter's `customFeeds`

This allows gradual evolution from adapter-specific feeds to core library features.
