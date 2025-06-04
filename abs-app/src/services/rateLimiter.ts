import { RateLimiterMemory } from 'rate-limiter-flexible';
import { RateLimiters } from '../types';
import { validApiKeys } from '../config';

/**
 * Rate limiter service class
 */
export class RateLimiterService {
    private rateLimiters: RateLimiters = {};

    constructor() {
        this.initializeRateLimiters();
    }

    /**
     * Initialize rate limiters for each API key
     */
    private initializeRateLimiters(): void {
        Object.entries(validApiKeys).forEach(([key, limit]) => {
            this.rateLimiters[key] = new RateLimiterMemory({
                points: limit.points,
                duration: limit.duration
            });
        });
    }

    /**
     * Check if API key is valid
     */
    public isValidApiKey(apiKey: string): boolean {
        // todo: add proper auth service
        return apiKey in validApiKeys;
    }

    /**
     * Consume a point for the given API key
     */
    public async consumePoint(apiKey: string): Promise<void> {
        if (!this.rateLimiters[apiKey]) {
            throw new Error('Invalid API key');
        }
        await this.rateLimiters[apiKey].consume(apiKey);
    }

    /**
     * Get remaining points for an API key
     */
    public async getRemainingPoints(apiKey: string): Promise<number | null> {
        if (!this.rateLimiters[apiKey]) {
            return null;
        }

        try {
            const result = await this.rateLimiters[apiKey].get(apiKey);
            if (result) {
                return validApiKeys[apiKey].points - result.consumedPoints;
            }
        } catch (e) {
            // If get fails, ignore and return null
        }
        return null;
    }
}

// Export singleton instance
export const rateLimiterService = new RateLimiterService(); 