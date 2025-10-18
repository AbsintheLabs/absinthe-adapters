# Protocol Metadata Guide

## Overview

The `meta` field in both `RawAction` and `RawWindow` allows adapters to pass protocol-specific metadata that flows through to the final output in an Avro-compatible format.

## Type System

### MetadataValue Type

```typescript
type MetadataValue =
  | number
  | string
  | {
      value: string;
      type: 'string' | 'bigint' | 'number' | 'evm_address' | 'sol_address' | 'boolean';
    };
```

### Auto-typing (Simple Values)

When you provide a simple `string` or `number`, the system automatically infers the type:

```typescript
meta: {
  poolName: "WETH-USDC",    // → { value: "WETH-USDC", type: "string" }
  blockNumber: 12345,        // → { value: "12345", type: "number" }
  txHash: "0xabc..."         // → { value: "0xabc...", type: "string" }
}
```

### Explicit Typing (Typed Values)

For values that need precise type information (bigints, addresses, booleans), use explicit typing:

```typescript
meta: {
  liquidity: {
    value: "999999999999999999",
    type: "bigint"
  },
  poolAddress: {
    value: "0x1234567890abcdef",
    type: "evm_address"  // maps to "address" in output
  },
  solanaAddress: {
    value: "So1ana1111111111111111111111111111111111111",
    type: "sol_address"  // maps to "address" in output
  },
  isActive: {
    value: "true",
    type: "boolean"
  }
}
```

## Output Format

All metadata is transformed into Avro-compatible format and stored in the `metadata_json` field:

```json
{
  "blockNumber": {
    "value": "12345",
    "type": "number"
  },
  "liquidity": {
    "value": "999999999999999999",
    "type": "bigint"
  },
  "poolAddress": {
    "value": "0x1234567890abcdef",
    "type": "address"
  }
}
```

**Note:** `evm_address` and `sol_address` both map to the generic `address` type in the output.

## Usage Examples

### Example 1: UniV2 Swap Metadata

```typescript
await emitFns.action.swap({
  key: md5Hash(`${log.txRef}${log.logIndex}`),
  user: swapper,
  asset: fromToken,
  amount: fromAmount,
  activity: 'swap',
  trackableInstance: instance,
  meta: {
    fromTkAddress: fromToken, // auto: string
    toTkAddress: toToken, // auto: string
    fromTkAmount: fromAmount.toString(), // auto: string
    toTkAmount: toAmount.toString(), // auto: string
  },
});
```

**Output:**

```json
{
  "fromTkAddress": { "value": "0xWETH", "type": "string" },
  "toTkAddress": { "value": "0xUSDC", "type": "string" },
  "fromTkAmount": { "value": "1000000000000000000", "type": "string" },
  "toTkAmount": { "value": "3000000000", "type": "string" }
}
```

### Example 2: UniV3 LP Position Metadata (Mixed Typing)

```typescript
await emitFns.position.balanceDelta({
  user: owner,
  asset: `erc721:${positionManager}:${tokenId}`,
  amount: liquidityDelta,
  activity: 'lp',
  trackableInstance: instance,
  meta: {
    poolAddress: {
      value: poolAddress,
      type: 'evm_address',
    },
    liquidity: {
      value: liquidity.toString(),
      type: 'bigint',
    },
    token0: {
      value: token0Address,
      type: 'evm_address',
    },
    token1: {
      value: token1Address,
      type: 'evm_address',
    },
    tickLower: -887220, // auto: number
    tickUpper: 887220, // auto: number
  },
});
```

**Output:**

```json
{
  "liquidity": { "value": "123456789012345678", "type": "bigint" },
  "poolAddress": { "value": "0xPool123", "type": "address" },
  "tickLower": { "value": "-887220", "type": "number" },
  "tickUpper": { "value": "887220", "type": "number" },
  "token0": { "value": "0xWETH", "type": "address" },
  "token1": { "value": "0xUSDC", "type": "address" }
}
```

### Example 3: Lending Protocol Metadata

