import z from 'zod';
import { Dex, PriceFeed, Staking } from './enums';

const tokenSchema = z.object({
  coingeckoId: z.string(),
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
  type: z.enum([Dex.UNISWAP_V2, Dex.UNISWAP_V3, Dex.COMPOUND, Dex.AAVE, Dex.CURVE, Dex.BALANCER]),
  chainId: z.number(),
  gatewayUrl: z.string().url('Gateway URL must be a valid URL'),
  toBlock: z.number(),
  protocols: z.array(protocolConfigSchema),
});

const stakingProtocolSchema = z.object({
  type: z.enum([Staking.HEMI]),
  name: z.string(),
  contractAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Contract address must be a valid address'),
  chainId: z.number(),
  gatewayUrl: z.string().url('Gateway URL must be a valid URL'),
  toBlock: z.number(),
  fromBlock: z.number(),
});

const bondingCurveProtocolSchema = z.object({
  type: z.string(),
  name: z.string(),
  contractAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Contract address must be a valid Ethereum address'),
  chainId: z.number(),
  gatewayUrl: z.string().url('Gateway URL must be a valid URL'),
  toBlock: z.number(),
  fromBlock: z.number(),
});

const configSchema = z.object({
  balanceFlushIntervalHours: z.number(),
  dexProtocols: z.array(dexProtocolSchema),
  bondingCurveProtocols: z.array(bondingCurveProtocolSchema),
  stakingProtocols: z.array(stakingProtocolSchema),
});

export { configSchema, dexProtocolSchema, protocolConfigSchema, stakingProtocolSchema };
