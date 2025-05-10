// export function convertBigIntToString(obj: any): any {
//     if (obj === null || obj === undefined) {
//         return obj;
//     }
//     if (typeof obj === 'bigint') {
//         return obj.toString();
//     }
//     if (Array.isArray(obj)) {
//         return obj.map(convertBigIntToString);
//     }
//     if (typeof obj === 'object') {
//         const result: any = {};
//         for (const key in obj) {
//             result[key] = convertBigIntToString(obj[key]);
//         }
//         return result;
//     }
//     return obj;
// }

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