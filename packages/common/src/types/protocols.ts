import { Token } from "./tokens";

// Base protocol configuration
export interface BaseProtocolConfig {
    type: string;
    contractAddress: string;
    fromBlock: number;
    name?: string; 
}

// Protocol-specific configurations
export interface UniswapV2Config extends BaseProtocolConfig {
    type: 'uniswap-v2';
    token0: Token;
    token1: Token;
    preferredTokenCoingeckoId: 'token0' | 'token1';
    pricingStrategy: string;
}

export interface UniswapV3Config extends BaseProtocolConfig {
    type: 'uniswap-v3';
    token0: Token;
    token1: Token;
    fee: number; // Fee tier (500, 3000, 10000)
    preferredTokenCoingeckoId: 'token0' | 'token1';
}

export interface CompoundConfig extends BaseProtocolConfig {
    type: 'compound';
    underlyingToken: Token;
    cToken: Token;
    version: 'v2' | 'v3';
}

export interface AaveConfig extends BaseProtocolConfig {
    type: 'aave';
    underlyingToken: Token;
    aToken: Token;
    version: 'v2' | 'v3';
}

export interface CurveConfig extends BaseProtocolConfig {
    type: 'curve';
    tokens: Token[];
    poolType: 'stable' | 'crypto';
}

export interface BalancerConfig extends BaseProtocolConfig {
    type: 'balancer';
    tokens: Token[];
    poolType: 'weighted' | 'stable';
    weights?: number[]; // For weighted pools
}

// Union type for all protocol configurations
export type ProtocolConfig = 
    | UniswapV2Config 
    | UniswapV3Config 
    | CompoundConfig 
    | AaveConfig 
    | CurveConfig 
    | BalancerConfig;
