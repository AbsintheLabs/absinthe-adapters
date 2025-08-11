import {
  TokenPreference,
  PriceFeed,
  ProtocolType,
  BondingCurveProtocol,
  ChainName,
  ChainShortName,
  ChainType,
  ChainId,
  StakingProtocol,
  GatewayUrl,
} from '../enums';
import { ValidatedEnvBase } from './interfaces';

interface Token {
  coingeckoId: string;
  decimals: number;
  address: string;
  symbol: string;
}

interface SimpleToken {
  symbol: string;
  decimals: number;
}

interface BaseProtocolConfig {
  type: ProtocolType | BondingCurveProtocol | StakingProtocol;
  contractAddress: string;
  fromBlock: number;
  name?: string;
}

interface BaseProtocolConfigWithChain {
  chainId: ChainId;
  chainArch: ChainType;
  chainShortName: ChainShortName;
  chainName: ChainName;
  rpcUrl: string;
  gatewayUrl: GatewayUrl;
}

interface DexProtocolConfig {
  type: ProtocolType;
  toBlock: number;
  protocols: ProtocolConfig[];
}

interface BondingCurveProtocolConfig {
  type: BondingCurveProtocol;
  name: string;
  contractAddress: string;
  factoryAddress?: string;
  toBlock: number;
  fromBlock: number;
}

interface StakingProtocolConfig {
  type: StakingProtocol;
  name: string;
  contractAddress: string;
  toBlock: number;
  fromBlock: number;
}

interface ZebuClientConfig {
  name: string;
  contractAddress: string;
  chainId: ChainId;
  fromBlock: number;
}

interface ZebuProtocolConfig {
  type: ProtocolType;
  name: string;
  toBlock: number;
  clients: ZebuClientConfig[];
}

interface Univ3PoolConfig {
  name: string;
  contractAddress: string;
  fromBlock: number;
}

interface Univ3ProtocolConfig {
  type: ProtocolType;
  chainId: ChainId;
  factoryAddress: string;
  factoryDeployedAt: number;
  positionsAddress: string;
  toBlock: number;
  pools: Univ3PoolConfig[];
}

interface ProtocolConfig {
  type: string;
  name: string;
  contractAddress: string;
  fromBlock: number;
  pricingStrategy: PriceFeed;
  token0: Token;
  token1: Token;
  preferredTokenCoingeckoId: TokenPreference;
}

interface ZebuClientConfigWithChain extends ZebuClientConfig {
  chainArch: ChainType;
  chainShortName: ChainShortName;
  chainName: ChainName;
  rpcUrl: string;
  gatewayUrl: GatewayUrl;
}

interface ValidatedDexProtocolConfig extends DexProtocolConfig, BaseProtocolConfigWithChain {}
interface ValidatedBondingCurveProtocolConfig
  extends BondingCurveProtocolConfig,
    BaseProtocolConfigWithChain {}
interface ValidatedStakingProtocolConfig
  extends StakingProtocolConfig,
    BaseProtocolConfigWithChain {}

interface ZebuProtocolConfigWithChain extends ZebuProtocolConfig {
  clients: ZebuClientConfigWithChain[];
}

interface ValidatedUniv3ProtocolConfig extends Univ3ProtocolConfig, BaseProtocolConfigWithChain {}
interface ValidatedZebuProtocolConfig {
  type: ProtocolType;
  name: string;
  toBlock: number;
  clients: ZebuClientConfigWithChain[];
}

interface SolanaSplProtocolConfig {
  type: ProtocolType;
  name: string;
  mintAddress: string; // (base58)
  fromBlock: number;
  contractAddress?: string; // reuse common shape, set as mint address
}

interface ValidatedSolanaSplProtocolConfig
  extends SolanaSplProtocolConfig,
    BaseProtocolConfigWithChain {
  token: { coingeckoId: string; decimals: number; symbol?: string };
}

interface ValidatedEnv {
  baseConfig: ValidatedEnvBase;
  dexProtocols: ValidatedDexProtocolConfig[];
  bondingCurveProtocols: ValidatedBondingCurveProtocolConfig[];
  stakingProtocols: ValidatedStakingProtocolConfig[];
  univ3Protocols: ValidatedUniv3ProtocolConfig[];
  zebuProtocols: ValidatedZebuProtocolConfig[];
  solanaSplProtocols?: ValidatedSolanaSplProtocolConfig[];
}

interface HelperProtocolConfig extends Univ3PoolConfig {
  type: ProtocolType;
}

export {
  ProtocolConfig,
  BaseProtocolConfig,
  DexProtocolConfig,
  BondingCurveProtocolConfig,
  StakingProtocolConfig,
  ValidatedEnv,
  ValidatedDexProtocolConfig,
  ValidatedBondingCurveProtocolConfig,
  ValidatedStakingProtocolConfig,
  ValidatedUniv3ProtocolConfig,
  Token,
  Univ3PoolConfig,
  Univ3ProtocolConfig,
  BaseProtocolConfigWithChain,
  HelperProtocolConfig,
  ZebuClientConfig,
  ZebuProtocolConfig,
  ZebuClientConfigWithChain,
  ZebuProtocolConfigWithChain,
  ValidatedZebuProtocolConfig,
  SolanaSplProtocolConfig,
  ValidatedSolanaSplProtocolConfig,
};
