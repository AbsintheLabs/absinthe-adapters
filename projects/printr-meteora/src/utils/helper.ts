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

  try {
    const tokenAccount = await getAccount(connection, new PublicKey(tokenAccountAddress));
    return tokenAccount ? tokenAccount.owner.toBase58() : null;
  } catch (error) {
    console.error('Failed to get owner from token account:', error);
    return null;
  }
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

async function toBuffer(maybe: any): Promise<Buffer> {
  const bs58 = await import('bs58');
  if (!maybe) return Buffer.alloc(0);

  // Already bytes?
  if (Buffer.isBuffer(maybe)) return maybe as Buffer;
  if (maybe?.type === 'Buffer' && Array.isArray(maybe.data)) {
    return Buffer.from(maybe.data);
  }
  if (maybe instanceof Uint8Array) return Buffer.from(maybe);

  if (typeof maybe === 'string') {
    const s = maybe.trim();

    // hex: 0x... or pure hex
    if (s.startsWith('0x')) return Buffer.from(s.slice(2), 'hex');
    if (/^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0) {
      return Buffer.from(s, 'hex');
    }

    // base64: crude but effective check
    if (/^[A-Za-z0-9+/=]+$/.test(s) && s.length % 4 === 0) {
      try {
        return Buffer.from(s, 'base64');
      } catch {}
    }

    // fall back to base58 (Solana default encoding for ix.data)
    try {
      return Buffer.from(bs58.default.decode(s));
    } catch {}
  }

  return Buffer.alloc(0);
}

export {
  getMintFromTokenAccount,
  fetchCoingeckoIdFromTokenMint,
  getOwnerFromTokenAccount,
  toBuffer,
};
