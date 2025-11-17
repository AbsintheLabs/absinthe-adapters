# @absinthelabs/adapters

Shared **types and Zod schemas** used across the Absinthe indexing pipeline.  
This package defines the _canonical shape_ of enriched actions, enriched positions, and adapter configuration — ensuring all Absinthe services interpret protocol data consistently.

It is currently a **types-only** package that exports:

- Enriched Action schema & type
- Enriched Position schema & type
- RegisterConfig schema & type
- Chain/Asset/Denomination/Measurement enums
- POSITION_REASONS constant
- CommonFields + AssetFields shared structures

This package forms the **foundation** of the new adapter architecture (manifest-driven, priced, multi-protocol).

---

## 📦 Installation

```bash
npm install @absinthelabs/adapters
# or
pnpm add @absinthelabs/adapters
```

## 🛠 Usage Examples

### Validate an Incoming Action

import { ActionSchema } from '@absinthelabs/adapters';

const action = ActionSchema.parse(rawData);**What this does:**

- ✅ Validates all required fields are present (`user`, `ts_ms`, `height`, `tx_ref`, etc.)
- ✅ Ensures field types match the schema
- ✅ Automatically strips extra fields not in the schema
- ❌ Throws `ZodError` if validation fails (use `.safeParse()` for non-throwing validation)

---

### Validate a Position

script
import { PositionSchema } from '@absinthelabs/adapters';

const pos = PositionSchema.parse(rawPos);**What this does:**

- ✅ Validates position window fields (`window_utc_start_ts_ms`, `window_utc_end_ts_ms`, etc.)
- ✅ Validates asset fields (`asset_key`, `decimals`, `asset_type`) - required for positions
- ✅ Validates common fields (chain metadata, measurement type, etc.)
- ❌ Throws if any required field is missing

---

### Use TypeScript Types

import type { EnrichedAction, EnrichedPosition } from '@absinthelabs/adapters';

function consume(p: EnrichedPosition) {
console.log(p.user, p.raw_after);
// TypeScript knows all available fields and their types
}**Benefits:**

- 🎯 Full type safety and autocomplete
- 🔍 Type inference from Zod schemas (single source of truth)
- ⚡ No runtime overhead (types are stripped at compile time)

---

## 📚 Exports

### ✔ Zod Schemas

| Schema                       | Purpose                                                         | Use Case                           |
| ---------------------------- | --------------------------------------------------------------- | ---------------------------------- |
| **`EnrichedActionSchema`**   | Validates enriched action events                                | API ingestion, database validation |
| **`EnrichedPositionSchema`** | Validates enriched position windows                             | Position tracking, analytics       |
| **`RegisterConfigSchema`**   | Validates adapter registration config                           | Adapter setup                      |
| **`ChainArchSchema`**        | Validates chain architecture (`evm` \| `solana`)                | Chain-specific logic               |
| **`MeasurementTypeSchema`**  | Validates measurement type (`token_based` \| `count` \| `none`) | Trackable configuration            |
| **`DenominationSchema`**     | Validates denomination (`usd` \| `scaled_token` \| `none`)      | Pricing configuration              |
| **`AssetEnum`**              | Validates asset type (`erc20` \| `erc721` \| `spl` \| `custom`) | Asset identification               |

### ✔ TypeScript Types

| Type                   | Inferred From            | Description                        |
| ---------------------- | ------------------------ | ---------------------------------- |
| **`EnrichedAction`**   | `EnrichedActionSchema`   | Type-safe action event shape       |
| **`EnrichedPosition`** | `EnrichedPositionSchema` | Type-safe position window shape    |
| **`RegisterConfig`**   | `RegisterConfigSchema`   | Adapter registration configuration |

---

## ⚠️ Common Validation Errors

### Missing Required Fields

```cript
// ❌ This will throw
ActionSchema.parse({ user: '0x123' });
// Error: Required field 'ts_ms' is missingcript
// ✅ Use safeParse for graceful handling
const result = ActionSchema.safeParse({ user: '0x123' });
if (!result.success) {
console.error(result.error.errors);
}---
```

### Type Mismatches

```
// ❌ This will throw
ActionSchema.parse({
user: '0x123',
ts_ms: 'not-a-number' // Should be number
});
// Error: Expected number, received string---
```
