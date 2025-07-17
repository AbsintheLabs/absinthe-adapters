// Fetch with retries and exponential backoff
export async function fetchWithRetry(
  apiCall: () => Promise<Response>,
  initialBackoffMs = 1000,
): Promise<Response> {
  let backoffMs = initialBackoffMs;
  let attemptCount = 0;

  while (true) {
    attemptCount++;
    console.log(` API call attempt #${attemptCount} starting...`);

    try {
      const response = await apiCall();
      console.log(`📡 API response status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        console.log(`✅ API call successful on attempt #${attemptCount}`);
        return response;
      }

      console.log(`❌ API call failed with status ${response.status}, will retry...`);
      // Continue retrying for non-ok responses
    } catch (error) {
      console.log(`💥 API call error on attempt #${attemptCount}:`, error);
      // Continue retrying for errors
    }

    const jitter = Math.random() * 0.3 + 0.85;
    const waitTime = Math.floor(backoffMs * jitter);

    console.log(
      `⏳ Waiting ${waitTime}ms before retry #${attemptCount + 1} (backoff: ${backoffMs}ms, jitter: ${jitter.toFixed(2)})`,
    );
    await new Promise((r) => setTimeout(r, waitTime));

    backoffMs *= 2;
    console.log(`📈 Next backoff will be: ${backoffMs}ms`);
  }
}
