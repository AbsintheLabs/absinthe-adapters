// Uniswap V3 LP position pricing handler
// Calculates position value by deriving token prices from pool state

import { defineFeedHandler, FeedSchema } from '../../../src/types/asset.ts';
import Big from 'big.js';
import { logger } from '../../../src/utils/logger.ts';
import { EVM_NULL_ADDRESS } from '../../../src/utils/constants.ts';
import { z } from 'zod';

// ABIs
import * as univ3poolAbi from '../../../src/abi/univ3pool.ts';
import * as univ3positionsAbi from '../../../src/abi/univ3nonfungiblepositionmanager.ts';
import * as univ3factoryAbi from '../../../src/abi/univ3factory.ts';
import * as erc20Abi from '../../../src/abi/erc20.ts';

// ---------- Math helpers (Q64.96) ----------
const Q96 = Big(2).pow(96);
const Q192 = Q96.pow(2); // 2^192

function tickToSqrtPriceX96(tick: number): Big {
  // sqrtPriceX96 = 2^96 * sqrt(1.0001^tick)
  const base = Big(1.0001);
  const pow = Big(Math.pow(1.0001, tick));
  return pow.sqrt().times(Q96);
}

// token1 per token0 (i.e., price of token0 in token1 units)
function priceToken0InToken1(sqrtPriceX96: Big, d0: number, d1: number): Big {
  const Q192 = Big(2).pow(192);
  const pRaw = sqrtPriceX96.pow(2).div(Q192); // (sqrt/2^96)^2
  const scale = Big(10).pow(d0 - d1); // NOTE: d0 - d1 (not d1 - d0)
  return pRaw.times(scale);
}

function amountsFromLiquidity(
  L_: Big,
  sqrtP_: Big,
  sqrtA_: Big,
  sqrtB_: Big,
): { amount0: Big; amount1: Big } {
  const L = L_;
  const p = sqrtP_;
  const a = sqrtA_.lt(sqrtB_) ? sqrtA_ : sqrtB_;
  const b = sqrtA_.gt(sqrtB_) ? sqrtA_ : sqrtB_;

  let amount0 = Big(0);
  let amount1 = Big(0);

  if (p.lte(a)) {
    // Entirely in token0
    amount0 = L.times(b.minus(a)).times(Q96).div(a.times(b));
  } else if (p.lt(b)) {
    // In-range: both tokens
    amount0 = L.times(b.minus(p)).times(Q96).div(p.times(b));
    amount1 = L.times(p.minus(a)).div(Q96);
  } else {
    // Entirely in token1
    amount1 = L.times(b.minus(a)).div(Q96);
  }
  return { amount0, amount1 };
}

// ---------- Helper functions ----------

async function getErc20Decimals(ctx: any, addr: string): Promise<number> {
  const cached = await ctx.metadataCache.get(addr);
  if (cached?.decimals != null) return Number(cached.decimals);
  const c = new erc20Abi.Contract(ctx.sqdRpcCtx, addr);
  const dec = Number((await c.decimals()).toString());
  await ctx.metadataCache.set(addr, { decimals: dec });
  return dec;
}

/**
 * Position metadata cached for each NFT
 */
interface PositionMetadata {
  token0: string;
  token1: string;
  fee: number;
  tickLower: number;
  tickUpper: number;
  pool: string;
}

/**
 * Uniswap V3 LP Position Feed Handler
 *
 * Prices LP positions (ERC721 NFTs) by:
 * 1. Getting position liquidity and tick range
 * 2. Converting liquidity to token amounts using pool price
 * 3. Pricing one token via config, deriving the other from pool ratio
 * 4. Calculating total USD value of position
 *
 * Accepts: ERC721 assets (LP positions are NFTs)
 * Requires: Known price feed for either token0 or token1
 */
