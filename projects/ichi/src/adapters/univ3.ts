// common imports
import Big from 'big.js';
import { Adapter, RpcContext } from '../types/adapter';
import { AssetFeedConfig } from '../types/pricing';
import { RedisClientType } from 'redis';
import z from 'zod';

// univ3 abis
import * as univ3factoryAbi from '../abi/univ3factory';
import * as univ3poolAbi from '../abi/univ3pool';
import * as univ3positionsAbi from '../abi/univ3nonfungiblepositionmanager';

// univ3 projector
import { Univ3Projector } from './univ3-projector';
import assert from 'assert';

export function createUniv3Adapter(feedConfig: AssetFeedConfig, baseSqdProcessor: any): Adapter {
  const transferTopic = univ3positionsAbi.events.Transfer.topic;
  const increaseLiquidityTopic = univ3positionsAbi.events.IncreaseLiquidity.topic;
  const decreaseLiquidityTopic = univ3positionsAbi.events.DecreaseLiquidity.topic;
  const swapTopic = univ3poolAbi.events.Swap.topic;
  const poolCreatedTopic = univ3factoryAbi.events.PoolCreated.topic;

  // Create projector instance
  const projector = new Univ3Projector();

  // Queue for deferred label operations
  const labelPromises: Array<() => Promise<void>> = [];
  // Queue for deferred reprice operations (executed after labels are set)
  const repricePromises: Array<{ fn: () => Promise<void>; tick?: number; poolAddress: string }> =
    [];
  // Queue for deferred individual asset reprice operations (executed after labels are set)
  const assetRepricePromises: Array<{ asset: string; fn: () => Promise<void> }> = [];

  // REDIS KEYS
  const poolIdxKey = 'factory:pools';

  return {
    // register the custom config schema for the adapter
    adapterCustomConfig: new z.ZodObject({
      nonFungiblePositionManagerAddress: z.string(),
      factoryAddress: z.string(),
    }),
    // now we can reference the custom config schema for the adapter
    processor: baseSqdProcessor
      .addLog({
        // fetch all transfer, increaseLiquidity, and decreaseLiquidity events for our particular nfpm
        address: [config.nonFungiblePositionManagerAddress],
        topic0: [transferTopic, increaseLiquidityTopic, decreaseLiquidityTopic],
      })
      .addLog({
        // fetch all pool created events for our particular factory - nfpm pair
        address: [config.factoryAddress],
        topic0: [poolCreatedTopic],
      })
      .addLog({
        // fetch ALL swap events and filter out for the ones that are specific to the factory contract later
        topic0: [swapTopic],
      }),
    onLog: async (block, log, emit, rpcCtx, redis) => {
      // Create factory contract instance with the provided RPC context

      // Helper function to queue reprice operations for a pool
      const queueRepriceForPool = (poolAddress: string, tick?: number) => {
        repricePromises.push({
          poolAddress,
          tick,
          fn: async () => {
            const poolIdxKey = `pool:${poolAddress}:positions`;
            const assetKeys = await redis.sMembers(poolIdxKey);
            console.log(`Found ${assetKeys.length} assets in pool ${poolAddress} - repricing...`);

            for (const assetKey of assetKeys) {
              console.log('Repricing asset: ', assetKey);
              await emit.reprice({ asset: assetKey });
            }
          },
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

      if (log.topics[0] === poolCreatedTopic) {
        const { pool } = univ3factoryAbi.events.PoolCreated.decode(log);
        const poolAddress = pool.toLowerCase();
        await redis.sAdd(poolIdxKey, poolAddress);
      }

      // Handle change in ticks (Swap events) - detect tick crossings and toggle position status
      if (log.topics[0] === swapTopic) {
        // first check if the pool is one created by our factory contract
        const isPoolCreatedByFactory = await redis.sIsMember(poolIdxKey, log.address.toLowerCase());
        if (!isPoolCreatedByFactory) {
          // not a pool created by our factory contract so we shouldn't track it
          return;
        }

        const decoded = univ3poolAbi.events.Swap.decode(log);
        const {
          tick: tickBN,
          sqrtPriceX96,
          liquidity,
          amount0,
          amount1,
          recipient,
          sender,
        } = decoded;
        const pool = log.address.toLowerCase();
        const curTick = Number(tickBN.toString());

        // Store the tick + sqrtPriceX96 in Redis for lookup later (without having to make rpc calls)
        const blockHeight = block.header.height;
        const poolPriceKey = `pool:${pool}:price:${blockHeight}`;

        await redis.hSet(poolPriceKey, {
          tick: tickBN.toString(),
          sqrtPriceX96: sqrtPriceX96.toString(),
          blockHeight: blockHeight.toString(),
          timestamp: Date.now().toString(),
        });

        // Also store a reference to clean up old entries later
        const poolLatestPriceKey = `pool:${pool}:latest_price`;
        await redis.set(poolLatestPriceKey, blockHeight.toString());

        console.log(
          `Stored pool price data for ${pool} at height ${blockHeight}: tick=${curTick}, sqrtPriceX96=${sqrtPriceX96}`,
        );

        // Detect tick crossings and toggle position status
        const prevKey = `pool:${pool}:prevTick`;
        const prevTickStr = await redis.get(prevKey);
        await redis.set(prevKey, String(curTick)); // Store for next comparison

        if (!prevTickStr) {
          console.log(
            `First swap observed for pool ${pool} at tick ${curTick} - skipping status updates`,
          );
          // Emit custom event for swap observation
          await emit.custom('univ3', 'swapObserved', {
            pool,
            tick: curTick,
          });
          return; // First observed swap for this pool
        }

        const prevTick = Number(prevTickStr);
        if (prevTick === curTick) {
          console.log(`Pool ${pool} tick unchanged at ${curTick} - no crossings`);
          // Emit custom event for swap observation
          await emit.custom('univ3', 'swapObserved', {
            pool,
            tick: curTick,
          });
          return; // Nothing moved
        }

        const dirUp = curTick > prevTick;
        const lo = Math.min(prevTick, curTick);
        const hi = Math.max(prevTick, curTick);

        console.log(
          `Pool ${pool} tick moved from ${prevTick} to ${curTick} (${dirUp ? 'up' : 'down'}) - checking crossings in (${lo}, ${hi}]`,
        );

        // Find positions whose bounds were crossed
        const lowerKey = `pool:${pool}:bounds:lower`;
        const upperKey = `pool:${pool}:bounds:upper`;

        const [lowers, uppers] = await Promise.all([
          redis.zRangeByScore(lowerKey, `(${lo}`, hi),
          redis.zRangeByScore(upperKey, `(${lo}`, hi),
        ]);

        console.log(
          `Found ${lowers.length} lower bounds and ${uppers.length} upper bounds crossed`,
        );

        // Determine which positions to activate/deactivate
        const toActivate = new Set<string>();
        const toDeactivate = new Set<string>();

        if (dirUp) {
          lowers.forEach((asset) => toActivate.add(asset));
          uppers.forEach((asset) => toDeactivate.add(asset));
        } else {
          lowers.forEach((asset) => toDeactivate.add(asset));
          uppers.forEach((asset) => toActivate.add(asset));
        }

        // Handle positions that may have both bounds crossed (resolve conflicts)
        const candidates = new Set([...toActivate, ...toDeactivate]);
        const statusChangePromises: Array<Promise<void>> = [];

        for (const assetKey of candidates) {
          statusChangePromises.push(
            (async () => {
              try {
                const meta = await redis.hGetAll(`pos:${assetKey}`);
                if (!meta || !meta.tickLower || !meta.tickUpper) {
                  console.warn(`Missing position metadata for ${assetKey}`);
                  return;
                }

                const lower = Number(meta.tickLower);
                const upper = Number(meta.tickUpper);
                const nowActive = curTick >= lower && curTick < upper; // Uniswap v3 active definition
                const wasActive = meta.active === '1';

                if (nowActive !== wasActive) {
                  // Update status in Redis
                  await redis.hSet(`pos:${assetKey}`, { active: nowActive ? '1' : '0' });

                  // Get owner for positionStatusChange event
                  const owner = await redis.get(`asset:owner:${assetKey}`);
                  if (!owner) {
                    console.warn(`No owner found for asset ${assetKey} during status change`);
                    return;
                  }

                  console.log(
                    `Position ${assetKey} ${nowActive ? 'activated' : 'deactivated'} (tick: ${curTick}, bounds: [${lower}, ${upper}))`,
                  );

                  // Emit position status change
                  // await emit.positionStatusChange({
                  //   user: owner,
                  //   asset: assetKey,
                  //   active: nowActive,
                  // });

                  // Queue reprice for this specific position
                  queueRepriceForAsset(assetKey);
                }
              } catch (error) {
                console.error(`Error processing status change for ${assetKey}:`, error);
              }
            })(),
          );
        }

        // Wait for all status changes to complete
        await Promise.all(statusChangePromises);

        // Emit custom event for swap observation
        await emit.custom('univ3', 'swapObserved', {
          pool,
          tick: curTick,
          crossings: candidates.size,
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

              // Index position bounds for efficient tick crossing detection
              const poolAddr = poolAddress.toLowerCase();
              const lowerKey = `pool:${poolAddr}:bounds:lower`;
              const upperKey = `pool:${poolAddr}:bounds:upper`;
              const posKey = `pos:${assetKey}`;

              // Index bounds in sorted sets for fast range queries
              await redis.zAdd(lowerKey, [{ score: Number(tickLower), value: assetKey }]);
              await redis.zAdd(upperKey, [{ score: Number(tickUpper), value: assetKey }]);

              // Store position metadata for status tracking
              await redis.hSet(posKey, {
                pool: poolAddr,
                tickLower: tickLower.toString(),
                tickUpper: tickUpper.toString(),
                active: '0', // Will be set properly on first swap observation
              });
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

            // Position is being burned - clean up bounds indexing
            const labels = await redis.hGetAll(labelsKey);
            if (labels.pool) {
              const poolAddr = labels.pool;
              const lowerKey = `pool:${poolAddr}:bounds:lower`;
              const upperKey = `pool:${poolAddr}:bounds:upper`;
              const posKey = `pos:${assetKey}`;

              // Remove from bounds indexes
              await redis.zRem(lowerKey, assetKey);
              await redis.zRem(upperKey, assetKey);

              // Remove position metadata
              await redis.del(posKey);

              // Remove from pool positions set
              const poolIdxKey = `pool:${poolAddr}:positions`;
              await redis.sRem(poolIdxKey, assetKey);

              console.log(`Cleaned up burned position ${assetKey} from pool ${poolAddr}`);
            }
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
          // for (const repriceFn of repricePromises) {
          //   await repriceFn();
          // }
          // Execute all reprice promises sequentially
          for (const reprice of repricePromises) {
            await reprice.fn();
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
