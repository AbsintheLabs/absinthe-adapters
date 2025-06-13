import { PoolConfig } from '../model';
import { ActiveBalance, ProtocolState } from '@absinthe/common';
import { PoolProcessState } from '../model';
import { PoolState } from '../model';

interface ProtocolStateUniv2 extends ProtocolState {
  config: PoolConfig;
  state: PoolState;
  processState: PoolProcessState;
  activeBalances: Map<string, ActiveBalance>;
}

export { ProtocolStateUniv2 };
