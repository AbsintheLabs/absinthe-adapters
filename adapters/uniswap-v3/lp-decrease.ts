// DecreaseLiquidity handler for Uniswap V3
import { UnifiedEvmLog } from '../../src/types/unified-chain-events.ts';
import { EmitFunctions, SqdRpcCtx } from '../../src/types/adapter.ts';
import { Redis } from 'ioredis';
import * as univ3positionsAbi from './abi-types/univ3nonfungiblepositionmanager.ts';
import type { InstanceFrom } from '../../src/types/manifest.ts';
import type { manifest } from './index.ts';

export async function handleDecreaseLiquidity(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  instance: InstanceFrom<typeof manifest.trackables.lp>,
  redis: Redis,
  sqdRpcCtx: SqdRpcCtx,
): Promise<void> {
  const decoded = univ3positionsAbi.events.DecreaseLiquidity.decode({
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
      liquidityChange: `-${liquidity.toString()}`, // Negative for decrease
      amount0: amount0.toString(),
      amount1: amount1.toString(),
    },
  });
}
