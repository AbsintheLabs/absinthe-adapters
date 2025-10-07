# Adapter Template

This template provides a starting point for building new Absinthe adapters. It follows the same structure as the UniswapV2 adapter but with protocol-specific details removed.

## Quick Start

1. **Copy this template**

   ```bash
   cp -r adapters/_template adapters/your-protocol-name
   ```

2. Copy ABIs into the `abi` directory
3. Generate typed ABIs

```bash
npx squid-evm-typegen ./adapters/your-protocol-name/abi-types ./adapters/your-protocol-name/abi/*.json
```

4. **Update the manifest** (`index.ts`)
   - Change `name` to your protocol name
   - Define your `trackables` (actions and/or positions)
   - Specify required `params` and optional `assetSelectors`

5. **Add your ABIs** (`abi/`)
   - Export contract ABIs as TypeScript
   - Define event topics you need to listen to

6. **Create metadata** (`metadata.ts`)
   - Define chain-specific addresses and config
   - Include factory addresses, start blocks, etc.

7. **Implement handlers**
   - Use `action-handler.ts` for one-time events (swaps, claims, bridges)
   - Use `position-handler.ts` for ongoing balances (LP, staking)
   - Emit appropriate events using `emitFns`

8. **Wire it up** in `index.ts`
   - Collect addresses from config in `build()`
   - Define which logs to subscribe to in `buildProcessor()`
   - Route events to handlers in `onLog()`

## File Structure

```
your-protocol-name/
├── index.ts                 # Main adapter definition
├── metadata.ts              # Chain-specific metadata
├── action-handler.ts        # Handler for action events
├── position-handler.ts      # Handler for position events
├── abi/
│   └── protocol.ts          # Protocol ABIs
└── tests/
    └── config/
        └── protocol.absinthe.json
```

## Key Concepts

### Trackables

- **kind**: `'action'` (one-time events) or `'position'` (ongoing balances)
- **quantityType**: `'token_based'` (standard) or `'synthetic'` (custom)
- **params**: Required fields that uniquely identify what to track
- **assetSelectors**: Optional fields for multi-asset trackables

### Event Types

- `emitAction()`: One-time events (swaps, claims, etc.)
- `emitBalanceDelta()`: Changes in position balances
- `emitReprice()`: Trigger repricing for an asset
- `emitPositionStatusChange()`: Mark position active/inactive
- `emitMeasureDelta()`: Update custom metrics

### Common Patterns

**Redis Caching** (for expensive RPC calls):

```typescript
const cacheKey = `protocol:${address}:data`;
let cached = await redis.get(cacheKey);
if (!cached) {
  cached = await contract.fetchData();
  await redis.set(cacheKey, cached);
}
```

**Event Fanout** (handle multiple config instances):

```typescript
const instances = config.trackableName.filter((item) => item.params.address === eventAddress);
for (const instance of instances) {
  await handleEvent(log, emitFns, instance);
}
```

**Balance Transfers**:

```typescript
// Sender loses balance
emitBalanceDelta({ user: from, delta: `-${amount}`, ... });

// Receiver gains balance
emitBalanceDelta({ user: to, delta: amount.toString(), ... });
```

## Resources

- [Adapter Core Concepts](https://docs.absinthe.network/adapters/core-concepts)
- [UniswapV2 Tutorial](https://docs.absinthe.network/adapters/uniswap-v2-adapter-tutorial)
- Example: `adapters/uniswap-v2/` - Full working adapter

## Next Steps

After implementing your adapter:

1. Create a test config in `tests/config/`
2. Write unit tests
3. Test with real chain data
4. Document any custom pricers needed
5. Submit for review
