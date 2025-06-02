import { Token } from "./tokens";
import { ProtocolVersion, TokenPreference, Dex } from "../enums";

interface BaseProtocolConfig {
    type: string;
    contractAddress: string;
    fromBlock: number;
    name?: string; 
}

// Protocol-specific configurations
interface UniswapV2Config extends BaseProtocolConfig {
    type: Dex.UNISWAP_V2;
    token0: Token;
    token1: Token;
    preferredTokenCoingeckoId: TokenPreference;
    pricingStrategy: string;
}

interface UniswapV3Config extends BaseProtocolConfig {
    type: Dex.UNISWAP_V3;
    token0: Token;
    token1: Token;
    fee: number; // Fee tier (500, 3000, 10000)
    preferredTokenCoingeckoId: TokenPreference;
}

interface CompoundConfig extends BaseProtocolConfig {
    type: Dex.COMPOUND;
    underlyingToken: Token;
    cToken: Token;
    version: ProtocolVersion;
}

interface AaveConfig extends BaseProtocolConfig {
    type: Dex.AAVE;
    underlyingToken: Token;
    aToken: Token;
    version: ProtocolVersion;
}

interface CurveConfig extends BaseProtocolConfig {
    type: Dex.CURVE;
    tokens: Token[];
    poolType: 'stable' | 'crypto';
}

interface BalancerConfig extends BaseProtocolConfig {
    type: Dex.BALANCER;
    tokens: Token[];
    poolType: 'weighted' | 'stable';
    weights?: number[]; // For weighted pools
}

// Union type for all protocol configurations
type ProtocolConfig = 
    | UniswapV2Config 
    | UniswapV3Config 
    | CompoundConfig 
    | AaveConfig 
    | CurveConfig 
    | BalancerConfig;



export { ProtocolConfig, BaseProtocolConfig, UniswapV2Config, UniswapV3Config, CompoundConfig, AaveConfig, CurveConfig, BalancerConfig };