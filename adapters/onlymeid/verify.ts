// Verify handler for OnlyMeID
import type { UnifiedEvmTransaction } from '../_shared/index.ts';
import type { EmitFunctions } from '../_shared/index.ts';
import type { InstanceFrom } from '../_shared/index.ts';
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
  const { transactionFrom: user, txRef, index } = transaction;

  // Emit the verification action
  // Since quantityType is 'none', we don't need to provide asset or amount
  await emitFns.action.action({
    key: md5Hash(`${txRef}${index}`),
    user,
    activity: 'verify',
    trackableInstance: instance,
  });
}
