import z from 'zod';
import { ProtocolType, PriceFeed } from './enums';

const tokenSchema = z.object({
  coingeckoId: z.string(),
  decimals: z.number(),
});

const envSchema = z.object({
  DB_URL: z.string().min(1, 'DB_URL is required'),
  RPC_URL_MAINNET: z.string().url('RPC_URL_MAINNET must be a valid URL').optional(),
  RPC_URL_BASE: z.string().url('RPC_URL_BASE must be a valid URL').optional(),
  RPC_URL_HEMI: z.string().url('RPC_URL_HEMI must be a valid URL').optional(),
  ABS_CONFIG: z.string(),
  RPC_URL_POLYGON: z.string().url('RPC_URL_POLYGON must be a valid URL').optional(),
  RPC_URL_ARBITRUM: z.string().url('RPC_URL_ARBITRUM must be a valid URL').optional(),
  RPC_URL_OPTIMISM: z.string().url('RPC_URL_OPTIMISM must be a valid URL').optional(),
  RPC_URL_SOLANA: z.string().url('RPC_URL_SOLANA must be a valid URL').optional(),
  RPC_URL_BSC: z.string().url('RPC_URL_BSC must be a valid URL').optional(),
  RPC_URL_AVALANCHE: z.string().url('RPC_URL_AVALANCHE must be a valid URL').optional(),
  ABSINTHE_API_URL: z.string().url('ABSINTHE_API_URL must be a valid URL'),
  ABSINTHE_API_KEY: z.string().min(1, 'ABSINTHE_API_KEY is required'),
  COINGECKO_API_KEY: z.string().min(1, 'COINGECKO_API_KEY is required'),
});

const protocolConfigSchema = z.object({
  name: z.string(),
  contractAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Contract address must be a valid Ethereum address'),
  fromBlock: z.number(),
  pricingStrategy: z.enum([PriceFeed.COINGECKO, PriceFeed.CODEX]),
  token0: tokenSchema,
  token1: tokenSchema,
  preferredTokenCoingeckoId: z.string(),
});

const dexProtocolSchema = z.object({
  type: z.enum([
    ProtocolType.UNISWAP_V2,
    ProtocolType.UNISWAP_V3,
    ProtocolType.COMPOUND,
    ProtocolType.AAVE,
    ProtocolType.CURVE,
    ProtocolType.BALANCER,
    ProtocolType.IZUMI,
  ]),
  chainId: z.number(),
  toBlock: z.number(),
  protocols: z.array(protocolConfigSchema),
});

const txnTrackingProtocolSchema = z.object({
  type: z.string(),
  name: z.string(),
  contractAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Contract address must be a valid Ethereum address'),
  factoryAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Factory address must be a valid Ethereum address')
    .optional(),
  chainId: z.number(),
  toBlock: z.number(),
  fromBlock: z.number(),
});

const stakingProtocolSchema = z.object({
  type: z.string(),
  name: z.string(),
  contractAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Contract address must be a valid Ethereum address'),
  chainId: z.number(),
  toBlock: z.number(),
  fromBlock: z.number(),
});

const univ3PoolSchema = z.object({
  name: z.string(),
  contractAddress: z.string(),
  fromBlock: z.number(),
});

const univ3ProtocolSchema = z.object({
  type: z.enum([ProtocolType.UNISWAP_V3]),
  chainId: z.number(),
  factoryAddress: z.string(),
  factoryDeployedAt: z.number(),
  positionsAddress: z.string(),
  toBlock: z.number(),
  pools: z.array(univ3PoolSchema),
});

const zebuClientSchema = z.object({
  name: z.string(),
  contractAddress: z.string(),
  chainId: z.number(),
  fromBlock: z.number(),
});

const zebuProtocolSchema = z.object({
  type: z.enum([ProtocolType.ZEBU]),
  name: z.string(),
  toBlock: z.number(),
  clients: z.array(zebuClientSchema),
});

const configSchema = z.object({
  balanceFlushIntervalHours: z.number(),
  dexProtocols: z.array(dexProtocolSchema),
  txnTrackingProtocols: z.array(txnTrackingProtocolSchema),
  stakingProtocols: z.array(stakingProtocolSchema),
  univ3Protocols: z.array(univ3ProtocolSchema),
  zebuProtocols: z.array(zebuProtocolSchema),
});

export { configSchema, dexProtocolSchema, protocolConfigSchema, envSchema };
