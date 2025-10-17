import Bottleneck from 'bottleneck';
import ky, { HTTPError } from 'ky';
import { Sink } from './sink-factory.ts';

interface AbsintheSinkConfig {
  url: string;
  apiKey?: string;
  rateLimit?: number;
  batchSize?: number;
}

export class AbsintheSink implements Sink {
  private limiter: Bottleneck;
  private batchSize: number;
  private url: string;
  private apiKey?: string;

  constructor(config: AbsintheSinkConfig) {
    // URL defaults to https://adapters.absinthe.network (handled by schema)
    this.url = (config.url || 'https://adapters.absinthe.network').replace(/\/$/, '');

    // API key: explicit config > env var
    this.apiKey = config.apiKey || process.env.ABSINTHE_API_KEY;

    // Batch size defaults to 1000 (handled by schema)
    this.batchSize = config.batchSize ?? 1000;

    // Rate limiting defaults to 10 req/s (handled by schema)
    const rateLimit = config.rateLimit ?? 10;
    const minTime = 1000 / rateLimit;

    this.limiter = new Bottleneck({
      maxConcurrent: 1,
      minTime,
    });
  }

  /**
   * Send data with exponential backoff retry
   */
  private async sendWithRetry(data: unknown[], initialBackoffMs = 1000): Promise<void> {
    let backoffMs = initialBackoffMs;
    let attemptCount = 0;

    while (true) {
      attemptCount++;

      try {
        await this.limiter.schedule(() =>
          ky.post(`${this.url}/api/log`, {
            json: data,
            headers: this.apiKey ? { 'x-api-key': this.apiKey } : {},
          }),
        );

        // Success - ky only resolves for 2xx responses
        return;
      } catch (error) {
        if (error instanceof HTTPError) {
          console.error(
            `Absinthe API returned ${error.response.status} ${error.response.statusText}, retrying...`,
          );
        } else {
          console.error(`Absinthe API request failed (attempt ${attemptCount}):`, error);
        }
      }

      // Exponential backoff with jitter
      const jitter = Math.random() * 0.3 + 0.85; // 0.85 to 1.15
      const waitTime = Math.floor(backoffMs * jitter);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      backoffMs *= 2;
    }
  }

  async write(batch: unknown[]): Promise<void> {
    if (!batch?.length) return;

    // Split into sub-batches if needed
    for (let i = 0; i < batch.length; i += this.batchSize) {
      const subBatch = batch.slice(i, i + this.batchSize);
      await this.sendWithRetry(subBatch);
    }
  }

  async close(): Promise<void> {
    // Wait for all pending requests to complete
    await this.limiter.stop({ dropWaitingJobs: false });
  }
}
