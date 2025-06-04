import { PoolConfig } from "../model";
import { ActiveBalance, TimeWeightedBalanceEvent, TransactionEvent } from "@absinthe/common";
import { PoolProcessState } from "../model";
import { PoolState } from "../model";

interface ProtocolState {
    config: PoolConfig;
    state: PoolState;
    processState: PoolProcessState;
    activeBalances: Map<string, ActiveBalance>;
    balanceWindows: TimeWeightedBalanceEvent[];
    transactions: TransactionEvent[];
  }
  
  interface BatchContext {
    ctx: any;
    block: any;
    protocolStates: Map<string, ProtocolState>;
  }


export { ProtocolState, BatchContext };