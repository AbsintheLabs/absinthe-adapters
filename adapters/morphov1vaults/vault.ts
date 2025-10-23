import { UnifiedEvmLog } from '../_shared/index.ts';
import { EmitFunctions, SqdRpcCtx } from '../../src/types/adapter.ts';
import type { InstanceFrom } from '../../src/types/manifest.ts';
import type { manifest } from './index.ts';
import * as moprhov1Vaults from './abi/morphov1vaults.ts';
import { Redis } from 'ioredis';

export async function handleVault(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  instance: InstanceFrom<typeof manifest.trackables.vaults>,
  vaultAddress: string,
  redis: Redis,
  sqdRpcCtx: SqdRpcCtx,
): Promise<void> {
  const { from, to, value } = moprhov1Vaults.events.Transfer.decode({
    topics: log.topics,
    data: log.data,
  });

  if (from.toLowerCase() !== '0x0000000000000000000000000000000000000000') {
    await emitFns.position.balanceDelta({
      user: from.toLowerCase(),
      asset: { type: 'custom', prefix: 'morpho', key: vaultAddress },
      amount: -BigInt(value),
      activity: 'hold',
      trackableInstance: instance,
    });
  }

  if (to.toLowerCase() !== '0x0000000000000000000000000000000000000000') {
    await emitFns.position.balanceDelta({
      user: to.toLowerCase(),
      asset: { type: 'custom', prefix: 'morpho', key: vaultAddress },
      amount: BigInt(value),
      activity: 'hold',
      trackableInstance: instance,
    });
  }

  await emitFns.position.reprice({ trackableInstance: instance });
}
