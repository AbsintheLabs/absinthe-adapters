# Example Usage in Consuming Repositories

## Setup in `absinthe-web` (or other repos)

### 1. Add Dependency

In `package.json`:

```json
{
  "dependencies": {
    "@absinthe/adapters": "github:your-org/absinthe-adapters#main"
  }
}
```

Or specify a branch/commit:

```json
{
  "dependencies": {
    "@absinthe/adapters": "github:your-org/absinthe-adapters#andrew/eng-2835"
  }
}
```

### 2. Install

```bash
pnpm install
```

This will:

- Clone the repository
- Run the `prepare` script automatically
- Build TypeScript sources
- Make schemas available for import

---

## Usage Examples

### Basic Validation

```typescript
import { ActionSchema, PositionSchema } from '@absinthe/adapters/schemas';

// Validate incoming action event
try {
  const action = ActionSchema.parse(rawActionData);
  console.log('Valid action:', action);
} catch (error) {
  console.error('Invalid action:', error);
}

// Validate position event
const position = PositionSchema.safeParse(rawPositionData);
if (position.success) {
  console.log('Valid position:', position.data);
} else {
  console.error('Invalid position:', position.error);
}
```

### Type-Safe Data Structures

```typescript
import type { Action, Position } from '@absinthe/adapters/schemas';

// Use types for function parameters
function processAction(action: Action): void {
  console.log(`Processing action for user ${action.user}`);
  console.log(`Activity: ${action.activity}`);
  console.log(`Quantity: ${action.quantity}`);
}

function processPosition(position: Position): void {
  console.log(`Position for user ${position.user}`);
  console.log(`Duration: ${position.window_duration_ms}ms`);
  console.log(`Delta: ${position.raw_delta}`);
}
```

### API Response Validation

```typescript
import { ActionSchema } from '@absinthe/adapters/schemas';
import { z } from 'zod';

// Create API response schema with array of actions
const ActionListResponseSchema = z.object({
  actions: z.array(ActionSchema),
  total: z.number(),
  page: z.number(),
});

async function fetchActions(page: number) {
  const response = await fetch(`/api/actions?page=${page}`);
  const data = await response.json();

  // Validate entire response
  const validated = ActionListResponseSchema.parse(data);
  return validated.actions;
}
```

### Database Schema Definition

```typescript
import type { Action, Position } from '@absinthe/adapters/schemas';
import { ActionSchema, PositionSchema } from '@absinthe/adapters/schemas';

// Use in Prisma/Drizzle/TypeORM schemas
interface ActionRecord extends Action {
  id: string;
  created_at: Date;
  updated_at: Date;
}

// Validate before inserting into database
async function insertAction(rawData: unknown) {
  const validated = ActionSchema.parse(rawData);

  return db.actions.create({
    data: {
      ...validated,
      created_at: new Date(),
      updated_at: new Date(),
    },
  });
}
```

### Kafka/Message Queue Validation

```typescript
import { ActionSchema, PositionSchema } from '@absinthe/adapters/schemas';

// Validate messages from Kafka
async function consumeActionMessages() {
  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const action = ActionSchema.parse(JSON.parse(message.value.toString()));

        // Process valid action
        await processAction(action);
      } catch (error) {
        console.error('Invalid action message:', error);
        // Send to DLQ or log
      }
    },
  });
}
```

### Frontend Forms & Validation

```typescript
import { ActionSchema } from '@absinthe/adapters/schemas';
import { z } from 'zod';

// Create partial schema for form validation
const ActionFormSchema = ActionSchema.pick({
  user: true,
  activity: true,
  quantity: true,
}).partial();

type ActionFormData = z.infer<typeof ActionFormSchema>;

function ActionForm() {
  const handleSubmit = (formData: ActionFormData) => {
    // Validate partial data
    const validated = ActionFormSchema.parse(formData);

    // Send to API
    fetch('/api/actions', {
      method: 'POST',
      body: JSON.stringify(validated),
    });
  };

  // ... rest of form component
}
```

### Supporting Schemas

```typescript
import {
  MeasurementTypeSchema,
  DenominationSchema,
  ChainArchSchema,
  type MeasurementType,
  type Denomination,
  type ChainArch,
} from '@absinthe/adapters/schemas';

// Use in configuration
const ConfigSchema = z.object({
  chainArch: ChainArchSchema,
  measurementType: MeasurementTypeSchema,
  denomination: DenominationSchema,
});

const config = ConfigSchema.parse({
  chainArch: 'evm',
  measurementType: 'token_based',
  denomination: 'usd',
});
```

---

## Updating Schemas

When schemas are updated in `absinthe-adapters`:

```bash
# In consuming repo (e.g., absinthe-wep)
pnpm update @absinthe/adapters

# Or to get latest from specific branch
pnpm remove @absinthe/adapters
pnpm add github:your-org/absinthe-adapters#main
```

---

## Testing

```typescript
import { ActionSchema, PositionSchema } from '@absinthe/adapters/schemas';

describe('Event Validation', () => {
  it('should validate valid action', () => {
    const validAction = {
      user: '0x123...',
      ts_ms: Date.now(),
      height: 12345,
      tx_ref: '0xabc...',
      // ... all required fields
    };

    expect(() => ActionSchema.parse(validAction)).not.toThrow();
  });

  it('should reject invalid action', () => {
    const invalidAction = {
      user: '0x123...',
      // missing required fields
    };

    expect(() => ActionSchema.parse(invalidAction)).toThrow();
  });
});
```
