import { ActiveBalance, ProtocolState } from '@absinthe/common';
import { PoolProcessState } from '../model';

type ActiveBalancesHemi = Map<string, Map<string, ActiveBalance>>;

interface ProtocolStateHemi extends ProtocolState {
  processState: PoolProcessState;
  activeBalances: ActiveBalancesHemi;
}

export { ProtocolStateHemi, ActiveBalancesHemi };
