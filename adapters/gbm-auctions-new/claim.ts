// Bid handler for GBM Auctions Legacy
import { UnifiedEvmLog } from '../_shared/index.ts';
import { EmitFunctions } from '../../src/types/adapter.ts';
import * as gbmAbi from './abi/main.ts';
import { md5Hash } from '../_shared/index.ts';
import type { InstanceFrom } from '../../src/types/manifest.ts';
import type { manifest } from './index.ts';
import { logger } from '../../src/utils/logger.ts';
import { ZERO_ADDRESS } from './consts.ts';

export async function handleClaim(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  instance: InstanceFrom<typeof manifest.trackables.claim>,
): Promise<void> {
  // Try both ABIs since the event signature is the same
  const decoded = gbmAbi.events.Auction_Claimed.decode({
    topics: log.topics,
    data: log.data,
  });

  const { winner, saleID } = decoded;

  if (winner.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
    logger.warn('Auction_Claimed event with winner ZERO_ADDRESS', {
      saleID: saleID.toString(),
      log: log,
    });
    return;
  }

  // Emit the bid action
  await emitFns.action.action({
    key: md5Hash(`${log.txRef}${log.logIndex}`),
    activity: 'claim',
    user: winner.toLowerCase(),
    trackableInstance: instance,
    amount: 0n,
    meta: {
      saleID: saleID.toString(),
      winner: 'true',
      bidIndex: 'null',
    },
  });
}
