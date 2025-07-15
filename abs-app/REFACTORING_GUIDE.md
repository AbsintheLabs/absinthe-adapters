# API Refactoring Guide

## Overview

The API has been refactored from a single monolithic file into a modular, maintainable structure. This improves code organization, testability, and maintainability.

## New Project Structure

```
src/
├── index.ts              # Main entry point (simplified)
├── app.ts                # Express app configuration
├── config/
│   └── index.ts          # Configuration and environment variables
├── types/
│   └── index.ts          # TypeScript interfaces and types
├── utils/
│   ├── bigint.ts         # BigInt handling utilities
│   └── logger.ts         # Logging utilities
├── services/
│   └── rateLimiter.ts    # Rate limiting service
├── middleware/
│   └── apiKey.ts         # API key validation middleware
└── routes/
    └── api.ts            # Route handlers
```

## Key Improvements

### 1. **Separation of Concerns**

- **Configuration**: All environment variables and app config in `config/`
- **Types**: TypeScript interfaces centralized in `types/`
- **Utilities**: Helper functions organized by purpose
- **Services**: Business logic encapsulated in service classes
- **Middleware**: Express middleware functions isolated
- **Routes**: Route handlers separated from app configuration

### 2. **Better Maintainability**

- Each module has a single responsibility
- Easy to locate and modify specific functionality
- Clear dependencies between modules
- Consistent code organization
- Direct imports make dependencies explicit

### 3. **Improved Testability**

- Services can be easily unit tested
- Middleware can be tested in isolation
- Utilities have pure functions that are easy to test
- Dependency injection is possible with the service pattern

### 4. **Enhanced Readability**

- Main entry point (`index.ts`) is now just 12 lines
- Each file focuses on one specific aspect
- Clear naming conventions
- Proper JSDoc comments
- Direct imports show exactly what's being used

## Module Descriptions

### `config/index.ts`

- Centralizes all configuration
- Handles environment variables
- Exports API key configurations

### `types/index.ts`

- Defines TypeScript interfaces
- Ensures type safety across modules
- Easy to extend with new types

### `utils/bigint.ts`

- Handles BigInt serialization
- JSON reviver function for parsing
- Pure utility functions

### `utils/logger.ts`

- File and console logging utilities
- Directory creation handling
- Centralized logging logic

### `services/rateLimiter.ts`

- Encapsulates rate limiting logic
- Service class pattern
- Singleton instance export
- Clean API for rate limit operations

### `middleware/apiKey.ts`

- API key validation
- Rate limiting enforcement
- Express middleware pattern
- Proper error handling

### `routes/api.ts`

- Route handler functions
- Separated from Express app setup
- Clean request/response handling

### `app.ts`

- Express application configuration
- Middleware setup
- Route registration
- Returns configured app instance

## Benefits of This Structure

1. **Scalability**: Easy to add new features without cluttering existing code
2. **Maintainability**: Changes are localized to specific modules
3. **Testability**: Each module can be tested independently
4. **Reusability**: Utilities and services can be reused across the application
5. **Team Development**: Multiple developers can work on different modules simultaneously
6. **Code Quality**: Enforces better coding practices and patterns
7. **Explicit Dependencies**: Direct imports make it clear what each module depends on

## Migration Notes

The refactored code maintains the same API endpoints and functionality:

- `POST /api/log` - Still requires API key and logs requests
- `GET /health` - Health check endpoint (no authentication required)

All existing functionality is preserved while improving the codebase structure.
