import express from 'express';
import { apiKeyMiddleware } from './middleware/apiKey';
import { logRequestHandler, healthCheckHandler } from './routes/api';
import { redisService } from './services/redis';

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

process.on('SIGINT', async () => {
  await redisService.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await redisService.disconnect();
  process.exit(0);
});
