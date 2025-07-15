import { Request, Response, NextFunction } from 'express';
import { RateLimiterRes } from 'rate-limiter-flexible';
import { rateLimiterService } from '../services/rateLimiter';
import { ApiKeyValidationService } from '../services/ApiKeyValidationService';
import { logToFile } from '../utils/logger';

/**
 * Middleware for API key validation and rate limiting
 */
export const apiKeyMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void | Response> => {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (!apiKey) {
    return res.status(401).json({ error: 'API key is required' });
  }
  const apiKeyValidationService = new ApiKeyValidationService({
    baseUrl: process.env.API_URL as string,
    adminSecret: process.env.ADMIN_SECRET as string,
    environment: process.env.ENVIRONMENT as 'dev' | 'staging' | 'prod',
  });
  const isActive = await apiKeyValidationService.validateApiKey(apiKey);
  if (isActive.isValid) {
    logToFile('API key is valid');
    if (!(await rateLimiterService.isValidApiKey(apiKey))) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    try {
      await rateLimiterService.consumePoint(apiKey);
      logToFile('Request processed successfully');
      next();
    } catch (error) {
      logToFile(JSON.stringify(error));
      const rateLimiterRes = error as RateLimiterRes;
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: rateLimiterRes.msBeforeNext / 1000,
      });
    }
  } else {
    return res.status(401).json({ error: 'API key is not active' });
  }
};
