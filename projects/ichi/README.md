How to turn json into the config string easily:

```bash
echo "\nINDEXER_CONFIG='$(jq -c . src/config/ichiconfig.json)'" >> .env
```

## Architecture Overview

The system follows a **blockchain indexer → pricing engine → enrichment pipeline → sink** architecture, with Redis serving as the persistent state store and cache layer.

### 1. **Entry Point (main.ts)**

- **Purpose**: Bootstraps the engine with configuration and adapters
- **Flow**:
  - Loads config from command line args
  - Creates adapter (e.g., `createUniv3Adapter`) with sample configuration
  - Creates `CsvSink` for output to CSV file
  - Instantiates `Engine` with adapter, sink, and config
  - Calls `engine.run()` to start processing

### 2. **Engine (engine.ts) - Core Processing Loop**

- **Purpose**: Orchestrates the entire indexing process
- **Redis Keys Used**:
  - **`abs:{indexerId}:flush:boundary`** - Tracks last flush boundary for crash recovery
  - **`assets:tracked`** - Hash map of `{asset: birthHeight}` tracking all assets seen
  - **`activebalances`** - Set of actively tracked balance keys (toggled by position status changes)
  - **`balances:gt0`** - Set of balance keys with non-zero amounts (used for scans/flush)
  - **`bal:{asset}:{user}`** - Hash with fields: `amount`, `updatedTs`, `updatedHeight`, `txHash`
  - **`meas:{asset}:{metric}`** - Hash for measure tracking with same fields as balance
  - **`meas:{asset}:{metric}:d`** - Sorted set for storing measure deltas by block height
  - **`meas:active`** - Set of active measure keys
  - **`meas:tracked`** - Hash tracking `{asset:metric: birthHeight}`

**Processing Flow**:

1. **Block Processing**: For each block, processes logs and transactions
2. **Balance Tracking**: Updates balance state in Redis for each `BalanceDelta` event
3. **Measure Tracking**: Updates measure state for `MeasureDelta` events
4. **Window Creation**: Creates time-weighted balance windows when balances change
5. **Periodic Flushing**: Periodically flushes completed windows to enrichment pipeline
6. **Price Backfilling**: Pre-computes prices for all tracked assets in batch
7. **Enrichment**: Runs enrichment pipeline on windows and events
8. **Sink Output**: Sends enriched data to sink

### 3. **Pricing Engine (pricing-engine.ts)**

- **Purpose**: Resolves asset prices using configurable feeds with recursion support
- **Redis Keys Used**:
  - **`price:{asset}`** - TimeSeries key storing price data points (timestamp → price)
  - **`metadata:{asset}`** - JSON object storing asset metadata (decimals, etc.)
  - **`handlerMeta:{handlerName}:{key}`** - Handler-specific cached metadata

**Key Components**:

- **HandlerRegistry**: Manages pricing handlers (coingecko, univ2nav, univ3lp, etc.)
- **Recursive Resolution**: Handlers can call `recurse()` to price dependencies
- **Caching Strategy**: Checks cache first, falls back to live pricing, caches results

**Price Resolution Flow**:

1. **Cache Check**: `price:{asset}` TimeSeries lookup
2. **Metadata Resolution**: Get asset decimals from `metadata:{asset}`
3. **Handler Execution**: Call appropriate pricing handler
4. **Dependency Pricing**: Recursively price underlying assets if needed
5. **Cache Storage**: Store result in `price:{asset}` TimeSeries

### 4. **Asset Handlers (engine/asset-handlers.ts)**

- **Purpose**: Resolve asset metadata (decimals, normalization)
- **Supported Types**: ERC20, ERC721
- **Redis Keys**: Uses `metadata:{asset}` for caching

### 5. **Enrichment Pipeline (enrichers.ts)**

- **Purpose**: Transform raw data into final output format
- **Key Enrichers**:
  - `enrichBaseEventMetadata` - Adds protocol metadata
  - `enrichWithCommonBaseEventFields` - Adds base fields (version, userId, etc.)
  - `buildEvents` / `buildTimeWeightedBalanceEvents` - Converts to Absinthe format
  - `enrichWithPrice` - **Critical**: Adds USD valuation using Redis TimeSeries

**Pricing in Enrichment**:

```typescript
// Uses Redis TimeSeries aggregation for time-weighted average pricing
const resp = await context.redis.ts.range(key, start, end, {
  LATEST: true,
  AGGREGATION: { type: 'TWA', timeBucket: 4 * 60 * 60 * 1000 }, // 4-hour buckets
  ALIGN: '0',
  COUNT: 1,
});
```

### 6. **Sink (esink.ts)**

- **Purpose**: Final output destination
- **Current Implementation**: `CsvSink` writes to CSV file
- **Future**: Absinthe API sink planned

## Key Redis Key Patterns

1. **Balance Tracking**: `bal:{asset}:{user}` → `{amount, updatedTs, updatedHeight, txHash}`
2. **Measure Tracking**: `meas:{asset}:{metric}` → `{amount, updatedTs, updatedHeight}`
3. **Price Storage**: `price:{asset}` → TimeSeries of `(timestamp, price)`
4. **Metadata Cache**: `metadata:{asset}` → `{decimals: number}`
5. **Handler Cache**: `handlerMeta:{handler}:{key}` → Handler-specific data
6. **Asset Registry**: `assets:tracked` → `{asset: birthHeight}`
7. **Active Balances**: `activebalances` → Set of actively tracked balance keys (toggled by position status changes)
8. **Balance Keys**: `balances:gt0` → Set of balance keys with non-zero amounts (used for scans/flush)
9. **Flush State**: `abs:{indexerId}:flush:boundary` → Last processed boundary

## Data Flow Summary

1. **Raw Events** (logs/transactions) → **Engine Processing** → Balance updates in Redis
2. **Periodic Flush** → Creates time windows → **Enrichment Pipeline**
3. **Enrichment** → Fetches prices from Redis TimeSeries → Calculates USD values
4. **Sink** → Outputs enriched data to CSV/Absinthe API

The system is designed for **crash recovery** (flush boundaries), **horizontal scaling** (namespaced keys), and **efficient pricing** (Redis TimeSeries for historical lookups).
