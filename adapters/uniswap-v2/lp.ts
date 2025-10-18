// LP (Liquidity Position) handler for Uniswap V2
import Big from 'big.js';
import { UnifiedEvmLog } from '../_shared/index.ts';
import { EmitFunctions } from '../_shared/index.ts';
import * as univ2Abi from './abi/uniswap-v2.ts';
import type { InstanceFrom } from '../_shared/index.ts';
import type { manifest } from './index.ts';

export async function handleLpTransfer(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  instance: InstanceFrom<typeof manifest.trackables.lp>,
  poolAddress: string,
): Promise<void> {
  const decoded = univ2Abi.events.Transfer.decode({
    topics: log.topics,
    data: log.data,
  });

  // Emit balance deltas for LP token transfers
  await emitFns.position.balanceDelta({
    user: decoded.from.toLowerCase(),
    asset: { type: 'erc20', address: poolAddress },
    amount: -decoded.value,
    activity: 'hold',
    trackableInstance: instance,
  });

  await emitFns.position.balanceDelta({
    user: decoded.to.toLowerCase(),
    asset: { type: 'erc20', address: poolAddress },
    amount: decoded.value,
    activity: 'hold',
    trackableInstance: instance,
  });
}
