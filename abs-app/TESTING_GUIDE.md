# Testing Guide for Schema Validation

This guide explains how to test the AJV schema validation logic for transaction and timeWeightedBalance events.

## 🧪 Testing Options

### 1. Simple Test Runner (Recommended for Quick Testing)

The simplest way to test validation logic without setting up a full testing framework:

```bash
# Run the built-in test runner
npm run test:validation
# or
npm run test:simple
```

This will run comprehensive tests covering:
- ✅ Valid transaction validation
- ✅ Valid timeWeightedBalance validation (both triggers)
- ❌ Invalid payload rejection
- 🔍 Error message validation

### 2. Jest Tests (For Full Test Suite)

If you want to use Jest for more advanced testing:

```bash
# Install Jest dependencies (already in package.json)
npm install

# Run Jest tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### 3. API Endpoint Testing

Test the actual HTTP endpoints:

```bash
# See API test examples and curl commands
npx ts-node src/api-test-examples.ts

# This will print ready-to-use curl commands for testing:
# - /api/validate endpoint
# - /api/log endpoint  
# - Various valid/invalid payloads
```

## 📋 Test Categories

### Transaction Schema Tests
- ✅ Valid transaction with required fields
- ✅ Valid transaction with optional token/pricing data
- ❌ Missing required fields (eventId, userId, etc.)
- ❌ Invalid formats (userId, txHash, blockHash)
- ❌ Negative values (valueUsd, blockNumber, etc.)
- ❌ Invalid enum values (chainArch, eventType)

### TimeWeightedBalance Schema Tests
- ✅ Valid TWB with "exhausted" trigger
- ✅ Valid TWB with "transfer" trigger + required fields
- ❌ Transfer trigger missing block/tx fields
- ❌ Invalid timeWindowTrigger values
- ❌ Negative balance values
- ❌ Missing required TWB-specific fields

### General Validation Tests
- ❌ Empty/null request bodies
- ❌ Missing eventType
- ❌ Unsupported eventType values
- 🔍 Detailed error message formatting

## 🎯 Sample Test Data

### Valid Transaction
```json
{
  "version": "1.0.0",
  "eventType": "transaction",
  "eventId": "tx_12345",
  "userId": "0x1234567890123456789012345678901234567890",
  "chainArch": "evm",
  "networkId": 1,
  "chainShortName": "eth",
  "runner": { "runnerId": "container_123" },
  "valueUsd": 100.50,
  "unixTimestampMs": 1703095200000,
  "txHash": "0x1234...1234",
  "logIndex": 0,
  "blockNumber": 12345678,
  "blockHash": "0xabcd...5678"
}
```

### Valid TimeWeightedBalance (Exhausted)
```json
{
  "version": "1.0.0",
  "eventType": "timeWeightedBalance",
  "eventId": "twb_12345",
  "userId": "0x1234567890123456789012345678901234567890",
  "chainArch": "evm",
  "networkId": 1,
  "chainShortName": "eth",
  "runner": { "runnerId": "container_123" },
  "valueUsd": 100.50,
  "unixTimestampMs": 1703095200000,
  "balanceBefore": 500.0,
  "balanceAfter": 600.0,
  "timeWindowTrigger": "exhausted",
  "startUnixTimestampMs": 1703090000000,
  "endUnixTimestampMs": 1703095200000,
  "windowDurationMs": 5200000
}
```

### Valid TimeWeightedBalance (Transfer)
```json
{
  // ... same as above, but with:
  "timeWindowTrigger": "transfer",
  "startBlockNumber": 12345678,
  "endBlockNumber": 12345679,
  "txHash": "0x1234...1234"
}
```

## 🐛 Common Validation Errors

### Address Format Errors
```
/userId: must match pattern "^0x[a-fA-F0-9]{40}$"
```

### Hash Format Errors  
```
/txHash: must match pattern "^0x[a-fA-F0-9]{64}$"
```

### Missing Required Fields
```
must have required property 'eventId'
must have required property 'valueUsd'
```

### Conditional Field Errors (TWB Transfer)
```
must have required property 'startBlockNumber'
must have required property 'endBlockNumber' 
must have required property 'txHash'
```

### Enum Validation Errors
```
/timeWindowTrigger: must be equal to one of the allowed values
/chainArch: must be equal to one of the allowed values
```

## 🔧 Debugging Tips

1. **Schema Loading Issues**: Check that schema files are in the correct relative path
2. **AJV Configuration**: Verify AJV is configured with `strict: false` for flexibility
3. **Conditional Logic**: Pay attention to `if/then` schema conditions for TWB transfer fields
4. **Error Messages**: Use `getDetailedErrors()` method for debugging specific validation failures

## 📝 Adding New Tests

To add new test cases:

1. **Simple Test Runner**: Edit `src/test-runner.ts` and add new test cases
2. **Jest Tests**: Edit `tests/validation.test.ts` and add new describe/test blocks  
3. **API Tests**: Edit `src/api-test-examples.ts` and add new sample payloads

## 🚀 Running Tests in Development

```bash
# Start the server in dev mode
npm run dev

# In another terminal, run validation tests
npm run test:validation

# Test API endpoints with curl (see api-test-examples.ts output)
```

This setup allows you to:
- 🧪 Test schema validation logic in isolation
- 🌐 Test actual HTTP API endpoints
- 🔍 Debug validation errors with detailed messages
- ⚡ Quickly iterate on schema changes 