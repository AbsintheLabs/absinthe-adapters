import { Token } from './tokens';
import {
  TokenPreference,
  PriceFeed,
  Dex,
  Staking,
  BondingCurveProtocol,
  ChainName,
  ChainShortName,
  ChainType,
  ChainId,
} from '../enums';

interface BaseProtocolConfig {
  type: string;
  contractAddress: string;
  fromBlock: number;
  name?: string;
}

interface DexProtocolConfig {
  type: Dex;
  chainId: ChainId;
  chainArch: ChainType;
  chainShortName: ChainShortName;
  chainName: ChainName;
  gatewayUrl: string;
  rpcUrl: string;
  toBlock: number;
  protocols: ProtocolConfig[];
}

interface BondingCurveProtocolConfig {
  type: BondingCurveProtocol;
  name: string;
  contractAddress: string;
  chainId: number;
  chainArch: ChainType;
  chainShortName: ChainShortName;
  chainName: ChainName;
  gatewayUrl: string;
  toBlock: number;
  fromBlock: number;
  rpcUrl: string;
}

interface StakingProtocolConfig {
  type: Staking;
  chainId: ChainId;
  chainArch: ChainType;
  chainShortName: ChainShortName;
  chainName: ChainName;
  gatewayUrl: string;
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
  StakingProtocolConfig,
  Config,
};
