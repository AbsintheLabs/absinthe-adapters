import express from 'express';
import { bigIntReviver } from './utils/bigint';
import { ensureLogDirectory } from './utils/logger';
import { apiKeyMiddleware } from './middleware/apiKey';
import { logRequestHandler, healthCheckHandler, validateRequestHandler } from './routes/api';

/**
 * Create and configure Express application
 */
export const createApp = (): express.Application => {
    const app = express();

    // Middleware for parsing JSON with BigInt support
    // todo: remove the reviver since we will have all string typing (without bigint support later)
    app.use(express.json({
        reviver: bigIntReviver
    }));

    // Routes
    app.post('/api/log', apiKeyMiddleware, logRequestHandler);
    app.post('/api/validate', validateRequestHandler); // No API key required for validation
    app.get('/health', healthCheckHandler);

    return app;
}; 