// common imports
import Big from 'big.js';
import { Adapter, RpcContext } from '../types/adapter';
import { AssetFeedConfig } from '../types/pricing';
import { RedisClientType } from 'redis';

// univ3 abis
import * as univ3factoryAbi from '../abi/univ3factory';
import * as univ3poolAbi from '../abi/univ3pool';
import * as univ3positionsAbi from '../abi/univ3nonfungiblepositionmanager';

// univ3 projector
import { Univ3Projector } from './univ3-projector';

export function createUniv3Adapter(feedConfig: AssetFeedConfig): Adapter {
  const transferTopic = univ3positionsAbi.events.Transfer.topic;
  const increaseLiquidityTopic = univ3positionsAbi.events.IncreaseLiquidity.topic;
  const decreaseLiquidityTopic = univ3positionsAbi.events.DecreaseLiquidity.topic;
  const swapTopic = univ3poolAbi.events.Swap.topic;

  // Create projector instance
  const projector = new Univ3Projector();

  // Queue for deferred label operations
  const labelPromises: Array<() => Promise<void>> = [];
  // Queue for deferred reprice operations (executed after labels are set)
  const repricePromises: Array<() => Promise<void>> = [];
  // Queue for deferred individual asset reprice operations (executed after labels are set)
  const assetRepricePromises: Array<{ asset: string; fn: () => Promise<void> }> = [];

  return {
    onLog: async (block, log, emit, rpcCtx, redis) => {
      // Create factory contract instance with the provided RPC context

      // Helper function to queue reprice operations for a pool
      const queueRepriceForPool = (poolAddress: string) => {
        repricePromises.push(async () => {
          const poolIdxKey = `pool:${poolAddress}:positions`;
          const assetKeys = await redis.sMembers(poolIdxKey);
          console.log(`Found ${assetKeys.length} assets in pool ${poolAddress} - repricing...`);

          for (const assetKey of assetKeys) {
            console.log('Repricing asset: ', assetKey);
            await emit.reprice({ asset: assetKey });
          }
        });
      };

      // Helper function to queue reprice operations for individual assets
      const queueRepriceForAsset = (assetKey: string) => {
        assetRepricePromises.push({
          asset: assetKey,
          fn: async () => {
            console.log('Repricing asset: ', assetKey);
            await emit.reprice({ asset: assetKey });
          },
        });
      };

      // Handle change in ticks (Swap events)
      if (log.topics[0] === swapTopic) {
        const decoded = univ3poolAbi.events.Swap.decode(log);
        const { tick, sqrtPriceX96, liquidity, amount0, amount1, recipient, sender } = decoded;
        const poolAddress = log.address; // NOTE: since we are getting multiple events here, we get the address from the log
        const poolAddressLower = poolAddress.toLowerCase();

        // Store the tick + sqrtPriceX96 in Redis for lookup later (without having to make rpc calls)
        const blockHeight = block.header.height;
        const poolPriceKey = `pool:${poolAddressLower}:price:${blockHeight}`;

        await redis.hSet(poolPriceKey, {
          tick: tick.toString(),
          sqrtPriceX96: sqrtPriceX96.toString(),
          blockHeight: blockHeight.toString(),
          timestamp: Date.now().toString(),
        });

        // Also store a reference to clean up old entries later
        const poolLatestPriceKey = `pool:${poolAddressLower}:latest_price`;
        await redis.set(poolLatestPriceKey, blockHeight.toString());

        console.log(
          `Stored pool price data for ${poolAddressLower} at height ${blockHeight}: tick=${tick}, sqrtPriceX96=${sqrtPriceX96}`,
        );

        // Queue repricing for this pool (will be executed after labels are set)
        queueRepriceForPool(poolAddressLower);
        console.log(`Pool ${poolAddressLower} had a swap - queued repricing for batch end`);

        // Emit custom event for swap observation
        await emit.custom('univ3', 'swapObserved', {
          pool: poolAddressLower,
          tick: parseInt(tick.toString()),
        });
      }

      // Handle changes in liquidity
      if (log.topics[0] === increaseLiquidityTopic) {
        const { tokenId, liquidity, amount0, amount1 } =
          univ3positionsAbi.events.IncreaseLiquidity.decode(log);
        const nonFungiblePositionManagerAddress = log.address;
        const assetKey =
          `erc721:${nonFungiblePositionManagerAddress}:${tokenId.toString()}`.toLowerCase();
        const ownerKey = `asset:owner:${assetKey}`;

        // Emit measure delta for liquidity increase
        await emit.measureDelta({
          asset: assetKey,
          metric: 'liquidity',
          delta: new Big(liquidity.toString()),
        });

        // NOTE: purely to make sure that tracking is better
        const owner = await redis.get(ownerKey);
        if (!owner) {
          console.error('No owner found for asset: ', assetKey);
        }
        await emit.positionUpdate({
          // NOTE: if owner is not defined, it probably means that the from block was before the position was created!
          // NOTE: the backup can be to actually make an rpc call in this point in time to get the owner if we don't have it as a safety precaution!
          user: owner!,
          asset: assetKey,
        });
        // Queue reprice operation (will be executed after labels are set)
        queueRepriceForAsset(assetKey);
      } else if (log.topics[0] === decreaseLiquidityTopic) {
        const { tokenId, liquidity, amount0, amount1 } =
          univ3positionsAbi.events.DecreaseLiquidity.decode(log);
        const nonFungiblePositionManagerAddress = log.address;
        const assetKey =
          `erc721:${nonFungiblePositionManagerAddress}:${tokenId.toString()}`.toLowerCase();
        const ownerKey = `asset:owner:${assetKey}`;

        // // Emit measure delta for liquidity decrease (negative delta)
        await emit.measureDelta({
          asset: assetKey,
          metric: 'liquidity',
          delta: new Big(liquidity.toString()).neg(),
        });

        // NOTE: purely to make sure that tracking is better
        const owner = await redis.get(ownerKey);
        if (!owner) {
          console.error('No owner found for asset: ', assetKey);
        }
        await emit.positionUpdate({
          user: owner!,
          asset: assetKey,
        });
        // Queue reprice operation (will be executed after labels are set)
        queueRepriceForAsset(assetKey);
      }

      // Handle Transfer events (NFT LP token transfers)
      if (log.topics[0] === transferTopic) {
        const { from, to, tokenId } = univ3positionsAbi.events.Transfer.decode(log);
        const nonFungiblePositionManagerAddress = log.address;

        // redis keys
        const assetKey =
          `erc721:${nonFungiblePositionManagerAddress}:${tokenId.toString()}`.toLowerCase();
        const labelsKey = `asset:labels:${assetKey}`;
        const ownerKey = `asset:owner:${assetKey}`;

        // const hasLabel = await redis.exists(labelsKey);
        // if (!hasLabel) {
        // Queue label-setting operation for deferred execution
        labelPromises.push(async () => {
          try {
            const existingLabels = await redis.hGetAll(labelsKey);
            const hasExistingLabels = existingLabels && Object.keys(existingLabels).length > 0;

            // If labels don't exist or pool info is missing, fetch and set them
            if (!hasExistingLabels || !existingLabels.pool) {
              // get tokenId info (aka: position info)
              const nfpmContract = new univ3positionsAbi.Contract(
                rpcCtx,
                nonFungiblePositionManagerAddress,
              );
              const factoryAddress = await nfpmContract.factory();
              const factoryContract = new univ3factoryAbi.Contract(rpcCtx, factoryAddress);
              const position = await nfpmContract.positions(tokenId);
              const { token0, token1, fee, tickLower, tickUpper } = position;
              const poolAddress = await factoryContract.getPool(token0, token1, fee);

              // labels
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

              console.log('Setting labels for', assetKey, newLabels);
              await redis.hSet(labelsKey, newLabels);

              // Update reverse index Set for fast pool lookup
              const poolIdxKey = `pool:${poolAddress.toLowerCase()}:positions`;
              await redis.sAdd(poolIdxKey, assetKey);
            }
          } catch (error) {
            console.error(`Failed to set labels for ${assetKey}:`, error);
          }
        });
        // }

        // don't track balances for the zero address (mints/burns)
        if (from !== '0x0000000000000000000000000000000000000000') {
          await emit.balanceDelta({
            user: from,
            asset: assetKey,
            amount: new Big(-1),
            meta: {
              tokenId: tokenId.toString(),
            },
          });
          // xxx: there's gotta be a better way to do this...
          const cur = await redis.get(ownerKey);
          if (
            cur &&
            cur.toLowerCase() === from.toLowerCase() &&
            to === '0x0000000000000000000000000000000000000000'
          ) {
            await redis.del(ownerKey);
          }
        }
        if (to !== '0x0000000000000000000000000000000000000000') {
          await emit.balanceDelta({
            user: to,
            asset: assetKey,
            amount: new Big(1),
            meta: {
              tokenId: tokenId.toString(),
            },
          });
          // xxx: there's gotta be a better way to do this...
          await redis.set(ownerKey, to.toLowerCase());
        }
      }
    },
    onBatchEnd: async (redis) => {
      // Execute all queued label operations first (populates reverse indexes)
      if (labelPromises.length > 0) {
        console.log(`🔄 Executing ${labelPromises.length} queued label operations`);
        try {
          // Execute all promises concurrently with concurrency limit
          const BATCH_SIZE = 75; // Process in batches to avoid overwhelming Redis
          for (let i = 0; i < labelPromises.length; i += BATCH_SIZE) {
            const batch = labelPromises.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map((fn) => fn()));
          }
          console.log(`✅ Completed ${labelPromises.length} label operations`);
        } catch (error) {
          console.error('❌ Error executing label operations:', error);
        } finally {
          // Clear the queue
          labelPromises.length = 0;
        }
      }

      // Execute queued asset reprice operations (labels are now set)
      if (assetRepricePromises.length > 0) {
        console.log(`🔄 Executing ${assetRepricePromises.length} queued asset reprice operations`);
        try {
          // Execute asset reprice promises sequentially to avoid overwhelming
          for (const assetReprice of assetRepricePromises) {
            await assetReprice.fn();
          }
          console.log(`✅ Completed ${assetRepricePromises.length} asset reprice operations`);
        } catch (error) {
          console.error('❌ Error executing asset reprice operations:', error);
        } finally {
          // Clear the queue
          assetRepricePromises.length = 0;
        }
      }

      // Execute queued pool reprice operations (labels are now set, so reverse indexes are populated)
      if (repricePromises.length > 0) {
        console.log(`🔄 Executing ${repricePromises.length} queued pool reprice operations`);
        try {
          // Execute reprice promises sequentially to avoid overwhelming
          for (const repriceFn of repricePromises) {
            await repriceFn();
          }
          console.log(`✅ Completed ${repricePromises.length} pool reprice operations`);
        } catch (error) {
          console.error('❌ Error executing pool reprice operations:', error);
        } finally {
          // Clear the queue
          repricePromises.length = 0;
        }
      }
    },
    topic0s: [
      transferTopic, // track when position nft is transferred
      increaseLiquidityTopic, // track when position is increased
      decreaseLiquidityTopic, // track when position is decreased
      swapTopic, // track when swaps occur to detect tick changes
    ],
    feedConfig,
    projectors: [projector], // Register the projector
  };
}
