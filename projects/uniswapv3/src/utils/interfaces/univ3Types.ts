import { HistoryWindow, Transaction } from '@absinthe/common';
import { DataHandlerContext } from '@subsquid/evm-processor';
import { EntityManager } from '../entityManager';
import { Store } from '@subsquid/typeorm-store';

interface ProtocolStateUniswapV3 {
  balanceWindows: HistoryWindow[];
  transactions: Transaction[];
}
type ContextWithEntityManager = DataHandlerContext<Store> & {
  entities: EntityManager;
};

interface PositionData {
  positionId: string;
  owner: string;
  liquidity: string;
  tickLower: number;
  tickUpper: number;
  token0Id: string;
  token1Id: string;
  fee: number;
  depositedToken0: string;
  depositedToken1: string;
  isActive: string;
  lastUpdatedBlockTs: number;
  lastUpdatedBlockHeight: number;
  poolId: string;
}

interface PairCreatedData {
  poolId: string;
  token0Id: string;
  token1Id: string;
  fee: number;
}

interface Token {
  id: string;
  symbol: string;
  name: string;
  totalSupply: bigint;
  decimals: number;
}

export { ProtocolStateUniswapV3, PositionData, ContextWithEntityManager, PairCreatedData, Token };
