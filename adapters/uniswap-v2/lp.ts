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

  const fromAddress = decoded.from.toLowerCase();
  const toAddress = decoded.to.toLowerCase();
  const zeroAddress = '0x0000000000000000000000000000000000000000';

  // Only emit if from/to are not zero address and not the pool address
  if (fromAddress !== zeroAddress && fromAddress !== poolAddress.toLowerCase()) {
    await emitFns.position.balanceDelta({
      user: fromAddress,
      asset: { type: 'erc20', address: poolAddress },
      amount: -decoded.value,
      activity: 'hold',
      trackableInstance: instance,
    });
    await emitFns.position.reprice({ trackableInstance: instance });
  }

  if (toAddress !== zeroAddress && toAddress !== poolAddress.toLowerCase()) {
    await emitFns.position.balanceDelta({
      user: toAddress,
      asset: { type: 'erc20', address: poolAddress },
      amount: decoded.value,
      activity: 'hold',
      trackableInstance: instance,
    });
    await emitFns.position.reprice({ trackableInstance: instance });
  }
}
