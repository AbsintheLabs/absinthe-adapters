import z from 'zod';
import { ProtocolType, PriceFeed } from './enums';

const tokenSchema = z.object({
  coingeckoId: z.string(),
  decimals: z.number(),
});

const simpleTokenSchema = z.object({
  symbol: z.string(),
  decimals: z.number(),
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

const bondingCurveProtocolSchema = z.object({
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
  feeTier: z.number(),
  pricingStrategy: z.enum([PriceFeed.COINGECKO, PriceFeed.CODEX, PriceFeed.INTERNAL_TWAP]),
  token0: simpleTokenSchema,
  token1: simpleTokenSchema,
  preferredTokenCoingeckoId: z.string(),
});

const univ3ProtocolSchema = z.object({
  type: z.enum([ProtocolType.UNISWAP_V3]),
  chainId: z.number(),
  factoryAddress: z.string(),
  factoryDeployedAt: z.number(),
  positionsAddress: z.string(),
  toBlock: z.number(),
  poolDiscovery: z.boolean(),
  trackPositions: z.boolean(),
  trackSwaps: z.boolean(),
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
  bondingCurveProtocols: z.array(bondingCurveProtocolSchema),
  stakingProtocols: z.array(stakingProtocolSchema),
  univ3Protocols: z.array(univ3ProtocolSchema),
  zebuProtocols: z.array(zebuProtocolSchema),
});

export { configSchema, dexProtocolSchema, protocolConfigSchema };