export const univ3lpFeed = defineFeedHandler({
  name: 'univ3lp',
  acceptsAssetType: 'erc721',
  configSchema: z.object({
    nonfungiblepositionmanager: z
      .string()
      .describe('Address of the NonFungiblePositionManager contract'),
    tokenSelector: z
      .enum(['token0', 'token1'])
      .describe('Which token has a known price feed (token0 or token1)'),
    token: FeedSchema.describe('Price feed configuration for the known token'),
  }),
  handler: async ({ asset, config, ctx, resolve }) => {
    try {
      // Asset is guaranteed to be { type: 'erc721', address: string, tokenId: string }
      const nfpmAddress = asset.address.toLowerCase();
      const tokenId = asset.tokenId;

      logger.debug('🔍 UNIV3LP: Starting handler for position:', { nfpmAddress, tokenId });

      // Verify the position manager matches the expected one
      if (nfpmAddress !== config.nonfungiblepositionmanager.toLowerCase()) {
        logger.error('🔍 UNIV3LP: Position manager mismatch:', {
          expected: config.nonfungiblepositionmanager,
          got: nfpmAddress,
        });
        throw new Error(
          `Position manager mismatch: expected ${config.nonfungiblepositionmanager}, got ${nfpmAddress}`,
        );
      }

      // 1) Read position metadata from the position manager
      const pmContract = new univ3positionsAbi.Contract(ctx.sqdRpcCtx, nfpmAddress);

      // First try to get metadata from labels (much more efficient)
      logger.debug('🔍 UNIV3LP: Checking for cached labels');
      const labelsKey = `asset:labels:${asset.address.toLowerCase()}:${asset.tokenId}`;
      const labels = await ctx.redis.hgetall(labelsKey);
      logger.debug('🔍 UNIV3LP: Labels retrieved:', {
        hasLabels: !!labels,
        labelKeys: Object.keys(labels || {}),
      });

      let positionMetadata: PositionMetadata;

      if (labels && labels.pool && labels.token0 && labels.token1) {
        // Use labels data - this is much more efficient and avoids contract calls
        positionMetadata = {
          token0: String(labels.token0).toLowerCase(),
          token1: String(labels.token1).toLowerCase(),
          fee: Number(labels.fee),
          tickLower: Number(labels.tickLower),
          tickUpper: Number(labels.tickUpper),
          pool: String(labels.pool).toLowerCase(),
        };
        logger.debug('🔍 UNIV3LP: Using cached labels for position:', {
          pool: labels.pool,
          token0: labels.token0,
          token1: labels.token1,
        });
      } else {
        logger.debug('🔍 UNIV3LP: No valid labels found, falling back to contract calls');
        // Fallback to contract call (should rarely happen)
        logger.warn(`No cached labels found for NFT ${tokenId}, falling back to contract call`);
        const positionKey = `${nfpmAddress}:${tokenId}`;

        let cachedMetadata = (await ctx.handlerMetadataCache.get(
          'univ3lp',
          positionKey,
        )) as PositionMetadata | null;

        if (!cachedMetadata) {
          logger.debug('🔍 UNIV3LP: Making contract call to get position data');
          try {
            logger.debug('🔍 UNIV3LP: Calling positions() contract method');
            const pos = await pmContract.positions(BigInt(tokenId));
            logger.debug('🔍 UNIV3LP: Position data received:', {
              token0: pos.token0,
              token1: pos.token1,
              fee: pos.fee,
            });

            logger.debug('🔍 UNIV3LP: Getting factory address');
            const factoryAddress = await pmContract.factory();
            logger.debug('🔍 UNIV3LP: Factory address:', factoryAddress);

            logger.debug('🔍 UNIV3LP: Getting pool address from factory');
            const factoryContract = new univ3factoryAbi.Contract(ctx.sqdRpcCtx, factoryAddress);
            const poolAddress = await factoryContract.getPool(pos.token0, pos.token1, pos.fee);
            logger.debug('🔍 UNIV3LP: Pool address from factory:', poolAddress);

            if (!poolAddress || poolAddress === EVM_NULL_ADDRESS) {
              throw new Error(
                `No pool found for tokens ${pos.token0}, ${pos.token1} with fee ${pos.fee}`,
              );
            }

            cachedMetadata = {
              token0: pos.token0.toLowerCase(),
              token1: pos.token1.toLowerCase(),
              fee: Number(pos.fee),
              tickLower: Number(pos.tickLower),
              tickUpper: Number(pos.tickUpper),
              pool: poolAddress.toLowerCase(),
            };
            logger.debug('🔍 UNIV3LP: Caching position metadata');
            await ctx.handlerMetadataCache.set('univ3lp', positionKey, cachedMetadata);
          } catch (error) {
            logger.error(
              `🔍 UNIV3LP: Failed to fetch position ${tokenId} from ${nfpmAddress}:`,
              error,
            );
            // Return 0 for invalid/non-existent positions
            return Big(0);
          }
        } else {
          logger.debug('🔍 UNIV3LP: Using cached position metadata from handler cache');
        }

        positionMetadata = cachedMetadata;
      }

      const { token0, token1, tickLower, tickUpper, pool } = positionMetadata;
      logger.debug('🔍 UNIV3LP: Position metadata extracted:', {
        token0,
        token1,
        tickLower,
        tickUpper,
        pool,
      });

      // 2) Get liquidity for this position
      logger.debug('🔍 UNIV3LP: Getting liquidity for position');
      const assetKey = `${asset.address.toLowerCase()}:${asset.tokenId}`;
      const fetchedL = await ctx.handlerMetadataCache.getMeasureAtHeight(
        assetKey,
        'liquidity',
        ctx.block.header.height,
      );
      logger.debug('🔍 UNIV3LP: Liquidity retrieved:', {
        liquidity: fetchedL,
        blockHeight: ctx.block.header.height,
      });

      if (!fetchedL) {
        logger.warn(
          `🔍 UNIV3LP: No liquidity found for ${assetKey} at height ${ctx.block.header.height}`,
        );
        return Big(0);
      }

      const L = new Big(fetchedL);
      logger.debug('🔍 UNIV3LP: Parsed liquidity:', L.toString());

      // If liquidity is 0, position has no value
      if (L.eq(0)) {
        logger.debug('🔍 UNIV3LP: Liquidity is 0, returning 0');
        return Big(0);
      }

      // 3) Read pool price state (slot0) - try Redis first, fallback to contract
      logger.debug('🔍 UNIV3LP: Reading pool price state');
      let sqrtPriceX96: Big;
      let tick: number;

      try {
        // First try to get from Redis (stored during swap events)
        const poolPriceKey = `pool:${pool}:price:${ctx.block.header.height}`;
        const cachedPriceData = await ctx.redis.hgetall(poolPriceKey);

        if (cachedPriceData && cachedPriceData.sqrtPriceX96 && cachedPriceData.tick) {
          // Use cached data from Redis
          sqrtPriceX96 = new Big(cachedPriceData.sqrtPriceX96);
          tick = Number(cachedPriceData.tick);
          logger.debug('🔍 UNIV3LP: Using cached price data from Redis:', {
            tick,
            sqrtPriceX96: sqrtPriceX96.toString(),
            blockHeight: ctx.block.header.height,
          });
        } else {
          // Fallback to contract call
          logger.debug('🔍 UNIV3LP: No cached price data found, calling poolContract.slot0()');
          const poolContract = new univ3poolAbi.Contract(ctx.sqdRpcCtx, pool);
          const slot0 = await poolContract.slot0();
          logger.debug('🔍 UNIV3LP: Slot0 received from contract:', {
            tick: slot0.tick,
            sqrtPriceX96: slot0.sqrtPriceX96.toString(),
          });
          sqrtPriceX96 = new Big(slot0.sqrtPriceX96.toString());
          tick = Number(slot0.tick);
        }

        // 4) Convert ticks → sqrt bounds, then L → token amounts
        logger.debug('🔍 UNIV3LP: Converting ticks to sqrt prices');
        const sqrtA = tickToSqrtPriceX96(tickLower);
        const sqrtB = tickToSqrtPriceX96(tickUpper);
        logger.debug('🔍 UNIV3LP: Tick conversions:', {
          tickLower,
          tickUpper,
          sqrtA: sqrtA.toString(),
          sqrtB: sqrtB.toString(),
        });

        logger.debug('🔍 UNIV3LP: Calculating token amounts from liquidity');
        const { amount0, amount1 } = amountsFromLiquidity(L, sqrtPriceX96, sqrtA, sqrtB);
        logger.debug('🔍 UNIV3LP: Token amounts calculated:', {
          amount0: amount0.toString(),
          amount1: amount1.toString(),
        });

        // 5) Get token decimals
        logger.debug('🔍 UNIV3LP: Getting token decimals');
        const d0 = await getErc20Decimals(ctx, token0);
        const d1 = await getErc20Decimals(ctx, token1);
        logger.debug('🔍 UNIV3LP: Token decimals:', { token0: d0, token1: d1 });

        // 6) Resolve the single known token price
        const knownIs0 = config.tokenSelector === 'token0';
        const knownTokenAddr = knownIs0 ? token0 : token1;
        logger.debug('🔍 UNIV3LP: Resolving known token price', { knownTokenAddr, knownIs0 });

        // Recursively price the known token using the config
        const knownResolved = await resolve(
          { type: 'erc20', address: knownTokenAddr },
          config.token,
          ctx,
        );
        logger.debug('🔍 UNIV3LP: Known token resolved:', { price: knownResolved.price });

        if (!knownResolved || knownResolved.price == null || !knownResolved.price.gt(0)) {
          logger.error('🔍 UNIV3LP: Failed to resolve known token price');
          return Big(0);
        }

        // 7) Derive the missing token price from sqrtPriceX96
        const P01 = priceToken0InToken1(sqrtPriceX96, d0, d1); // token1 per token0
        let p0usd: Big, p1usd: Big;
        if (knownIs0) {
          p0usd = Big(knownResolved.price.toString());
          p1usd = p0usd.div(P01); // USD1 = USD0 / (token1 per token0)
        } else {
          p1usd = Big(knownResolved.price.toString());
          p0usd = p1usd.times(P01); // USD0 = USD1 * (token1 per token0)
        }

        logger.debug('🔍 UNIV3LP: Derived prices:', {
          p0usd: p0usd.toString(),
          p1usd: p1usd.toString(),
          P01: P01.toString(),
        });

        // 8) Compose USD value
        const amount0Decimal = amount0.div(Big(10).pow(d0));
        const amount1Decimal = amount1.div(Big(10).pow(d1));
        const valueUsd = amount0Decimal.times(p0usd).plus(amount1Decimal.times(p1usd));

        logger.debug('🔍 UNIV3LP: Final calculation:', {
          amount0Decimal: amount0Decimal.toString(),
          amount1Decimal: amount1Decimal.toString(),
          p0usd: p0usd.toString(),
          p1usd: p1usd.toString(),
          valueUsd: valueUsd.toString(),
        });

        logger.debug('🔍 UNIV3LP: Handler completed successfully, returning:', valueUsd.toNumber());
        return valueUsd;
      } catch (error) {
        logger.error(`🔍 UNIV3LP: Failed to price position ${tokenId}:`, error);
        logger.debug('🔍 UNIV3LP: Handler failed, returning 0');
        return Big(0);
      }
    } catch (error) {
      logger.error(`🔍 UNIV3LP: Outer error for asset ${asset.tokenId}:`, error);
      return Big(0);
    }
  },
});
