// Bid handler for GBM Auctions Legacy
import { UnifiedEvmLog } from '../../src/types/unified-chain-events.ts';
import { EmitFunctions } from '../../src/types/adapter.ts';
import * as gbmAbi from './abi/main.ts';
import * as aavegotchiAbi from './abi/aavegotchi.ts';
import { md5Hash } from '../_shared/index.ts';
import type { InstanceFrom } from '../../src/types/manifest.ts';
import type { manifest } from './index.ts';

export async function handleClaim(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  instance: InstanceFrom<typeof manifest.trackables.claim>,
): Promise<void> {
  // Try both ABIs since the event signature is the same
  const decoded = aavegotchiAbi.events.Auction_ItemClaimed.decode({
    topics: log.topics,
    data: log.data,
  });

  const { _auctionID } = decoded;
  const user = log.transactionFrom;

  // Emit the bid action
  await emitFns.action.action({
    key: md5Hash(`${log.txRef}${log.logIndex}`),
    activity: 'claim',
    user: user.toLowerCase(),
    trackableInstance: instance,
    meta: {
      auctionId: _auctionID.toString(),
      winner: 'false',
    },
  });
}
