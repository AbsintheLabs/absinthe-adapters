# Rate-Limited API

A simple Express API with rate limiting based on API keys using node-rate-limiter-flexible, now with TypeScript support.

## Setup

1. Run the setup script to install all dependencies:

   ```
   ./setup.sh
   ```

   Or manually install dependencies:

   ```
   npm install
   ```

2. Build the TypeScript code:

   ```
   npm run build
   ```

3. Start the server:

   ```
   npm start
   ```

   Or for development with auto-reload:

   ```
   npm run dev
   ```

## API Endpoints

### Log Endpoint

- **URL**: `/api/log`
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `X-API-Key: [your-api-key]`
- **Body**: Any JSON object
- **Note**: This endpoint handles BigInt values automatically by converting them to strings

### Health Check

- **URL**: `/health`
- **Method**: `GET`

## Rate Limits

The API uses two predefined API keys with different rate limits:

- `api_key_1`: 10 requests per minute
- `api_key_2`: 1000 requests per minute

## BigInt Handling

This API includes special handling for BigInt values:

1. The server automatically converts any BigInt values in request bodies to strings
2. When sending data to this API from JavaScript, use the included conversion function:

```typescript
// Convert BigInt values to strings for JSON
const convertBigIntToString = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map(convertBigIntToString);
  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const key in obj) {
      result[key] = convertBigIntToString(obj[key]);
    }
    return result;
  }
  return obj;
};

// Use when sending data:
fetch('/api/log', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'api_key_1',
  },
  body: JSON.stringify(convertBigIntToString(data)),
});
```

## Example Usage

```bash
curl -X POST http://localhost:3000/api/log \
  -H "X-API-Key: api_key_1" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, world!"}'
```

## Docker Support

Build and run using Docker:

```bash
docker build -t rate-limited-api .
docker run -p 3000:3000 rate-limited-api
```
