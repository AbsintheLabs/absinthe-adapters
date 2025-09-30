// LP (Liquidity Position) handler for Uniswap V2
import Big from 'big.js';
import { UnifiedEvmLog } from '../../src/types/unified-chain-events.ts';
import { EmitFunctions } from '../../src/types/adapter.ts';
import * as univ2Abi from './abi/uniswap-v2.ts';

export async function handleLpTransfer(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  poolAddress: string,
): Promise<void> {
  const decoded = univ2Abi.events.Transfer.decode({
    topics: log.topics,
    data: log.data,
  });

  // Emit balance deltas for LP token transfers
  await emitFns.position.balanceDelta({
    user: decoded.from.toLowerCase(),
    asset: poolAddress,
    amount: new Big(decoded.value.toString()).neg(),
    activity: 'hold',
  });

  await emitFns.position.balanceDelta({
    user: decoded.to.toLowerCase(),
    asset: poolAddress,
    amount: new Big(decoded.value.toString()),
    activity: 'hold',
  });
}
