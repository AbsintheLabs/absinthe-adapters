import Bottleneck from 'bottleneck';
import ky, { HTTPError } from 'ky';
import { Sink, SinkInitMetadata } from './sink-factory.ts';
import { logger } from '../utils/logger.ts';

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
  private trackableMetadataMap: Map<string, { adapter_id: string; trackable_name: string }>;

  constructor(config: AbsintheSinkConfig) {
    // URL defaults to https://adapters.absinthe.network (handled by schema)
    this.url = config.url;

    // API key: explicit config > env var
    this.apiKey = config.apiKey || process.env.ABSINTHE_API_KEY;

    // Batch size defaults to 100 (handled by schema)
    this.batchSize = config.batchSize ?? 100;

    // Rate limiting defaults to 10 req/s (handled by schema)
    const rateLimit = config.rateLimit ?? 10;
    const minTime = 1000 / rateLimit;

    this.limiter = new Bottleneck({
      maxConcurrent: 1,
      minTime,
    });

    // Initialize empty metadata map - will be populated during init
    this.trackableMetadataMap = new Map();
  }

  /**
   * Initialize the sink by registering trackable instances with the Absinthe API.
   * Called before indexing starts to validate connectivity and configuration.
   */
  async init(metadata?: SinkInitMetadata): Promise<void> {
    try {
      logger.info(`[AbsintheSink] Initializing connection to ${this.url}`);

      if (!metadata?.trackableInstances || metadata.trackableInstances.length === 0) {
        logger.error(`[AbsintheSink] No trackable instances to register`);
        throw new Error('No trackable instances to register');
      }

      // Build lookup map from trackableInstanceId to adapter_id and trackable_name
      for (const instance of metadata.trackableInstances) {
        this.trackableMetadataMap.set(instance.trackable_instance_id, {
          adapter_id: instance.adapter_id,
          trackable_name: instance.trackable_name,
        });
      }

      logger.info(
        `[AbsintheSink] Built metadata map for ${this.trackableMetadataMap.size} trackable instance(s)`,
      );

      // Register all trackable instances with the backend
      const registerUrl = new URL('registerConfig', this.url).toString();
      const headers = this.apiKey ? { 'x-api-key': this.apiKey } : {};

      logger.info(
        `[AbsintheSink] Registering ${metadata.trackableInstances.length} trackable instance(s)`,
      );

      await ky.post(registerUrl, {
        json: metadata.trackableInstances,
        headers,
      });

      logger.info(`[AbsintheSink] Successfully registered all trackable instances`);
    } catch (error) {
      logger.error(`[AbsintheSink] Failed to register trackable instances:`, error);
      throw error;
    }
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
          ky.post(`${new URL('events', this.url).toString()}`, {
            json: data,
            headers: this.apiKey ? { 'x-api-key': this.apiKey } : {},
          }),
        );

        // Success - ky only resolves for 2xx responses
        return;
      } catch (error) {
        if (error instanceof HTTPError) {
          logger.error(
            `Absinthe API returned ${error.response.status} ${error.response.statusText}, retrying...`,
          );
        } else {
          logger.error(`Absinthe API request failed (attempt ${attemptCount}):`, error);
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

    // Augment each event with adapter_id and trackable_name
    const augmentedBatch = batch.map((event: any) => {
      // Look up metadata using trackableInstanceId
      const trackableInstanceId = event.trackableInstanceId;
      const metadata = trackableInstanceId
        ? this.trackableMetadataMap.get(trackableInstanceId)
        : undefined;

      // Add adapter_id and trackable_name to the event
      return {
        ...event,
        adapter_id: metadata?.adapter_id,
        trackable_name: metadata?.trackable_name,
      };
    });

    // Split into sub-batches if needed
    for (let i = 0; i < augmentedBatch.length; i += this.batchSize) {
      const subBatch = augmentedBatch.slice(i, i + this.batchSize);
      await this.sendWithRetry(subBatch);
    }
  }

  async close(): Promise<void> {
    // Wait for all pending requests to complete
    await this.limiter.stop({ dropWaitingJobs: false });
  }
}
