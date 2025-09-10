import { PublicKey } from '@solana/web3.js';

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

export { getMintFromTokenAccount };
