const express = require('express');
const { RateLimiterMemory } = require('rate-limiter-flexible');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON with BigInt support
app.use(express.json({
    reviver: (key, value) => {
        // Convert string values that look like BigInt to regular numbers
        if (typeof value === 'string' && /^\d+n$/.test(value)) {
            return value.slice(0, -1); // Remove the 'n' suffix and return as string
        }
        return value;
    }
}));

// API keys (in a real app, store these securely)
const validApiKeys = {
    'api_key_1': { points: 10, duration: 60 }, // 10 requests per minute
    'api_key_2': { points: 1000, duration: 60 }  // 1000 requests per minute
};

// Create rate limiters for each API key
const rateLimiters = {};

Object.entries(validApiKeys).forEach(([key, limit]) => {
    rateLimiters[key] = new RateLimiterMemory({
        points: limit.points,
        duration: limit.duration
    });
});

// Middleware for API key validation and rate limiting
const apiKeyMiddleware = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || !validApiKeys[apiKey]) {
        return res.status(401).json({ error: 'Invalid API key' });
    }

    try {
        await rateLimiters[apiKey].consume(apiKey);
        console.log('count:', rateLimiters[apiKey].getPoints(apiKey))
        next();
    } catch (error) {
        return res.status(429).json({
            error: 'Too many requests',
            retryAfter: error.msBeforeNext / 1000
        });
    }
};

// Helper function to handle BigInt serialization
const handleBigIntSerialization = (data) => {
    if (data === null || data === undefined) return data;

    if (typeof data === 'bigint') {
        return data.toString();
    }

    if (Array.isArray(data)) {
        return data.map(handleBigIntSerialization);
    }

    if (typeof data === 'object') {
        const result = {};
        for (const key in data) {
            result[key] = handleBigIntSerialization(data[key]);
        }
        return result;
    }

    return data;
};

// Sample endpoint that logs the request body
app.post('/api/log', apiKeyMiddleware, (req, res) => {
    // Convert any BigInt values before logging
    const processedBody = handleBigIntSerialization(req.body);
    console.log('Request body:', processedBody);
    res.status(200).json({ success: true, message: 'Request logged successfully' });
});

// Health check endpoint (no rate limiting)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 