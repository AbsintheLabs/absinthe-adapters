// Fetch with retries and exponential backoff
export async function fetchWithRetry(
    apiCall: () => Promise<Response>,
    maxRetries = 5,
    initialBackoffMs = 1000
): Promise<Response> {
    let retries = 0;
    let backoffMs = initialBackoffMs;

    while (true) {
        try {
            const response = await apiCall();
            console.log("Response from API", response);
            if (response.ok) {
                return response;
            }
            if (retries >= maxRetries) {
                return response;
            }
        } catch (error) {
            if (retries >= maxRetries) {
                throw error;
            }
        }
        const jitter = Math.random() * 0.3 + 0.85;
        const waitTime = Math.floor(backoffMs * jitter);
        await new Promise(r => setTimeout(r, waitTime));
        backoffMs *= 2;
        retries++;
    }
}