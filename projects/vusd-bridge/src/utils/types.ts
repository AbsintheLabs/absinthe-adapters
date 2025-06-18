import { ActiveBalance, ProtocolState } from '@absinthe/common';
import { PoolProcessState } from '../model/index';

type ActiveBalancesHemi = Map<string, Map<string, ActiveBalance>>;

interface ProtocolStateHemi extends ProtocolState {
  processState: PoolProcessState;
  activeBalances: ActiveBalancesHemi;
}

export { ProtocolStateHemi, ActiveBalancesHemi };
