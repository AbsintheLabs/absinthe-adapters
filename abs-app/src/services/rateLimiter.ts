import { RateLimiterMemory } from 'rate-limiter-flexible';
import { RateLimiters } from '../types';
import { redisService } from './redis';
import { logToFile } from '../utils/logger';
import { config } from '../config';

const POINTS = 10;
const DURATION = 1;

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
  private async initializeRateLimiters(): Promise<void> {
    const keys = await redisService.getAllKeys();
    keys.forEach((key: string) => {
      this.rateLimiters[`api_key_${config.environment}:${key}`] = new RateLimiterMemory({
        points: POINTS,
        duration: DURATION,
      });
    });
  }

  /**
   * Check if API key is valid
   */
  public async isValidApiKey(apiKey: string): Promise<boolean> {
    const keys = await redisService.getAllKeys();
    if (
      keys.includes(`api_key_${config.environment}:${apiKey}`) &&
      !this.rateLimiters[`api_key_${config.environment}:${apiKey}`]
    ) {
      this.rateLimiters[`api_key_${config.environment}:${apiKey}`] = new RateLimiterMemory({
        points: POINTS,
        duration: DURATION,
      });
      logToFile(`Added new rate limiter for API key: ${apiKey}`);
      return true;
    }
    if (
      keys.includes(`api_key_${config.environment}:${apiKey}`) &&
      this.rateLimiters[`api_key_${config.environment}:${apiKey}`]
    ) {
      logToFile(`API key valid and rate limiter exists: ${apiKey}`);
      return true;
    }
    logToFile(`Invalid API key attempted: ${apiKey}`);
    return false;
  }

  /**
   * Consume a point for the given API key
   */
  public async consumePoint(apiKey: string): Promise<void> {
    if (!this.rateLimiters[`api_key_${config.environment}:${apiKey}`]) {
      logToFile(`Tried to consume point for invalid API key: ${apiKey}`);
      throw new Error('Invalid API key');
    }
    await this.rateLimiters[`api_key_${config.environment}:${apiKey}`].consume(apiKey);
    logToFile(`Consumed point for API key: ${apiKey}`);
  }

  /**
   * Get remaining points for an API key
   */
  public async getRemainingPoints(apiKey: string): Promise<number | null> {
    if (!this.rateLimiters[`api_key_${config.environment}:${apiKey}`]) {
      logToFile(`Tried to get remaining points for invalid API key: ${apiKey}`);
      return null;
    }

    try {
      const result = await this.rateLimiters[`api_key_${config.environment}:${apiKey}`].get(apiKey);
      if (result) {
        const remaining =
          this.rateLimiters[`api_key_${config.environment}:${apiKey}`].points -
          result.consumedPoints;
        logToFile(`Remaining points for API key ${apiKey}: ${remaining}`);
        return remaining;
      }
    } catch (e) {
      logToFile(`Error getting remaining points for API key ${apiKey}: ${e}`);
      // If get fails, ignore and return null
    }
    return null;
  }
}

// Export singleton instance
export const rateLimiterService = new RateLimiterService();
