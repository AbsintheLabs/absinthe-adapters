import { HandlerFactory } from './interface.ts';
import Big from 'big.js';
import { log } from '../utils/logger.ts';
import { EVM_NULL_ADDRESS } from '../utils/constants.ts';
import assert from 'assert';

// ABIs
import * as univ3poolAbi from '../abi/univ3pool.ts';
import * as univ3positionsAbi from '../abi/univ3nonfungiblepositionmanager.ts';
import * as univ3factoryAbi from '../abi/univ3factory.ts';
import * as erc20Abi from '../abi/erc20.ts';

// Handler name constant for Uniswap v3 LP pricing
const UNIV3_LP_HANDLER = 'univ3lp';

// ---------- math helpers (Q64.96) ----------
const Q96 = Big(2).pow(96);
const Q192 = Q96.pow(2); // 2^192

function tickToSqrtPriceX96(tick: number): Big {
  // sqrtPriceX96 = 2^96 * sqrt(1.0001^tick)
  // Use high-precision Big; for speed you can port TickMath constants later.
  const base = Big(1.0001);
  // Big.js approximation for now - replace with TickMath constants for production
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

// ---------- Contract helpers ----------

// ---------- Address/key helpers ----------
function parseAssetKey(assetKey: string) {
  // Asset key format: "erc721:nonfungiblepositionmanager:tokenId"
  const parts = assetKey.split(':');
  if (parts.length !== 3 || parts[0] !== 'erc721') {
    throw new Error(`Invalid asset key format: ${assetKey}. Expected "erc721:address:tokenId"`);
  }
  const [, pm, tokenId] = parts;
  return { pm, tokenId };
}

async function getErc20Decimals(ctx: any, addr: string): Promise<number> {
  const cached = await ctx.metadataCache.get(addr);
  if (cached?.decimals != null) return Number(cached.decimals);
  const c = new erc20Abi.Contract(ctx.sqdRpcCtx, addr);
  const dec = Number((await c.decimals()).toString());
  await ctx.metadataCache.set(addr, { decimals: dec });
  return dec;
}

// ---------- Main handler ----------
export const univ3lpFactory: HandlerFactory<'univ3lp'> = (resolve) => async (args) => {
  const { assetConfig, ctx } = args;
  const {
    token: tokenFeed,
    nonfungiblepositionmanager,
    tokenSelector, // either 'token0' or 'token1'
    kind,
  } = assetConfig.priceFeed;

  if (!tokenFeed || (tokenSelector !== 'token0' && tokenSelector !== 'token1')) {
    log.error('🔍 UNIV3LP: token feed and tokenSelector are required');
    return 0;
  }

  log.debug('🔍 UNIV3LP: Starting handler for asset:', ctx.asset);
  log.debug('🔍 UNIV3LP: Config:', {
    nonfungiblepositionmanager,
    tokenFeed: !!tokenFeed,
    tokenSelector,
  });

  // Parse asset key to get position manager and tokenId
  const { pm, tokenId } = parseAssetKey(ctx.asset);
  log.debug('🔍 UNIV3LP: Parsed asset key:', { pm, tokenId });

  // Verify the position manager matches the expected one
  if (pm.toLowerCase() !== nonfungiblepositionmanager.toLowerCase()) {
    log.error('🔍 UNIV3LP: Position manager mismatch:', {
      expected: nonfungiblepositionmanager,
      got: pm,
    });
    throw new Error(`Position manager mismatch: expected ${nonfungiblepositionmanager}, got ${pm}`);
  }
  log.debug('🔍 UNIV3LP: Position manager verified');

  // 1) Read position metadata from the position manager
  const pmContract = new univ3positionsAbi.Contract(ctx.sqdRpcCtx, nonfungiblepositionmanager);

  // First try to get metadata from labels (much more efficient)
  log.debug('🔍 UNIV3LP: Checking for cached labels');
  const labelsKey = `asset:labels:${ctx.asset}`;
  const labels = await ctx.redis.hGetAll(labelsKey);
  log.debug('🔍 UNIV3LP: Labels retrieved:', {
    hasLabels: !!labels,
    labelKeys: Object.keys(labels || {}),
  });

  let positionMetadata: any;

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
    log.debug(`🔍 UNIV3LP: Using cached labels for position ${ctx.asset}:`, {
      pool: labels.pool,
      token0: labels.token0,
      token1: labels.token1,
    });
  } else {
    log.debug('🔍 UNIV3LP: No valid labels found, falling back to contract calls');
    // Fallback to contract call (should rarely happen)
    log.warn(`No cached labels found for ${ctx.asset}, falling back to contract call`);
    const positionKey = `univ3:position:${nonfungiblepositionmanager}:${tokenId}`;
    positionMetadata = await ctx.handlerMetadataCache.get(UNIV3_LP_HANDLER, positionKey);

    if (!positionMetadata) {
      log.debug('🔍 UNIV3LP: Making contract call to get position data');
      try {
        log.debug('🔍 UNIV3LP: Calling positions() contract method');
        const pos = await pmContract.positions(BigInt(tokenId));
        log.debug('🔍 UNIV3LP: Position data received:', {
          token0: pos.token0,
          token1: pos.token1,
          fee: pos.fee,
        });

        log.debug('🔍 UNIV3LP: Getting factory address');
        const factoryAddress = await pmContract.factory();
        log.debug('🔍 UNIV3LP: Factory address:', factoryAddress);

        log.debug('🔍 UNIV3LP: Getting pool address from factory');
        const factoryContract = new univ3factoryAbi.Contract(ctx.sqdRpcCtx, factoryAddress);
        const poolAddress = await factoryContract.getPool(pos.token0, pos.token1, pos.fee);
        log.debug('🔍 UNIV3LP: Pool address from factory:', poolAddress);

        if (!poolAddress || poolAddress === EVM_NULL_ADDRESS) {
          throw new Error(
            `No pool found for tokens ${pos.token0}, ${pos.token1} with fee ${pos.fee}`,
          );
        }

        positionMetadata = {
          token0: (pos.token0 as string).toLowerCase(),
          token1: (pos.token1 as string).toLowerCase(),
          fee: Number(pos.fee),
          tickLower: Number(pos.tickLower),
          tickUpper: Number(pos.tickUpper),
          pool: poolAddress.toLowerCase(),
        };
        log.debug('🔍 UNIV3LP: Caching position metadata');
        await ctx.handlerMetadataCache.set(UNIV3_LP_HANDLER, positionKey, positionMetadata);
      } catch (error) {
        log.error(
          `🔍 UNIV3LP: Failed to fetch position ${tokenId} from ${nonfungiblepositionmanager}:`,
          error,
        );
        // Return 0 for invalid/non-existent positions
        return 0;
      }
    } else {
      log.debug('🔍 UNIV3LP: Using cached position metadata from handler cache');
    }
  }

  const { token0, token1, tickLower, tickUpper, pool } = positionMetadata;
  log.debug('🔍 UNIV3LP: Position metadata extracted:', {
    token0,
    token1,
    tickLower,
    tickUpper,
    pool,
  });

  // 2) Get liquidity for this position
  log.debug('🔍 UNIV3LP: Getting liquidity for position');
  const fetchedL = await ctx.handlerMetadataCache.getMeasureAtHeight(
    ctx.asset,
    'liquidity',
    ctx.block.header.height,
  );
  log.debug('🔍 UNIV3LP: Liquidity retrieved:', {
    liquidity: fetchedL,
    blockHeight: ctx.block.header.height,
  });

  if (!fetchedL) {
    log.warn(
      `🔍 UNIV3LP: No liquidity found for ${ctx.asset} at height ${ctx.block.header.height}`,
    );
    return 0;
  }

  const L = new Big(fetchedL);
  log.debug('🔍 UNIV3LP: Parsed liquidity:', L.toString());

  // If liquidity is 0, position has no value
  if (L.eq(0)) {
    log.debug('🔍 UNIV3LP: Liquidity is 0, returning 0');
    return 0;
  }

  // 3) Read pool price state (slot0) - try Redis first, fallback to contract
  log.debug('🔍 UNIV3LP: Reading pool price state');
  let sqrtPriceX96: Big;
  let tick: number;

  try {
    // First try to get from Redis (stored during swap events)
    const poolPriceKey = `pool:${pool}:price:${ctx.block.header.height}`;
    const cachedPriceData = await ctx.redis.hGetAll(poolPriceKey);

    if (cachedPriceData && cachedPriceData.sqrtPriceX96 && cachedPriceData.tick) {
      // Use cached data from Redis
      sqrtPriceX96 = new Big(cachedPriceData.sqrtPriceX96);
      tick = Number(cachedPriceData.tick);
      log.debug('🔍 UNIV3LP: Using cached price data from Redis:', {
        tick,
        sqrtPriceX96: sqrtPriceX96.toString(),
        blockHeight: ctx.block.header.height,
      });
    } else {
      // Fallback to contract call
      log.debug('🔍 UNIV3LP: No cached price data found, calling poolContract.slot0()');
      const poolContract = new univ3poolAbi.Contract(ctx.sqdRpcCtx, pool);
      const slot0 = await poolContract.slot0();
      log.debug('🔍 UNIV3LP: Slot0 received from contract:', {
        tick: slot0.tick,
        sqrtPriceX96: slot0.sqrtPriceX96.toString(),
      });
      sqrtPriceX96 = new Big(slot0.sqrtPriceX96.toString());
      tick = Number(slot0.tick);
    }

    // 4) Convert ticks → sqrt bounds, then L → token amounts
    log.debug('🔍 UNIV3LP: Converting ticks to sqrt prices');
    const sqrtA = tickToSqrtPriceX96(tickLower);
    const sqrtB = tickToSqrtPriceX96(tickUpper);
    log.debug('🔍 UNIV3LP: Tick conversions:', {
      tickLower,
      tickUpper,
      sqrtA: sqrtA.toString(),
      sqrtB: sqrtB.toString(),
    });

    log.debug('🔍 UNIV3LP: Calculating token amounts from liquidity');
    const { amount0, amount1 } = amountsFromLiquidity(L, sqrtPriceX96, sqrtA, sqrtB);
    log.debug('🔍 UNIV3LP: Token amounts calculated:', {
      amount0: amount0.toString(),
      amount1: amount1.toString(),
    });

    // 5) Get token decimals
    log.debug('🔍 UNIV3LP: Getting token decimals');
    const d0 = await getErc20Decimals(ctx, token0);
    const d1 = await getErc20Decimals(ctx, token1);
    log.debug('🔍 UNIV3LP: Token decimals:', { token0: d0, token1: d1 });

    // 6) Resolve the single known token price
    const knownIs0 = tokenSelector === 'token0';
    const knownTokenAddr = knownIs0 ? token0 : token1;
    log.debug('🔍 UNIV3LP: Resolving known token price', { knownTokenAddr, knownIs0 });
    const knownResolved = await resolve(tokenFeed, knownTokenAddr, ctx);
    log.debug('🔍 UNIV3LP: Known token resolved:', { price: knownResolved.price });

    if (!knownResolved || knownResolved.price == null || !(knownResolved.price > 0)) {
      log.error('🔍 UNIV3LP: Failed to resolve known token price');
      return 0;
    }

    // 7) Derive the missing token price from sqrtPriceX96
    const P01 = priceToken0InToken1(sqrtPriceX96, d0, d1); // token1 per token0
    let p0usd: Big, p1usd: Big;
    if (knownIs0) {
      p0usd = Big(knownResolved.price);
      p1usd = p0usd.div(P01); // USD1 = USD0 / (token1 per token0)
    } else {
      p1usd = Big(knownResolved.price);
      p0usd = p1usd.times(P01); // USD0 = USD1 * (token1 per token0)
    }

    log.debug('🔍 UNIV3LP: Derived prices:', {
      p0usd: p0usd.toString(),
      p1usd: p1usd.toString(),
      P01: P01.toString(),
    });

    // 8) Compose USD value
    const amount0Decimal = amount0.div(Big(10).pow(d0));
    const amount1Decimal = amount1.div(Big(10).pow(d1));
    const valueUsd = amount0Decimal.times(p0usd).plus(amount1Decimal.times(p1usd));

    log.debug('🔍 UNIV3LP: Final calculation:', {
      amount0Decimal: amount0Decimal.toString(),
      amount1Decimal: amount1Decimal.toString(),
      p0usd: p0usd.toString(),
      p1usd: p1usd.toString(),
      valueUsd: valueUsd.toString(),
    });

    log.debug('🔍 UNIV3LP: Handler completed successfully, returning:', valueUsd.toNumber());
    return valueUsd.toNumber();
  } catch (error) {
    log.error(`🔍 UNIV3LP: Failed to price position ${ctx.asset}:`, error);
    log.debug('🔍 UNIV3LP: Handler failed, returning 0');
    return 0;
  }
};
