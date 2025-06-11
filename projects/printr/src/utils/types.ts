import { Transaction } from '@absinthe/common';

interface ProtocolState {
  // config: PoolConfig;
  // state: PoolState;
  // processState: PoolProcessState;
  // activeBalances: Map<string, ActiveBalance>;
  // balanceWindows: HistoryWindow[];
  transactions: Transaction[];
}

interface BatchContext {
  ctx: any;
  block: any;
  protocolStates: Map<string, ProtocolState>;
}

interface ProcessValueChangeParams {
  from: string;
  to: string;
  amount: bigint;
  lpTokenSwapUsdValue: number;
  blockTimestamp: number;
  blockHeight: number;
  txHash: string;
  activeBalances: Map<
    string,
    { balance: bigint; updatedBlockTs: number; updatedBlockHeight: number }
  >;
  windowDurationMs: number;
  lpTokenPrice: number;
  lpTokenDecimals: number;
}

export { ProtocolState, BatchContext, ProcessValueChangeParams };
