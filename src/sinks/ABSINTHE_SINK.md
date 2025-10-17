# Absinthe API Sink

Send enriched blockchain data directly to the Absinthe API.

## Quick Start

### Minimal Configuration (recommended)

```json
{
  "sinkConfig": {
    "sinkType": "absinthe"
  }
}
```

This uses all defaults:

- **URL**: `https://adapters.absinthe.network`
- **API Key**: Reads from `ABSINTHE_API_KEY` environment variable
- **Rate Limit**: 10 requests/second
- **Batch Size**: 1000 records per request

### Custom Configuration

Override any defaults as needed:

```json
{
  "sinkConfig": {
    "sinkType": "absinthe",
    "url": "https://custom-instance.absinthe.network",
    "apiKey": "my-explicit-key",
    "rateLimit": 20,
    "batchSize": 500
  }
}
```

## Configuration Reference

| Parameter   | Type   | Required | Default                             | Description              |
| ----------- | ------ | -------- | ----------------------------------- | ------------------------ |
| `sinkType`  | string | ✅       | -                                   | Must be `"absinthe"`     |
| `url`       | string | ❌       | `https://adapters.absinthe.network` | Base URL of Absinthe API |
| `apiKey`    | string | ❌       | `$ABSINTHE_API_KEY`                 | API authentication key   |
| `rateLimit` | number | ❌       | `10`                                | Max requests per second  |
| `batchSize` | number | ❌       | `1000`                              | Max records per request  |

## API Key Priority

The sink discovers the API key in this order:

1. **Explicit config**: `sinkConfig.apiKey`
2. **Environment variable**: `ABSINTHE_API_KEY`

If neither is provided, requests will be sent without authentication (may fail depending on API requirements).

## Features

✅ **Automatic retries** - Infinite retry with exponential backoff until success
✅ **Rate limiting** - Prevents API throttling via Bottleneck
✅ **Batching** - Large datasets split into manageable chunks
✅ **Graceful shutdown** - Waits for pending requests before closing
✅ **Uses `ky`** - Modern HTTP client consistent with codebase

## Examples

### Production Setup

```bash
# Set API key via environment
export ABSINTHE_API_KEY="your-production-key"

# Run with minimal config
node dist/main.js config.json
```

### Development with Custom URL

```json
{
  "sinkConfig": {
    "sinkType": "absinthe",
    "url": "http://localhost:3000"
  }
}
```

### High-Throughput Configuration

```json
{
  "sinkConfig": {
    "sinkType": "absinthe",
    "rateLimit": 50,
    "batchSize": 2000
  }
}
```

### Multiple Sinks (API + CSV)

```json
{
  "sinkConfig": {
    "sinks": [
      {
        "sinkType": "absinthe"
      },
      {
        "sinkType": "csv",
        "path": "backup.csv"
      }
    ]
  }
}
```

## Error Handling

The sink retries failed requests indefinitely with exponential backoff:

- **Initial backoff**: 1000ms (1 second)
- **Backoff multiplier**: 2x per attempt
- **Jitter**: ±15% randomization to prevent thundering herd

### Example Retry Sequence

| Attempt | Wait Time | Cumulative Time |
| ------- | --------- | --------------- |
| 1       | 0s        | 0s              |
| 2       | ~1s       | ~1s             |
| 3       | ~2s       | ~3s             |
| 4       | ~4s       | ~7s             |
| 5       | ~8s       | ~15s            |
| 6       | ~16s      | ~31s            |

The sink logs each retry attempt with status codes for debugging.

## Troubleshooting

### No API Key Found

```
Error: Request failed without authentication
```

**Solution**: Set `ABSINTHE_API_KEY` environment variable or add `apiKey` to config.

### Rate Limiting

```
Error: 429 Too Many Requests
```

**Solution**: Reduce `rateLimit` in config (e.g., from 10 to 5).

### Large Batches Timing Out

```
Error: Request timeout
```

**Solution**: Reduce `batchSize` in config (e.g., from 1000 to 500).

## Architecture

```
┌─────────────┐
│   Engine    │
└──────┬──────┘
       │ write(batch)
       ▼
┌─────────────────┐
│ AbsintheSink    │
├─────────────────┤
│ • Split batch   │
│ • Rate limit    │
│ • Retry logic   │
└────────┬────────┘
         │ POST /api/log
         ▼
┌─────────────────┐
│  Absinthe API   │
└─────────────────┘
```

## API Endpoint

The sink sends data to: `POST {url}/api/log`

**Request:**

```json
[
  {
    "eventType": "timeWeightedBalance",
    "user": "0x...",
    "asset": "0x...",
    ...
  }
]
```

**Headers:**

```
Content-Type: application/json
x-api-key: {apiKey}
```

**Response:**

- `2xx`: Success
- `4xx/5xx`: Retry with backoff
