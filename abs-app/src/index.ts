import express, { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Define types for API keys configuration
interface ApiKeyConfig {
    points: number;
    duration: number;
}

interface ApiKeys {
    [key: string]: ApiKeyConfig;
}

interface RateLimiters {
    [key: string]: RateLimiterMemory;
}

// Middleware for parsing JSON with BigInt support
app.use(express.json({
    reviver: (key: string, value: any): any => {
        // Convert string values that look like BigInt to regular numbers
        if (typeof value === 'string' && /^\d+n$/.test(value)) {
            return value.slice(0, -1); // Remove the 'n' suffix and return as string
        }
        return value;
    }
}));

// API keys (in a real app, store these securely)
const validApiKeys: ApiKeys = {
    'api_key_1': { points: 10, duration: 10 }, // 10 requests per minute
    'api_key_2': { points: 20, duration: 3 } // 1000 requests per minute
};

// Create rate limiters for each API key
const rateLimiters: RateLimiters = {};

Object.entries(validApiKeys).forEach(([key, limit]) => {
    rateLimiters[key] = new RateLimiterMemory({
        points: limit.points,
        duration: limit.duration
    });
});

// Middleware for API key validation and rate limiting
const apiKeyMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
    const apiKey = req.headers['x-api-key'] as string | undefined;

    if (!apiKey || !validApiKeys[apiKey]) {
        return res.status(401).json({ error: 'Invalid API key' });
    }

    try {
        await rateLimiters[apiKey].consume(apiKey);

        // Get remaining points (no direct getPoints method in RateLimiterMemory)
        let remainingPoints: number | null = null;
        try {
            const result = await rateLimiters[apiKey].get(apiKey);
            if (result) {
                remainingPoints = validApiKeys[apiKey].points - result.consumedPoints;
            }
        } catch (e) {
            // If get fails, ignore and continue
        }

        console.log('Remaining points:', remainingPoints !== null ? remainingPoints : 'unknown');
        next();
    } catch (error) {
        const rateLimiterRes = error as RateLimiterRes;
        return res.status(429).json({
            error: 'Too many requests',
            retryAfter: rateLimiterRes.msBeforeNext / 1000
        });
    }
};

// Helper function to handle BigInt serialization
const handleBigIntSerialization = (data: any): any => {
    if (data === null || data === undefined) return data;

    if (typeof data === 'bigint') {
        return data.toString();
    }

    if (Array.isArray(data)) {
        return data.map(handleBigIntSerialization);
    }

    if (typeof data === 'object') {
        const result: Record<string, any> = {};
        for (const key in data) {
            result[key] = handleBigIntSerialization(data[key]);
        }
        return result;
    }

    return data;
};

// Sample endpoint that logs the request body
app.post('/api/log', apiKeyMiddleware, (req: Request, res: Response) => {
    // Convert any BigInt values before logging
    const processedBody = handleBigIntSerialization(req.body);
    console.log('Request body:', processedBody);
    res.status(200).json({ success: true, message: 'Request logged successfully' });
});

// Health check endpoint (no rate limiting)
app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'UP' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 