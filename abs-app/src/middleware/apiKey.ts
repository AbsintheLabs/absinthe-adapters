import { Request, Response, NextFunction } from 'express';
import { RateLimiterRes } from 'rate-limiter-flexible';
import { rateLimiterService } from '../services/rateLimiter';

/**
 * Middleware for API key validation and rate limiting
 */
export const apiKeyMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void | Response> => {
    const apiKey = req.headers['x-api-key'] as string | undefined;

    // Check if API key is provided and valid
    if (!apiKey || !rateLimiterService.isValidApiKey(apiKey)) {
        return res.status(401).json({ error: 'Invalid API key' });
    }

    try {
        // Consume a point for rate limiting
        await rateLimiterService.consumePoint(apiKey);

        // Continue to next middleware
        next();
    } catch (error) {
        // Handle rate limit exceeded
        const rateLimiterRes = error as RateLimiterRes;
        return res.status(429).json({
            error: 'Too many requests',
            retryAfter: rateLimiterRes.msBeforeNext / 1000
        });
    }
}; 