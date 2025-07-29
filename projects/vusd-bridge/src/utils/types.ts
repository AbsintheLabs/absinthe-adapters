import { ActiveBalance, ProtocolState } from '@absinthe/common';
import { PoolProcessState } from '../model/index';

type ActiveBalancesHemi = Map<string, Map<string, ActiveBalance>>;

interface ProtocolStateHemi extends ProtocolState {
  processState: PoolProcessState;
  activeBalances: ActiveBalancesHemi;
}

interface TokenMetadata {
  address: string;
  symbol: string;
  decimals: number;
  coingeckoId: string;
}

export { ProtocolStateHemi, ActiveBalancesHemi, TokenMetadata };
