import {
  ActiveBalance,
  GatewayUrl,
  ChainType,
  ChainId,
  ChainName,
  ChainShortName,
  ProtocolState,
  ValidatedEnvBase,
  ProtocolType,
} from '@absinthe/common';
import { PoolProcessState } from '../model';

type ActiveBalancesHemi = Map<string, Map<string, ActiveBalance>>;

interface HemiStakingProtocol {
  type: ProtocolType;
  chainId: ChainId;
  chainShortName: ChainShortName;
  chainName: ChainName;
  chainArch: ChainType;
  gatewayUrl: GatewayUrl;
  rpcUrl: string;
  toBlock: number;
  fromBlock: number;
  name: string;
  contractAddress: string;
}

interface ValidatedEnv {
  baseConfig: ValidatedEnvBase;
  hemiStakingProtocol: HemiStakingProtocol;
}
interface ProtocolStateHemi extends ProtocolState {
  processState: PoolProcessState;
  activeBalances: ActiveBalancesHemi;
}

interface TokenMetadata {
  address: string;
  decimals: number;
  coingeckoId: string;
}

export { ProtocolStateHemi, ActiveBalancesHemi, TokenMetadata, ValidatedEnv, HemiStakingProtocol };
