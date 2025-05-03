import Bottleneck from 'bottleneck';

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

export class ApiClient {
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

        console.log(`Preparing to send data to ${endpoint}...`);

        // Convert any BigInt values to strings
        const serializedData = convertBigIntToString(data);

        let success = false;
        let retryCount = 0;
        let backoffMs = this.initialBackoffMs;
        let response: Response | null = null;

        while (!success && retryCount < this.maxRetries) {
            try {
                response = await this.limiter.schedule(() =>
                    fetch(`${this.baseUrl}/${endpoint.replace(/^\//, '')}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-api-key': this.apiKey,
                        },
                        body: JSON.stringify(serializedData),
                    })
                );

                if (response.ok) {
                    console.log(`Successfully sent data to ${endpoint}`);
                    success = true;
                } else {
                    retryCount++;
                    console.log(`API returned error status ${response.status}. Retry ${retryCount}/${this.maxRetries}`);

                    if (retryCount >= this.maxRetries) {
                        console.error(`Failed to send data to API after ${this.maxRetries} retries`);
                        return response;
                    }

                    // Wait before next retry with exponential backoff
                    const waitTime = backoffMs * (1 + Math.random() * 0.2); // Add some jitter
                    console.log(`Waiting ${Math.round(waitTime)}ms before retry ${retryCount + 1}...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    backoffMs *= 2; // Double the backoff time for next retry
                }
            } catch (error) {
                retryCount++;
                console.error("Error sending data to API:", error);

                if (retryCount >= this.maxRetries) {
                    console.error(`Failed to send data to API after ${this.maxRetries} retries`);
                    throw error;
                }

                // Wait before next retry with exponential backoff
                const waitTime = backoffMs * (1 + Math.random() * 0.2); // Add some jitter
                console.log(`Waiting ${Math.round(waitTime)}ms before retry ${retryCount + 1}...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                backoffMs *= 2; // Double the backoff time for next retry
            }
        }

        return response!;
    }

    /**
     * Specialized method for sending balance data
     * @param balances Array of balance records
     */
    async sendBalances(balances: any[]): Promise<void> {
        if (balances.length === 0) {
            console.log("No balances to send");
            return;
        }

        console.log(`Sending ${balances.length} balance records to API...`);

        // Copy balances to ensure data isn't lost if there's an error
        const balancesCopy = [...balances];

        const response = await this.sendData('api/log', { balances: balancesCopy });

        if (!response.ok) {
            throw new Error(`Failed to send balances: ${response.status} ${response.statusText}`);
        }
    }
}