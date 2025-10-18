// LP Transfer handler for Uniswap V3 (NFT position transfers)
import { UnifiedEvmLog } from '../_shared/index.ts';
import { EmitFunctions, SqdRpcCtx } from '../_shared/index.ts';
import { Redis } from 'ioredis';
import * as univ3positionsAbi from './abi-types/univ3nonfungiblepositionmanager.ts';
import * as univ3factoryAbi from './abi-types/univ3factory.ts';
import type { InstanceFrom } from '../_shared/index.ts';
import type { manifest } from './index.ts';

const EVM_NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

export async function handleLpTransfer(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  instance: InstanceFrom<typeof manifest.trackables.lp>,
  redis: Redis,
  sqdRpcCtx: SqdRpcCtx,
): Promise<void> {
  const decoded = univ3positionsAbi.events.Transfer.decode({
    topics: log.topics,
    data: log.data,
  });

  const { from, to, tokenId } = decoded;
  const nonFungiblePositionManagerAddress = log.address;

  // Redis keys
  const assetKey =
    `erc721:${nonFungiblePositionManagerAddress}:${tokenId.toString()}`.toLowerCase();
  const labelsKey = `asset:labels:${assetKey}`;
  const ownerKey = `asset:owner:${assetKey}`;

  // Set labels for the NFT position if not already set
  const existingLabels = await redis.hgetall(labelsKey);
  const hasExistingLabels = existingLabels && Object.keys(existingLabels).length > 0;

  // If labels don't exist or pool info is missing, fetch and set them
  if (!hasExistingLabels || !existingLabels.pool) {
    try {
      // Get tokenId info (aka: position info)
      const nfpmContract = new univ3positionsAbi.Contract(
        sqdRpcCtx,
        nonFungiblePositionManagerAddress,
      );
      const factoryAddress = await nfpmContract.factory();
      const factoryContract = new univ3factoryAbi.Contract(sqdRpcCtx, factoryAddress);
      const position = await nfpmContract.positions(tokenId);
      const { token0, token1, fee, tickLower, tickUpper } = position;
      const poolAddress = await factoryContract.getPool(token0, token1, fee);

      // Labels
      const newLabels = {
        protocol: 'uniswap-v3',
        token0: token0.toLowerCase(),
        token1: token1.toLowerCase(),
        factory: factoryAddress.toLowerCase(),
        fee: fee.toString(),
        tickLower: tickLower.toString(),
        tickUpper: tickUpper.toString(),
        pool: poolAddress.toLowerCase(),
      };

      await redis.hset(labelsKey, newLabels as any);

      // Update reverse index Set for fast pool lookup
      const poolIdxKey = `pool:${poolAddress.toLowerCase()}:positions`;
      await redis.sadd(poolIdxKey, assetKey);
    } catch (error) {
      console.error(`Failed to set labels for ${assetKey}:`, error);
    }
  }

  // Handle balance deltas (engine automatically filters null addresses)
  // Emit "from" balance decrease
  await emitFns.position.balanceDelta({
    user: from.toLowerCase(),
    asset: {
      type: 'erc721',
      address: nonFungiblePositionManagerAddress,
      tokenId: tokenId.toString(),
    },
    amount: -1n,
    activity: 'lp',
    trackableInstance: instance,
    meta: {
      tokenId: tokenId.toString(),
    },
  });

  // Handle position burn cleanup
  const currentOwner = await redis.get(ownerKey);
  if (
    currentOwner &&
    currentOwner.toLowerCase() === from.toLowerCase() &&
    to === EVM_NULL_ADDRESS
  ) {
    await redis.del(ownerKey);

    // Position is being burned - clean up pool indexing
    const labels = await redis.hgetall(labelsKey);
    if (labels.pool) {
      const poolAddr = labels.pool;
      const poolIdxKey = `pool:${poolAddr}:positions`;
      await redis.srem(poolIdxKey, assetKey);
    }
  }

  // Emit "to" balance increase
  await emitFns.position.balanceDelta({
    user: to.toLowerCase(),
    asset: {
      type: 'erc721',
      address: nonFungiblePositionManagerAddress,
      tokenId: tokenId.toString(),
    },
    amount: 1n,
    activity: 'lp',
    trackableInstance: instance,
    meta: {
      tokenId: tokenId.toString(),
    },
  });

  // Update owner
  await redis.set(ownerKey, to.toLowerCase());
}
