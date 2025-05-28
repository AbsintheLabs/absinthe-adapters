import express from 'express';
import { bigIntReviver } from './utils/bigint';
import { ensureLogDirectory } from './utils/logger';
import { apiKeyMiddleware } from './middleware/apiKey';
import { logRequestHandler, healthCheckHandler } from './routes/api';

/**
 * Create and configure Express application
 */
export const createApp = (): express.Application => {
    const app = express();

    // Ensure log directory exists
    ensureLogDirectory();

    // Middleware for parsing JSON with BigInt support
    app.use(express.json({
        reviver: bigIntReviver
    }));

    // Routes
    app.post('/api/log', apiKeyMiddleware, logRequestHandler);
    app.get('/health', healthCheckHandler);

    return app;
}; 