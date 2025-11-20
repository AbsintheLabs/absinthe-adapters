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

  const { winner, saleID, beneficiary } = decoded;

  const beneficiaryLower = beneficiary.toLowerCase();
  const winnerLower = winner.toLowerCase();
  const zeroAddressLower = ZERO_ADDRESS.toLowerCase();

  // Emit event for beneficiary if not zero address
  if (beneficiaryLower !== zeroAddressLower) {
    await emitFns.action.action({
      key: md5Hash(`${log.txRef}${log.index}:beneficiary`),
      activity: 'claim',
      user: beneficiaryLower,
      trackableInstance: instance,
      amount: 0n,
      meta: {
        saleID: saleID.toString(),
        winner: 'false',
        bidIndex: 'null',
      },
    });
  } else {
    logger.warn('Auction_Claimed event with beneficiary ZERO_ADDRESS', {
      saleID: saleID.toString(),
      log: log,
    });
  }

  // Emit event for winner if not zero address
  if (winnerLower !== zeroAddressLower) {
    await emitFns.action.action({
      key: md5Hash(`${log.txRef}${log.index}:winner`),
      activity: 'claim',
      user: winnerLower,
      trackableInstance: instance,
      amount: 0n,
      meta: {
        saleID: saleID.toString(),
        winner: 'true',
        bidIndex: 'null',
      },
    });
  } else {
    logger.warn('Auction_Claimed event with winner ZERO_ADDRESS', {
      saleID: saleID.toString(),
      log: log,
    });
  }
}
