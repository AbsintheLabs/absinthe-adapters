import express from 'express';
import { apiKeyMiddleware } from './middleware/apiKey';
import { logRequestHandler, healthCheckHandler } from './routes/api';

export const createApp = (): express.Application => {
  const app = express();
  app.use(express.json());
  app.post('/api/log', apiKeyMiddleware, logRequestHandler);
  app.get('/health', healthCheckHandler);

  return app;
};
