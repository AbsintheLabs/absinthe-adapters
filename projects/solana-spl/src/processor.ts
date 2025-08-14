import { DataSourceBuilder, Block, SolanaRpcClient } from '@subsquid/solana-stream';
import { validateEnv } from '@absinthe/common';

const env = validateEnv();
const protocols = env.solanaSplProtocols ?? [];

function buildTrackedTokensFromEnv(): Record<string, string> {
  try {
    const tokens: Record<string, string> = {};

    for (const p of protocols) {
      if (p.mintAddress && p.name) {
        tokens[p.name.toUpperCase()] = p.mintAddress;
      }
    }

    if (Object.keys(tokens).length > 0) {
      console.log(
        `Loaded ${Object.keys(tokens).length} tracking tokens from env:`,
        Object.keys(tokens),
      );
      return tokens;
    }
  } catch (error) {
    console.warn('Failed to load tokens from env:', error);
  }

  // No fallback tokens; require explicit config
  return {};
}

const TRACKED_TOKENS: Record<string, string> = buildTrackedTokensFromEnv();

function getGatewayFromEnv(): string {
  try {
    if (protocols.length > 0) {
      return protocols[0].gatewayUrl ?? 'https://v2.archive.subsquid.io/network/solana-mainnet';
    }
  } catch (_) {
    // ignore and return default
  }
  return 'https://v2.archive.subsquid.io/network/solana-mainnet';
}

export const dataSource = new DataSourceBuilder()
  .setGateway(getGatewayFromEnv())
  .setRpc({
    client: new SolanaRpcClient({ url: protocols[0].rpcUrl }),
  })
  .setFields({
    tokenBalance: {
      preOwner: true,
      postOwner: true,
      preMint: true,
      postMint: true,
      preAmount: true,
      postAmount: true,
    },
  })
  .addTokenBalance({
    where: {
      preMint: Object.values(TRACKED_TOKENS),
      postMint: Object.values(TRACKED_TOKENS),
    },
  })
  .build();

export type SolanaBlock = Block;
export type ProcessorContext<Store> = {
  store: Store;
  blocks: SolanaBlock[];
};

export { TRACKED_TOKENS };
