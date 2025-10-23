# Absinthe Adapters - Schema Exports

This directory exports Zod schemas for validation and type safety across Absinthe repositories.

## Usage in Other Repositories

### Installation

Add this package as a git dependency in your `package.json`:

```json
{
  "dependencies": {
    "@absinthe/adapters": "github:your-org/absinthe-adapters#main"
  }
}
```

Then install:

```bash
pnpm install
```

The `prepare` script will automatically build the TypeScript sources on install.

### Import and Use

```typescript
import { ActionSchema, PositionSchema } from '@absinthe/adapters/schemas';

// Validate an action event
const validatedAction = ActionSchema.parse(rawActionData);

// Validate a position event
const validatedPosition = PositionSchema.parse(rawPositionData);

// Use types
import type { Action, Position } from '@absinthe/adapters/schemas';

const myAction: Action = {
  user: '0x...',
  ts_ms: Date.now(),
  // ... rest of fields
};
```

## Available Exports

### Main Schemas

- `ActionSchema` - Zod schema for enriched action events
- `PositionSchema` - Zod schema for enriched position events

### Types

- `Action` - TypeScript type for actions (inferred from schema)
- `Position` - TypeScript type for positions (inferred from schema)

### Component Schemas

- `CommonFieldsSchema` - Common fields shared by actions and positions
- `AssetFieldsSchema` - Required asset fields (for token-based trackables)
- `AssetFieldsSchemaOptional` - Optional asset fields (for actions)

### Supporting Schemas

- `MeasurementTypeSchema` - Schema for measurement types (`token_based`, `count`, `none`)
- `DenominationSchema` - Schema for denominations (`usd`, `scaled_token`, `none`)
- `TrackableKindSchema` - Schema for trackable kinds (`action`, `position`)
- `ChainArchSchema` - Schema for chain architectures (`evm`, `solana`)
- `AssetEnum` - Schema for asset types (`erc20`, `erc721`, `spl`, `custom`)

### Supporting Types

- `MeasurementType`
- `Denomination`
- `TrackableKind`
- `ChainArch`
- `Asset`
- `AssetType`

## Development

When making changes to schemas in this repo:

1. Update the source schemas in `src/types/events.ts` or related files
2. Re-export them in `src/schemas/index.ts` if needed
3. Build: `pnpm build`
4. The changes will be available to consuming repos after they update their dependency

## How It Works

1. **Source schemas** live in `src/types/events.ts` and related type files
2. **Export file** (`src/schemas/index.ts`) re-exports the schemas with clean names
3. **Build step** compiles TypeScript to `dist/src/schemas/`
4. **Package exports** in `package.json` maps `@absinthe/adapters/schemas` to the built files
5. **Git dependency** allows other repos to install directly from GitHub
6. **Prepare script** ensures automatic build on install
