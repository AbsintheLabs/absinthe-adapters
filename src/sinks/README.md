# Absinthe Sinks

Sinks are output destinations for enriched data from the Absinthe adapters. They implement a simple interface that allows batched writes and proper cleanup.

## Available Sinks

### 1. CSV Sink (`csv`)

Writes enriched data to CSV files, automatically creating separate files for windows and actions.

**Configuration:**

```json
{
  "sinkConfig": {
    "sinkType": "csv",
    "path": "output.csv"
  }
}
```

**Features:**

- Automatically splits windows and actions into separate files
- Flattens nested objects for CSV compatibility
- Handles protocol metadata as JSON strings
- Appends to existing files if present

### 2. Stdout Sink (`stdout`)

Writes JSON objects to stdout, one per line.

**Configuration:**

```json
{
  "sinkConfig": {
    "sinkType": "stdout"
  }
}
```

**Features:**

- Simple line-delimited JSON output
- Useful for piping to other tools
- No file I/O overhead

### 3. Absinthe API Sink (`absinthe`)

Sends enriched data to the Absinthe API endpoint with automatic retries and rate limiting using `ky`.

**Minimal Configuration:**

```json
{
  "sinkConfig": {
    "sinkType": "absinthe"
  }
}
```

**Full Configuration (with explicit values):**

```json
{
  "sinkConfig": {
    "sinkType": "absinthe",
    "url": "https://custom.api.example.com",
    "apiKey": "${env:CUSTOM_API_KEY}",
    "rateLimit": 20,
    "batchSize": 500
  }
}
```

**Parameters:**

- `url` (optional, default: `https://adapters.absinthe.network`): Base URL of the Absinthe API
- `apiKey` (optional, default: `$ABSINTHE_API_KEY` env var): API key for authentication
- `rateLimit` (optional, default: `10`): Maximum requests per second
- `batchSize` (optional, default: `1000`): Maximum records per request

**API Key Discovery:**
The sink automatically discovers the API key in this order:

1. Explicit `apiKey` in config
2. `ABSINTHE_API_KEY` environment variable

**Features:**

- HTTP client via `ky` library (consistent with rest of codebase)
- Automatic exponential backoff retry on failures
- Rate limiting to prevent API throttling
- Batching to reduce number of API calls
- Graceful shutdown waits for pending requests

### 4. Multiple Sinks (Composite)

You can configure multiple sinks to write data to several destinations simultaneously.

**Configuration:**

```json
{
  "sinkConfig": {
    "sinks": [
      {
        "sinkType": "stdout"
      },
      {
        "sinkType": "csv",
        "path": "output.csv"
      },
      {
        "sinkType": "absinthe",
        "url": "https://api.absinthe.example.com"
      }
    ]
  }
}
```

**Features:**

- Writes to all configured sinks in parallel
- All sinks must succeed (if one fails, all fail)
- Properly coordinates initialization and cleanup

## Sink Interface

All sinks implement this interface:

```typescript
export interface Sink {
  init?(): Promise<void>; // Optional initialization
  write(batch: unknown[]): Promise<void>; // Write a batch of records
  flush?(): Promise<void>; // Optional flush
  close?(): Promise<void>; // Optional cleanup
}
```

## Implementation Details

### Absinthe Sink Retry Strategy

The Absinthe sink uses exponential backoff with jitter:

- Initial backoff: 1000ms
- Backoff multiplier: 2x per attempt
- Jitter: ±15% randomization
- Infinite retries until success

This ensures resilience against transient API failures without overwhelming the endpoint.

### Rate Limiting

Rate limiting uses the Bottleneck library to ensure requests are spaced appropriately:

- `maxConcurrent: 1` - Single request at a time
- `minTime` - Calculated as `1000 / rateLimit` ms between requests
- Default: 10 req/s (100ms between requests)

### Batching

Large datasets are split into sub-batches before sending:

- Default batch size: 1000 records
- Each sub-batch is sent sequentially
- Failures trigger retry for the specific sub-batch

## Error Handling

- CSV Sink: Fails immediately on file I/O errors
- Stdout Sink: Fails on stdout errors (rare)
- Absinthe Sink: Retries infinitely with backoff
- Composite Sink: Fails if any sink fails

## Performance Considerations

1. **CSV Sink**: Fast for local writes, but can be I/O bound on slow disks
2. **Stdout Sink**: Fastest for small datasets, but can block on pipe buffer full
3. **Absinthe Sink**: Network latency dependent, but rate limiting prevents overwhelming the API
4. **Composite Sink**: Performance is limited by slowest sink
