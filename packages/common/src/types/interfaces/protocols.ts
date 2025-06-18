import { Token } from './tokens';
import {
  TokenPreference,
  PriceFeed,
  Dex,
  BondingCurveProtocol,
  ChainName,
  ChainShortName,
  ChainType,
  ChainId,
  StakingProtocol,
  GatewayUrl,
} from '../enums';

interface BaseProtocolConfig {
  type: string;
  contractAddress: string;
  fromBlock: number;
  name?: string;
}

interface DexProtocolConfig {
  type: Dex;
  gatewayUrl: GatewayUrl;
  chainId: ChainId;
  chainArch: ChainType;
  chainShortName: ChainShortName;
  chainName: ChainName;
  rpcUrl: string;
  toBlock: number;
  protocols: ProtocolConfig[];
}

interface BondingCurveProtocolConfig {
  type: BondingCurveProtocol;
  name: string;
  contractAddress: string;
  chainId: number;
  gatewayUrl: GatewayUrl;
  chainArch: ChainType;
  chainShortName: ChainShortName;
  chainName: ChainName;
  toBlock: number;
  fromBlock: number;
  rpcUrl: string;
}

interface StakingProtocolConfig {
  type: StakingProtocol;
  name: string;
  contractAddress: string;
  chainId: number;
  gatewayUrl: GatewayUrl;
  chainArch: ChainType;
  chainShortName: ChainShortName;
  chainName: ChainName;
  toBlock: number;
  fromBlock: number;
  rpcUrl: string;
}

interface ProtocolConfig {
  name: string;
  contractAddress: string;
  fromBlock: number;
  pricingStrategy: PriceFeed;
  token0: Token;
  token1: Token;
  preferredTokenCoingeckoId: TokenPreference;
}

interface Config {
  balanceFlushIntervalHours: number;
  dexProtocols: DexProtocolConfig[];
  bondingCurveProtocols: BondingCurveProtocolConfig[];
  stakingProtocols: StakingProtocolConfig[];
}

export {
  ProtocolConfig,
  BaseProtocolConfig,
  DexProtocolConfig,
  BondingCurveProtocolConfig,
  Config,
  StakingProtocolConfig,
};
