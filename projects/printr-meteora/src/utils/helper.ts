import { PublicKey } from '@solana/web3.js';
import { TOKEN_MINT_DETAILS } from './consts';

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

async function getOwnerFromTokenAccount(
  tokenAccountAddress: string,
  connection: any,
): Promise<string | null> {
  const { getAccount } = await import('@solana/spl-token');
  const tokenAccount = await getAccount(connection, new PublicKey(tokenAccountAddress));
  return tokenAccount.owner.toBase58();
}

function fetchCoingeckoIdFromTokenMint(mintAddress: string): {
  coingeckoId: string;
  decimals: number;
} {
  const tokenDetails = TOKEN_MINT_DETAILS.find(
    (t) => t.mintAddress.toLowerCase() === mintAddress.toLowerCase(),
  );
  return {
    coingeckoId: tokenDetails?.coingeckoId ?? '',
    decimals: tokenDetails?.decimals ?? 0,
  };
}

export { getMintFromTokenAccount, fetchCoingeckoIdFromTokenMint, getOwnerFromTokenAccount };
