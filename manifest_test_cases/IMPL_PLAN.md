[1 tool called]

# Implementation Plan: From Current to Ideal Adapter

## Current State
```typescript
// adapters/uniswap-v2/index.ts
export default registerAdapter({
  manifest: {
    trackables: [
      { itemId: 'swap', kind: 'action' },
      { itemId: 'lp', kind: 'position' }
    ]
  },
  handlers: {
    swap: handleSwap,    // ❌ Manual typing required
    lp: handleLpTransfer // ❌ Manual typing required
  },
  build: ({ params }) => ({
    onLog: async ({ block, log, emit, instances }) => {
      // ❌ Manual emit access, no type safety
      // ❌ Magic string filtering
      // ❌ Manual handler routing
    }
  })
});
```

## Phase 1: Type-Safe Handler Registration

### Final Feature
```typescript
// adapters/uniswap-v2/index.ts
const manifest = {
  trackables: [
    {
      itemId: 'swap',
      kind: 'action' as const,        // ✅ TypeScript locks this
      quantityType: 'token_based',
      // ...
    },
    {
      itemId: 'lp',
      kind: 'position' as const,      // ✅ TypeScript locks this
      quantityType: 'token_based',
      // ...
    }
  ]
} as const; // ✅ Framework infers exact types

export default registerTypedAdapter({
  manifest,
  handlers: {
    swap: handleSwap,     // ✅ TypeScript validates: ActionHandler
    lp: handleLpTransfer, // ✅ TypeScript validates: PositionHandler
  },
  schema: z.object({ poolAddress: ZodEvmAddress }),
  build: ({ params }) => ({
    // ... processor setup
  })
});
```

### Implementation Steps
1. **Update manifest types** - Add `as const` to TrackableKind and QuantityType
2. **Create TypedAdapter interface** - Extend AdapterV2 with manifest and handlers
3. **Add handler type validation** - TypeScript ensures handler types match trackable kinds
4. **Update registerAdapter** - Accept typed manifest and validate handler compatibility

## Phase 2: Direct Handler Invocation

### Final Feature
```typescript
// adapters/uniswap-v2/index.ts
export default registerTypedAdapter({
  manifest,
  handlers: {
    swap: handleSwap,     // ✅ TypeScript validates type
    lp: handleLpTransfer, // ✅ TypeScript validates type
  },
  build: ({ params }) => ({
    buildProcessor: (base) => base.addLog({...}),

    onLog: async ({ block, log, instances, handlers }) => {
      const pool = log.address.toLowerCase();
      const topic = log.topics[0];

      if (topic === transferTopic) {
        const lpInstances = instances.filter(i => i.itemId === 'lp');
        const decoded = univ2Abi.events.Transfer.decode(log);

        // ✅ Direct handler invocation with IDE autocomplete!
        await Promise.all(lpInstances.map(inst =>
          handlers.lp(inst, decoded)
        ));
      }

      if (topic === swapTopic) {
        const swapInstances = instances.filter(i => i.itemId === 'swap');
        const decoded = univ2Abi.events.Swap.decode(log);

        // ✅ Direct handler invocation!
        await Promise.all(swapInstances.map(inst =>
          handlers.swap(inst, decoded)
        ));
      }
    }
  })
});
```

### Implementation Steps
1. **Create WrappedHandlers type** - Object with handler methods that auto-wrap emit functions
2. **Add handlers to OnLogContext** - Extend context with wrapped handlers
3. **Implement handler wrapping** - Framework creates emit functions based on trackable kind
4. **Update adapter onLog signature** - Add handlers parameter

## Phase 3: Auto-Inference System

### Final Feature
```typescript
// adapters/uniswap-v2/index.ts
import { createAdapter } from '../_shared/index.ts';

const manifest = {  // ❌ No "as const" needed
  trackables: [
    {
      itemId: 'swap',
      kind: 'action',           // TypeScript automatically locks this
      quantityType: 'token_based',
      // ...
    },
    {
      itemId: 'lp',
      kind: 'position',         // TypeScript automatically locks this
      quantityType: 'token_based',
      // ...
    }
  ]
};

export default createAdapter({
  manifest,
  handlers: {
    // TypeScript automatically infers:
    // - swap must be ActionHandler (because manifest.trackables[0].kind === 'action')
    // - lp must be PositionHandler (because manifest.trackables[1].kind === 'position')
    swap: handleSwap,     // ✅ Auto-inferred as ActionHandler
    lp: handleLpTransfer, // ✅ Auto-inferred as PositionHandler
  },
  schema: z.object({ poolAddress: ZodEvmAddress }),
  build: ({ params }) => ({
    // ... same as Phase 2
  })
});
```

