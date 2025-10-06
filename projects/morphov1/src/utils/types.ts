import { ActiveBalance, ProtocolState } from '@absinthe/common';
import { PoolProcessState } from '../model';

type ActiveBalancesMorpho = Map<string, Map<string, ActiveBalance>>;

interface ProtocolStateMorpho extends ProtocolState {
  processState: PoolProcessState;
  activeBalances: ActiveBalancesMorpho;
  marketData: Map<string, MarketData>;
}

interface TokenMetadata {
  address: string;
  decimals: number;
  coingeckoId: string;
}

interface MarketData {
  loanToken: string;
  collateralToken: string;
  oracle: string;
  irm: string;
  lltv: bigint;
}

interface UserPosition {
  supplyShares: bigint;
  borrowShares: bigint;
  collateral: bigint;
}

// Type definitions
interface MarketDataType {
  loanToken: string;
  collateralToken: string;
  oracle: string;
  irm: string;
  lltv: bigint;
}

interface MarketIndexes {
  supplyIndex: bigint; // 1e18-scaled
  borrowIndex: bigint; // 1e18-scaled
}

export {
  ProtocolStateMorpho,
  ActiveBalancesMorpho,
  TokenMetadata,
  MarketData,
  UserPosition,
  MarketDataType,
  MarketIndexes,
};
