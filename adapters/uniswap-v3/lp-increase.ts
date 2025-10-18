// IncreaseLiquidity handler for Uniswap V3
import { UnifiedEvmLog } from '../_shared/index.ts';
import { EmitFunctions, SqdRpcCtx } from '../_shared/index.ts';
import { Redis } from 'ioredis';
import * as univ3positionsAbi from './abi-types/univ3nonfungiblepositionmanager.ts';
import type { InstanceFrom } from '../_shared/index.ts';
import type { manifest } from './index.ts';

export async function handleIncreaseLiquidity(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  instance: InstanceFrom<typeof manifest.trackables.lp>,
  redis: Redis,
  sqdRpcCtx: SqdRpcCtx,
): Promise<void> {
  const decoded = univ3positionsAbi.events.IncreaseLiquidity.decode({
    topics: log.topics,
    data: log.data,
  });

  const { tokenId, liquidity, amount0, amount1 } = decoded;
  const nonFungiblePositionManagerAddress = log.address;
  const assetKey =
    `erc721:${nonFungiblePositionManagerAddress}:${tokenId.toString()}`.toLowerCase();
  const ownerKey = `asset:owner:${assetKey}`;

  // Get the owner of the position
  const owner = await redis.get(ownerKey);
  if (!owner) {
    console.error(`No owner found for asset: ${assetKey}`);
    // If no owner found, we can't emit the position update
    // This could happen if the from block was before the position was created
    return;
  }

  // Emit position update (signals that the position changed, triggering repricing)
  await emitFns.position.positionUpdate({
    user: owner,
    asset: {
      type: 'erc721',
      address: nonFungiblePositionManagerAddress,
      tokenId: tokenId.toString(),
    },
    activity: 'lp',
    trackableInstance: instance,
    meta: {
      tokenId: tokenId.toString(),
      liquidityChange: liquidity.toString(),
      amount0: amount0.toString(),
      amount1: amount1.toString(),
    },
  });
}