### Implementation Steps
1. **Create auto-inference types** - `InferHandlerType`, `InferredHandlerMap`, `AutoAdapterConfig`
2. **Implement createAdapter factory** - Uses const generics to lock manifest structure
3. **Add template literal type mapping** - Maps trackable IDs to handler types
4. **Update shared exports** - Export inference types and factory function

## Phase 4: Trackable-Aware Action Events

### Final Feature
```typescript
// handlers/swap.ts - No manual typing needed
export const handleSwap = async (ctx, trackable, emit, event) => {
  // Framework automatically sets priceable: true and requires asset
  await emit.action(trackable, {
    key: `swap-${event.transactionHash}`,
    user: event.to,
    activity: 'swap',
    amount: new Big(event.amountOut), // Used as base for amount calculation
    meta: { fromToken: event.tokenIn, toToken: event.tokenOut }
  }, {
    asset: event.tokenOut // ✅ Required for asset_based trackables
  });
};

// handlers/lp-transfer.ts - No manual typing needed
export const handleLpTransfer = async (ctx, trackable, emit, event) => {
  const pool = trackable.params.poolAddress.toLowerCase();
  const amount = new Big(event.value.toString());

  // ✅ These are the only emit functions available for position trackables
  await emit.balanceDelta({
    user: event.from,
    asset: pool,
    amount: amount.neg(),
    activity: 'hold'
  });

  await emit.balanceDelta({
    user: event.to,
    asset: pool,
    amount: amount,
    activity: 'hold'
  });
  // emit.action() // ❌ TypeScript error - method doesn't exist
};
```

### Implementation Steps
1. **Create trackable-aware types** - `TrackableAwareAction`, `AssetBasedAction`, `CountAction`, `NoneAction`
2. **Implement action factory** - `createAction` function that builds events based on trackable config
3. **Update emit function signatures** - Accept trackable and config parameters
4. **Add type-level field enforcement** - `asset?: never`, `quantity: number`, etc.

## Phase 5: Enhanced Manifest Validation

### Final Feature
```typescript
// adapters/uniswap-v2/index.ts
const manifest = {
  trackables: [
    {
      itemId: 'swap',
      kind: 'action',
      quantityType: 'token_based',
      params: [
        { role: 'poolAddress', description: 'Pool address', type: 'EvmAddress' }
      ],
      filters: [
        {
          role: 'swapLegAddress',
          requiredForPricing: true,  // ✅ Framework validates this
          description: 'Token address for pricing',
          type: 'EvmAddress'
        }
      ]
    },
    {
      itemId: 'lp',
      kind: 'position',
      quantityType: 'token_based',
      requiredPricer: 'univ2nav',  // ✅ Framework validates this exists
      params: [
        { role: 'poolAddress', description: 'Pool address', type: 'EvmAddress' }
      ],
      filters: []
    }
  ]
};
```

### Implementation Steps
1. **Add manifest validation** - Zod schema validates requiredPricer exists in pricing registry
2. **Implement filter validation** - Validate requiredForPricing filters when pricer is specified
3. **Add pricing registry** - Registry of available pricers that can be referenced
4. **Update adapter registration** - Validate manifest against schema

## Phase 6: Asset Registration Integration

### Final Feature
```typescript
// Framework automatically handles asset registration
export default createAdapter({
  manifest,
  handlers: {
    swap: async (ctx, trackable, emit, event) => {
      // Framework automatically registers assets when pricing config exists
      await emit.action(trackable, baseAction, { asset: event.tokenOut });
      // Asset automatically registered: { asset: event.tokenOut, pricer: 'univ2nav' }
    },
    lp: async (ctx, trackable, emit, event) => {
      // Framework automatically registers pool asset
      await emit.balanceDelta({
        user: event.from,
        asset: trackable.params.poolAddress, // Pool address becomes asset
        amount: amount.neg(),
        activity: 'hold'
      });
      // Asset automatically registered: { asset: poolAddress, pricer: 'univ2nav' }
    }
  },
  // ... rest
});
```

### Implementation Steps
1. **Add asset registration to emit functions** - `emit.registerAsset()` method
2. **Implement automatic asset discovery** - Framework detects when assets should be registered
3. **Add asset registry** - Store registered assets with their pricing configs
4. **Update enrichment pipeline** - Use registered assets for pricing decisions

## Implementation Priority

**Phase 1** → **Phase 2** → **Phase 3** → **Phase 4** → **Phase 5** → **Phase 6**

Each phase builds on the previous one, so start with Phase 1 (basic type safety) and work your way up to Phase 6 (full automation). This gives you working improvements at each step while building toward the complete vision.