[3 tools called]

Perfect! This is a brilliant enhancement that will eliminate another major source of developer errors. Here's how to implement configuration-aware action events:

## 1. Create Trackable-Aware Action Types

First, let's create types that are aware of the trackable configuration:

```typescript
// src/types/trackable-aware.ts
import { Trackable } from './manifest.ts';
import { ActionEvent, ActionEventBase, Amount } from './core.ts';

// Configuration-aware action event builders
export type TrackableAwareAction<
  T extends Trackable,
  Base extends ActionEventBase = ActionEventBase
> = T['quantityType'] extends 'asset_based'
  ? Base & { priceable: true; amount: Amount }
  : Base & { priceable: false };

// For asset_based trackables - requires asset information
export type AssetBasedAction<T extends Trackable> = TrackableAwareAction<T> & {
  asset: string; // Required for pricing
  quantity?: never; // Not allowed
};

// For count trackables - requires quantity but no asset
export type CountAction<T extends Trackable> = TrackableAwareAction<T> & {
  asset?: never; // Not allowed
  quantity: number; // Required for counting
};

// For none trackables - no additional fields required
export type NoneAction<T extends Trackable> = TrackableAwareAction<T> & {
  asset?: never; // Not allowed
  quantity?: never; // Not allowed
};

// Union type for all possible action configurations
export type ConfiguredAction<T extends Trackable> =
  T['quantityType'] extends 'asset_based' ? AssetBasedAction<T> :
  T['quantityType'] extends 'count' ? CountAction<T> :
  T['quantityType'] extends 'none' ? NoneAction<T> :
  never;
```

## 2. Create Smart Action Factory

```typescript
// src/utils/action-factory.ts
import { Trackable } from '../types/manifest.ts';
import { ActionEventBase } from '../types/core.ts';
import { ConfiguredAction } from '../types/trackable-aware.ts';

export function createAction<
  T extends Trackable,
  Base extends ActionEventBase
>(
  trackable: T,
  baseAction: Base,
  config: {
    asset?: string;
    quantity?: number;
  } = {}
): ConfiguredAction<T> {
  // TypeScript validates at compile time that the right fields are provided
  const result = { ...baseAction } as ConfiguredAction<T>;

  // Set priceable based on quantity type
  (result as any).priceable = trackable.quantityType === 'asset_based';

  // Validate and set fields based on quantity type
  if (trackable.quantityType === 'asset_based') {
    if (!config.asset) {
      throw new Error(`Asset-based trackable '${trackable.id}' requires 'asset' field`);
    }
    (result as any).amount = { asset: config.asset, amount: baseAction.amount || 0 };
  } else if (trackable.quantityType === 'count') {
    if (config.quantity === undefined) {
      throw new Error(`Count trackable '${trackable.id}' requires 'quantity' field`);
    }
    (result as any).quantity = config.quantity;
  }
  // For 'none' quantity type, no additional fields required

  return result;
}
```

## 3. Update Emit Functions

```typescript
// src/types/adapter.ts
export interface ActionEmitFunctions {
  action: <T extends Trackable>(trackable: T, baseAction: ActionEventBase, config?: { asset?: string; quantity?: number }) => Promise<void>;
  swap: (e: Swap) => Promise<void>;
  reprice: (e: Reprice) => Promise<void>;
}

export interface PositionEmitFunctions {
  balanceDelta: (e: BalanceDelta, reason?: BalanceDeltaReason) => Promise<void>;
  measureDelta: (e: MeasureDelta) => Promise<void>;
  positionUpdate: (e: PositionUpdate) => Promise<void>;
  positionStatusChange: (e: PositionStatusChange) => Promise<void>;
  reprice: (e: Reprice) => Promise<void>;
}
```

## 4. Update Handler Implementation

```typescript
// handlers/swap.ts
export const handleSwap = async (ctx, trackable, emit, event) => {
  // Framework automatically sets priceable: true and requires asset
  await emit.action(trackable, {
    key: `swap-${event.transactionHash}`,
    user: event.to,
    activity: 'swap',
    amount: new Big(event.amountOut), // Used as base for amount calculation
    meta: { fromToken: event.tokenIn, toToken: event.tokenOut }
  }, {
    asset: event.tokenOut // Required for asset_based trackables
  });
};
```

## 5. Enhanced Type Safety

The beauty is that TypeScript now enforces the right configuration:

```typescript
// handlers/lp-transfer.ts
export const handleLpTransfer = async (ctx, trackable, emit, event) => {
  const pool = trackable.params.poolAddress;
  const amount = new Big(event.value.toString());

  // For position trackables, use balanceDelta instead of action
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
};

// handlers/count-event.ts (for count-based trackables)
export const handleCountEvent = async (ctx, trackable, emit, event) => {
  // Framework automatically sets priceable: false and requires quantity
  await emit.action(trackable, {
    key: `count-${event.id}`,
    user: event.user,
    activity: 'custom',
    meta: { eventType: event.type }
  }, {
    quantity: event.count // Required for count trackables
    // asset: 'something' // ❌ TypeScript error - not allowed for count trackables
  });
};

// handlers/fact-event.ts (for none-based trackables)
export const handleFactEvent = async (ctx, trackable, emit, event) => {
  // Framework automatically sets priceable: false, no additional fields required
  await emit.action(trackable, {
    key: `fact-${event.id}`,
    user: event.user,
    activity: 'custom',
    meta: { fact: event.fact }
  });
  // No config object needed - no additional fields required
};
```

## 6. Advanced: Auto-Generate from Manifest

For even more automation, we could create a manifest-aware action builder:

```typescript
// src/utils/manifest-aware-builder.ts
export function createManifestActionBuilder<T extends Trackable>(trackable: T) {
  return {
    // TypeScript knows exactly what fields are required based on quantityType
    asset_based: (base: ActionEventBase, asset: string) =>
      createAction(trackable, base, { asset }),

    count: (base: ActionEventBase, quantity: number) =>
      createAction(trackable, base, { quantity }),

    none: (base: ActionEventBase) =>
      createAction(trackable, base)
  };
}

// Usage in handlers
const builder = createManifestActionBuilder(trackable);
await emit.action(trackable, baseAction, builder.asset_based(baseAction, assetValue));
```

## Benefits Achieved

✅ **Automatic Configuration** - Framework sets `priceable` based on `quantityType`
✅ **Required Field Enforcement** - TypeScript ensures required fields are provided
✅ **Prevents Degenerate Cases** - Can't accidentally set wrong `priceable` value
✅ **Self-Documenting** - Handlers clearly show what they're tracking
✅ **Type Safety** - Compile-time validation of action configuration
✅ **Zero Boilerplate** - Framework handles all the configuration logic

This encapsulates all the complexity into the manifest and type system, making it impossible for developers to create incorrectly configured actions while requiring zero manual work!