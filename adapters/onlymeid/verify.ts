// Verify handler for OnlyMeID
import type { UnifiedEvmTransaction } from '../../src/types/unified-chain-events.ts';
import type { EmitFunctions } from '../../src/types/adapter.ts';
import type { InstanceFrom } from '../../src/types/manifest.ts';
import type { manifest } from './manifest.ts';
import { md5Hash } from '../_shared/index.ts';

/**
 * Handles userVerify transaction calls to the OnlyMeID contract.
 * This is a quantityType: 'none' action - we just track that the verification occurred.
 */
export async function handleVerify(
  transaction: UnifiedEvmTransaction,
  emitFns: EmitFunctions,
  instance: InstanceFrom<typeof manifest.trackables.verify>,
): Promise<void> {
  const { transactionFrom: user, txRef, transactionIndex } = transaction;

  // Emit the verification action
  // Since quantityType is 'none', we don't need to provide asset or amount
  await emitFns.action.action({
    key: md5Hash(`${txRef}${transactionIndex}`),
    user,
    activity: 'verify',
    trackableInstance: instance,
  });
}
