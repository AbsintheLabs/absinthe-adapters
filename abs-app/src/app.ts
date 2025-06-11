import express from 'express';
import { apiKeyMiddleware } from './middleware/apiKey';
import { logRequestHandler, healthCheckHandler } from './routes/api';

/**
 * Create and configure Express application
 */
export const createApp = (): express.Application => {
  const app = express();
  app.use(express.json());
  // Routes
  app.post('/api/log', apiKeyMiddleware, logRequestHandler);
  // app.post('/api/validate', validateRequestHandler); // No API key required for validation
  app.get('/health', healthCheckHandler);

  return app;
};