```typescript
await emitFns.position.balanceDelta({
  user: supplier,
  asset: underlyingToken,
  amount: supplyAmount,
  activity: 'lend',
  trackableInstance: instance,
  meta: {
    aTokenAddress: {
      value: aTokenAddr,
      type: 'evm_address',
    },
    interestRateMode: 1, // auto: number (1=stable, 2=variable)
    accumulatedInterest: {
      value: interestEarned.toString(),
      type: 'bigint',
    },
    utilizationRate: {
      value: '0.75',
      type: 'number',
    },
  },
});
```

## Best Practices

### 1. **Use Auto-typing for Simple Values**

For display strings, identifiers, and small numbers, use simple values:

```typescript
meta: {
  poolName: "WETH-USDC",
  tier: "0.3%",
  eventType: "mint"
}
```

### 2. **Use Explicit Typing for:**

- **BigInts:** Large token amounts, liquidity values

  ```typescript
  liquidity: { value: "999999999999999999", type: "bigint" }
  ```

- **Addresses:** Contract addresses, token addresses

  ```typescript
  poolAddress: { value: "0xabc...", type: "evm_address" }
  ```

- **Booleans:** Flags, state indicators
  ```typescript
  isActive: { value: "true", type: "boolean" }
  ```

### 3. **Always String-Encode Values**

Even for explicitly typed values, the `value` field must be a string:

```typescript
// ✅ Correct
meta: {
  amount: { value: amount.toString(), type: "bigint" }
}

// ❌ Wrong
meta: {
  amount: { value: amount, type: "bigint" }  // TypeScript error: number not assignable to string
}
```

### 4. **Keys are Sorted Alphabetically**

The enricher automatically sorts keys for consistent output:

```typescript
meta: {
  zebra: "last",
  apple: "first",
  middle: "middle"
}
// Output keys: ["apple", "middle", "zebra"]
```

### 5. **Empty or Missing Meta**

If `meta` is absent or empty, no `metadata_json` field is added:

```typescript
// No meta field
await emitFns.action.action({ ... });
// Output: metadata_json field is undefined

// Empty meta
await emitFns.action.action({ ..., meta: {} });
// Output: metadata_json field is undefined
```

## Pipeline Flow

1. **Adapter emits event** with `meta` field
2. **Engine stores** `RawAction`/`RawWindow` with `meta`
3. **addProtocolMetadata enricher** transforms `meta` → `metadata_json`
4. **Final schema** includes `metadata_json: z.string().optional()`
5. **Output sink** writes to CSV/Parquet/Database

## Avro Schema Compatibility

The output format matches this Avro schema:

```json
{
  "name": "protocolMetadata",
  "type": {
    "type": "map",
    "values": {
      "type": "record",
      "name": "ProtocolMetadataValue",
      "fields": [
        {
          "name": "value",
          "type": "string",
          "doc": "String-encoded value (even for numbers, addresses, bigints)"
        },
        {
          "name": "type",
          "type": {
            "type": "enum",
            "name": "MetadataValueType",
            "symbols": ["bigint", "number", "address", "string", "boolean"]
          }
        }
      ]
    }
  },
  "default": {}
}
```

## Testing Your Metadata

To verify your metadata is correctly formatted:

1. Run your adapter against test data
2. Check the output CSV/JSON for the `metadata_json` column
3. Parse the JSON and verify:
   - All keys are sorted
   - All values have `value` (string) and `type` fields
   - Types match your expectations

Example verification:

```typescript
const output = await runAdapter(config);
const action = output.actions[0];
const meta = JSON.parse(action.metadata_json);

console.log(meta);
// {
//   "liquidity": { "value": "999...", "type": "bigint" },
//   "poolAddress": { "value": "0xabc...", "type": "address" }
// }
```

## Migration from Old Format

If you're migrating from a simple JSON.stringify approach:

**Before:**

```typescript
metadata_json: JSON.stringify(meta);
// Output: { "poolName": "WETH-USDC", "amount": 12345 }
```

**After:**

```typescript
// Just pass meta to emit function
meta: {
  poolName: "WETH-USDC",
  amount: 12345
}
// Output: {
//   "poolName": { "value": "WETH-USDC", "type": "string" },
//   "amount": { "value": "12345", "type": "number" }
// }
```

The enrichment pipeline handles the transformation automatically.
