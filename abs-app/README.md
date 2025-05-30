# Rate Limited API with Kafka Integration

A Node.js Express API with rate limiting by API key and Kafka message publishing.

## Features

- ✅ **Rate Limiting**: Different rate limits per API key
- ✅ **Request Logging**: Console and file logging
- ✅ **Kafka Integration**: Sends all logged requests to Kafka topic
- ✅ **BigInt Support**: Handles BigInt serialization
- ✅ **Health Check**: Simple health endpoint
- ✅ **Graceful Shutdown**: Proper cleanup of Kafka connections

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file with the following variables:

```env
# Server Configuration
PORT=3000

# Logging Configuration
LOG_FILE_PATH=./logs/requests.log

# Kafka Configuration
KAFKA_CLIENT_ID=rate-limited-api
KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC=api-logs

# For multiple brokers, separate with commas:
# KAFKA_BROKERS=broker1:9092,broker2:9092,broker3:9092
```

### 3. Start Kafka (if running locally)
```bash
# Using Docker Compose
docker-compose up -d kafka zookeeper

# Or using Podman Compose
podman-compose up -d kafka zookeeper
```

### 4. Run the Application
```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

## API Endpoints

### POST /api/log
Logs request data to console, file, and Kafka topic.

**Headers:**
- `x-api-key`: Required API key
- `Content-Type: application/json`

**Example:**
```bash
curl -X POST http://localhost:3000/api/log \
  -H "Content-Type: application/json" \
  -H "x-api-key: api_key_1" \
  -d '{"message": "test data", "userId": 123}'
```

### GET /health
Health check endpoint (no authentication required).

**Example:**
```bash
curl http://localhost:3000/health
```

## API Keys & Rate Limits

| API Key     | Rate Limit                               |
| ----------- | ---------------------------------------- |
| `api_key_1` | 10 requests/second                       |
| `api_key_2` | 10 requests/10000000000000ms (unlimited) |

## Kafka Integration

The API automatically sends all logged requests to a Kafka topic with the following structure:

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "data": {
    "message": "test data",
    "userId": 123
  }
}
```

**Message Key**: Uses the API key for message partitioning
**Topic**: Configurable via `KAFKA_TOPIC` environment variable

## Project Structure

```
src/
├── index.ts              # Main entry point with graceful shutdown
├── app.ts                # Express app configuration
├── config/
│   └── index.ts          # Configuration and environment variables
├── types/
│   └── index.ts          # TypeScript interfaces
├── utils/
│   ├── bigint.ts         # BigInt handling utilities
│   └── logger.ts         # File and console logging
├── services/
│   ├── kafka.ts          # Kafka producer service
│   └── rateLimiter.ts    # Rate limiting service
├── middleware/
│   └── apiKey.ts         # API key validation middleware
└── routes/
    └── api.ts            # Route handlers
```

## Error Handling

- **Invalid API Key**: Returns `401 Unauthorized`
- **Rate Limit Exceeded**: Returns `429 Too Many Requests`
- **Kafka Connection Issues**: Logs warning but continues processing
- **Graceful Shutdown**: Properly closes Kafka connections on SIGTERM/SIGINT

## Development

```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Build TypeScript
npm run build

# Run tests (if available)
npm test
```

## Docker Support

The application includes Docker configuration for easy deployment and development.
