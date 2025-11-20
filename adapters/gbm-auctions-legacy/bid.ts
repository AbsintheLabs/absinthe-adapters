// LP (Liquidity Position) handler for Uniswap V2
import Big from 'big.js';
import { UnifiedEvmLog } from '../_shared/index.ts';
import { EmitFunctions } from '../../src/types/adapter.ts';
import * as gbmAbi from './abi/main.ts';
import type { InstanceFrom } from '../../src/types/manifest.ts';
import type { manifest } from './index.ts';
import { md5Hash } from '../../src/utils/helper.ts';

export async function handleBid(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  instance: InstanceFrom<typeof manifest.trackables.bid>,
  poolAddress: string,
): Promise<void> {
  const { _bidder, _bidAmount, _auctionID } = gbmAbi.events.Auction_BidPlaced.decode({
    topics: log.topics,
    data: log.data,
  });

  const bidTokenAddress = (instance as any).assetSelectors?.bidTokenAddress;

  // Emit the bid action with the token asset
  await emitFns.action.action({
    key: md5Hash(`${log.txRef}${log.logIndex}`),
    activity: 'bid',
    user: _bidder.toLowerCase(),
    asset: { type: 'erc20', address: bidTokenAddress.toLowerCase() },
    amount: _bidAmount,
    trackableInstance: instance,
    meta: {
      auctionId: _auctionID.toString(),
      winner: 'false',
    },
  });
}
