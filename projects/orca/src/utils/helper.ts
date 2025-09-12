import { PublicKey } from '@solana/web3.js';
import { logger } from '@absinthe/common';

async function getMintFromTokenAccount(
  tokenAccountAddress: string,
  connection: any,
): Promise<string | null> {
  const { getAccount } = await import('@solana/spl-token');

  try {
    const tokenAccount = await getAccount(connection, new PublicKey(tokenAccountAddress));
    return tokenAccount.mint.toString();
  } catch (error) {
    console.error('Failed to get mint from token account:', error);
    return null;
  }
}

export async function getTickPriceOffChain(whirlpoolAddress: string, slot: number): Promise<any> {
  const url = `http://18.189.19.77/proxy/${whirlpoolAddress}/slot/${slot}`;

  let attempt = 1;
  const maxRetryDelay = 30000; // 30 seconds max delay
  const baseDelay = 1000; // 1 second base delay

  while (true) {
    try {
      logger.info(
        ` [getTickPriceOffChain] Attempt ${attempt} for whirlpool ${whirlpoolAddress}, slot ${slot}`,
      );

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.message === 'success') {
        const { preSqrtPrice, postSqrtPrice } = data.tradedEvent;
        const sqrtPriceX64 = BigInt(postSqrtPrice);

        logger.info(
          `✅ [getTickPriceOffChain] Success on attempt ${attempt} for whirlpool ${whirlpoolAddress}, slot ${slot}`,
        );

        return {
          preSqrtPrice,
          postSqrtPrice,
          sqrtPriceX64,
        };
      }

      // If we get here, the response was successful but data.message !== 'success'
      throw new Error(`API returned unsuccessful response: ${JSON.stringify(data)}`);
    } catch (error) {
      logger.error(
        `❌ [getTickPriceOffChain] Attempt ${attempt} failed for whirlpool ${whirlpoolAddress}, slot ${slot}`,
        {
          error: error instanceof Error ? error.message : String(error),
          attempt,
          url,
        },
      );

      // Calculate exponential backoff delay with jitter
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000,
        maxRetryDelay,
      );

      logger.info(`⏳ [getTickPriceOffChain] Retrying in ${Math.round(delay)}ms...`);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      attempt++;
    }
  }
}

export { getMintFromTokenAccount };
