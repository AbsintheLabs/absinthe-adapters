import { UnifiedEvmLog } from '../_shared/index.ts';
import { EmitFunctions, SqdRpcCtx } from '../../src/types/adapter.ts';
import type { InstanceFrom } from '../../src/types/manifest.ts';
import type { manifest } from './index.ts';
import * as concreteAbi from './abi/concrete.ts';
import { Redis } from 'ioredis';
import { md5Hash } from '../_shared/index.ts';
/**
 * Handles first-time vault deposits as actions.
 * Only emits an action when a user makes their first deposit (balance was 0 before).
 */
export async function handleVaultDeposit(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  instance: InstanceFrom<typeof manifest.trackables.vaultDeposits>,
  vaultAddress: string,
  redis: Redis,
  sqdRpcCtx: SqdRpcCtx,
): Promise<void> {
  const { from, to, value } = concreteAbi.events.Transfer.decode({
    topics: log.topics,
    data: log.data,
  });

  const ZERO = '0x0000000000000000000000000000000000000000';

  const isDeposit = from.toLowerCase() === ZERO;

  if (!isDeposit) {
    return; // Not a deposit, skip
  }

  await emitFns.action.action({
    key: md5Hash(`${log.txRef}${log.index}`),
    user: to.toLowerCase(),
    asset: { type: 'custom', prefix: 'concrete', key: vaultAddress },
    amount: BigInt(value),
    activity: 'deposit',
    trackableInstance: instance,
    meta: {
      vaultAddress: vaultAddress.toLowerCase(),
    },
  });
}
