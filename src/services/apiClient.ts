import Bottleneck from 'bottleneck';
import { TimeWeightedBalance } from '../interfaces';
import { fetchWithRetry } from '../utils/fetchWithRetry';

// Helper function to convert BigInt values to strings for JSON serialization
export const convertBigIntToString = (obj: any): any => {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === 'bigint') {
        return obj.toString();
    }

    if (Array.isArray(obj)) {
        return obj.map(convertBigIntToString);
    }

    if (typeof obj === 'object') {
        const result: any = {};
        for (const key in obj) {
            result[key] = convertBigIntToString(obj[key]);
        }
        return result;
    }

    return obj;
};

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
        minTime = 110
    }: {
        baseUrl: string,
        apiKey: string,
        maxRetries?: number,
        initialBackoffMs?: number,
        maxConcurrent?: number,
        minTime?: number
    }) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.maxRetries = maxRetries;
        this.initialBackoffMs = initialBackoffMs;
        this.limiter = new Bottleneck({
            maxConcurrent,
            minTime, // space out the calls to avoid rate limits
        });
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

        // Convert any BigInt values to strings
        const serializedData = convertBigIntToString(data);

        // Create a function for the API call that will be retried
        const apiCall = () => this.limiter.schedule(() =>
            fetch(`${this.baseUrl}/${endpoint.replace(/^\//, '')}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                },
                body: JSON.stringify(serializedData),
            })
        );

        // Use the fetchWithRetry utility
        return fetchWithRetry(apiCall, this.maxRetries, this.initialBackoffMs);
    }

    /**
     * Specialized method for sending balance data
     * @param balances Array of balance records
     */
    async sendBalances(balances: TimeWeightedBalance[]): Promise<void> {
        if (balances.length === 0) return;

        const BATCH_SIZE = 100;

        // Split into batches
        if (balances.length <= BATCH_SIZE) {
            // Send in a single batch
            console.log(`Sending ${balances.length} balance records to API...`);
            const response = await this.sendData('api/log', { balances });

            if (!response.ok) {
                throw new Error(`Failed to send balances: ${response.status} ${response.statusText}`);
            }
        } else {
            // Split into multiple batches
            const batchCount = Math.ceil(balances.length / BATCH_SIZE);
            console.log(`Splitting ${balances.length} balance records into ${batchCount} batches...`);

            for (let i = 0; i < balances.length; i += BATCH_SIZE) {
                const batch = balances.slice(i, i + BATCH_SIZE);
                console.log(`Sending batch ${Math.floor(i / BATCH_SIZE) + 1}/${batchCount} with ${batch.length} balance records...`);

                const response = await this.sendData('api/log', { balances: batch });

                if (!response.ok) {
                    throw new Error(`Failed to send balances batch ${Math.floor(i / BATCH_SIZE) + 1}/${batchCount}: ${response.status} ${response.statusText}`);
                }
            }

            console.log(`Successfully sent all ${batchCount} batches of balance records.`);
        }
    }
}