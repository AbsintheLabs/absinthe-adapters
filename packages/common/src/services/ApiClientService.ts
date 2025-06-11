import Bottleneck from 'bottleneck';
import { fetchWithRetry } from '../utils/helper/fetchWithRetry';
import { logger } from '../utils/logger';
import { BATCH_SIZE } from '../utils/consts';
import { TimeWeightedBalanceEvent } from '../types/interfaces/interfaces';
import { TransactionEvent } from '../types/interfaces/interfaces';

interface ApiClientConfig {
  baseUrl: string;
  apiKey: string;
  maxRetries?: number;
  initialBackoffMs?: number;
  maxConcurrent?: number;
  minTime?: number;
}

export class AbsintheApiClient {
  private baseUrl: string;
  private apiKey: string;
  private limiter: Bottleneck;
  private maxRetries: number;
  private initialBackoffMs: number;

  constructor({
    baseUrl,
    apiKey,
    maxRetries = 10,
    initialBackoffMs = 1000,
    maxConcurrent = 1,
    minTime = 110,
  }: ApiClientConfig) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.maxRetries = maxRetries;
    this.initialBackoffMs = initialBackoffMs;
    this.limiter = new Bottleneck({
      maxConcurrent,
      minTime, // space out the calls to avoid rate limits
    });
  }

  private async sendSingleBatch(
    data: TimeWeightedBalanceEvent[] | TransactionEvent[],
  ): Promise<void> {
    logger.info(`Sending ${data.length} records to API...`);
    const response = await this.sendData('api/log', data);

    if (!response.ok) {
      throw new Error(`Failed to send data: ${response.status} ${response.statusText}`);
    }
  }

  private async sendMultipleBatches(
    data: TimeWeightedBalanceEvent[] | TransactionEvent[],
  ): Promise<void> {
    const batchCount = Math.ceil(data.length / BATCH_SIZE);
    // logger.info(`Splitting ${data.length} ${data[0].dataType} records into ${batchCount} batches...`);

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

      logger.info(`Sending batch ${batchNumber}/${batchCount} with ${batch.length} records...`);

      const response = await this.sendData('api/log', batch);

      if (!response.ok) {
        throw new Error(
          `Failed to send batch ${batchNumber}/${batchCount}: ${response.status} ${response.statusText}`,
        );
      }
    }

    logger.info(`Successfully sent all ${batchCount} batches.`);
  }

  /**
   * Sends data to the API with retry logic
   * @param endpoint API endpoint to call
   * @param data Data to send
   * @returns API response
   */
  async sendData<T = any>(endpoint: string, data: T): Promise<Response> {
    if (!data) {
      throw new Error('No data provided');
    }

    const normalizedEndpoint = endpoint.replace(/^\//, '');

    // Create a function for the API call that will be retried
    const apiCall = () =>
      this.limiter.schedule(() =>
        fetch(`${this.baseUrl}/${normalizedEndpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
          },
          body: JSON.stringify(data),
        }),
      );

    // Use the fetchWithRetry utility
    return fetchWithRetry(apiCall, this.maxRetries, this.initialBackoffMs);
  }

  /**
   * Specialized method for sending balance data
   * @param data Array of balance records
   */
  async send(data: TimeWeightedBalanceEvent[] | TransactionEvent[]): Promise<void> {
    if (data.length === 0) return;

    if (data.length <= BATCH_SIZE) {
      await this.sendSingleBatch(data);
    } else {
      await this.sendMultipleBatches(data);
    }
  }
}
