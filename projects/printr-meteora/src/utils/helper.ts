import { PublicKey } from '@solana/web3.js';
import { TOKEN_MINT_DETAILS } from './consts';
import {
  Chain,
  HelperProtocolConfig,
  MessageType,
  ProtocolConfig,
  ProtocolType,
  Transaction,
  TransactionEvent,
  ValidatedEnvBase,
  ValidatedStakingProtocolConfig,
  ValidatedTxnTrackingProtocolConfig,
  ZebuClientConfigWithChain,
} from '@absinthe/common';
import { validateEnv } from './validateEnv';
import { createHash } from 'crypto';

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

function toTransaction(
  transactions: Transaction[],
  protocol:
    | ProtocolConfig
    | ValidatedTxnTrackingProtocolConfig
    | ValidatedStakingProtocolConfig
    | HelperProtocolConfig
    | (ZebuClientConfigWithChain & { type: ProtocolType }),
  env: ValidatedEnvBase,
  chainConfig: Chain,
): TransactionEvent[] {
  const validatedEnv = validateEnv();
  return transactions.map((e) => {
    const hashMessage = `${chainConfig.networkId}-${e.txHash}-${e.userId}-${e.logIndex}-${env.absintheApiKey}-${validatedEnv.version}`;
    const hash = createHash('md5').update(hashMessage).digest('hex').slice(0, 8);

    const apiKeyHash = createHash('md5').update(env.absintheApiKey).digest('hex').slice(0, 8);
    const baseSchema = {
      version: validatedEnv.version,
      eventId: hash,
      userId: e.userId,
      chain: chainConfig,
      contractAddress: protocol.contractAddress.toLowerCase(),
      protocolName: protocol.name.toLowerCase(),
      protocolType: protocol.type.toLowerCase(),
      runner: {
        runnerId: 'uniswapv2_indexer_001', //todo: get the current PID/ docker-containerId
        apiKeyHash,
      },
      protocolMetadata: e.tokens,
      currency: e.currency,
      valueUsd: e.valueUsd ?? 0.0,
    };

    const currentTime = Date.now();

    return {
      base: baseSchema,
      eventType: MessageType.TRANSACTION,
      indexedTimeMs: currentTime,
      eventName: e.eventName,
      rawAmount: e.rawAmount,
      displayAmount: e.displayAmount ?? 0.0,
      unixTimestampMs: e.unixTimestampMs,
      txHash: e.txHash,
      logIndex: e.logIndex,
      blockNumber: e.blockNumber,
      blockHash: e.blockHash,
      gasUsed: e.gasUsed ?? 0.0,
      gasFeeUsd: e.gasFeeUsd ?? 0.0,
    };
  });
}

export {
  getMintFromTokenAccount,
  fetchCoingeckoIdFromTokenMint,
  getOwnerFromTokenAccount,
  toBuffer,
  toTransaction,
};
