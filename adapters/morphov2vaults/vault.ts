import { UnifiedEvmLog } from '../../src/types/unified-chain-events.ts';
import { EmitFunctions, SqdRpcCtx } from '../../src/types/adapter.ts';
import type { InstanceFrom } from '../../src/types/manifest.ts';
import type { manifest } from './index.ts';
import * as moprhov1Vaults from './abi/morphov2vaults.ts';
import { Redis } from 'ioredis';

export async function handleVault(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  instance: InstanceFrom<typeof manifest.trackables.vaults>,
  vaultAddress: string,
  redis: Redis,
  sqdRpcCtx: SqdRpcCtx,
): Promise<void> {
  const { from, to, shares } = moprhov1Vaults.events.Transfer.decode({
    topics: log.topics,
    data: log.data,
  });

  if (from.toLowerCase() !== '0x0000000000000000000000000000000000000000') {
    await emitFns.position.balanceDelta({
      user: from.toLowerCase(),
      asset: vaultAddress,
      amount: -BigInt(shares),
      activity: 'hold',
      trackableInstance: instance,
    });
  }

  if (to.toLowerCase() !== '0x0000000000000000000000000000000000000000') {
    await emitFns.position.balanceDelta({
      user: to.toLowerCase(),
      asset: vaultAddress,
      amount: BigInt(shares),
      activity: 'hold',
      trackableInstance: instance,
    });
  }

  await emitFns.position.reprice({ trackableInstance: instance });
}
