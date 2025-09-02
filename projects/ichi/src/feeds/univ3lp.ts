import { HandlerFactory } from './interface';
import Big from 'big.js';
import { log } from '../utils/logger';
import assert from 'assert';

// ABIs
import * as univ3poolAbi from '../abi/univ3pool';
import * as univ3positionsAbi from '../abi/univ3nonfungiblepositionmanager';
import * as univ3factoryAbi from '../abi/univ3factory';
import * as erc20Abi from '../abi/erc20';

// Handler name constant for Uniswap v3 LP pricing
const UNIV3_LP_HANDLER = 'univ3lp';

// ---------- math helpers (Q64.96) ----------
const Q96 = Big(2).pow(96);

function tickToSqrtPriceX96(tick: number): Big {
  // sqrtPriceX96 = 2^96 * sqrt(1.0001^tick)
  // Use high-precision Big; for speed you can port TickMath constants later.
  const base = Big(1.0001);
  // Big.js approximation for now - replace with TickMath constants for production
  const pow = Big(Math.pow(1.0001, tick));
  return pow.sqrt().times(Q96);
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
      token0: labels.token0,
      token1: labels.token1,
      fee: Number(labels.fee),
      tickLower: Number(labels.tickLower),
      tickUpper: Number(labels.tickUpper),
      pool: labels.pool,
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

        if (!poolAddress || poolAddress === '0x0000000000000000000000000000000000000000') {
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

  // 3) Read pool price state (slot0)
  log.debug('🔍 UNIV3LP: Reading pool price state (slot0)');
  try {
    const poolContract = new univ3poolAbi.Contract(ctx.sqdRpcCtx, pool);
    log.debug('🔍 UNIV3LP: Calling poolContract.slot0()');
    const slot0 = await poolContract.slot0();
    log.debug('🔍 UNIV3LP: Slot0 received:', {
      tick: slot0.tick,
      sqrtPriceX96: slot0.sqrtPriceX96.toString(),
    });
    const sqrtPriceX96 = new Big(slot0.sqrtPriceX96.toString());

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

    // 5) Recurse to USD using existing engine
    log.debug('🔍 UNIV3LP: Resolving token0 price');
    const token0Resolved = await resolve(token0Feed, token0, ctx);
    log.debug('🔍 UNIV3LP: Token0 resolved:', { price: token0Resolved.price });

    log.debug('🔍 UNIV3LP: Resolving token1 price');
    const token1Resolved = await resolve(token1Feed, token1, ctx);
    log.debug('🔍 UNIV3LP: Token1 resolved:', { price: token1Resolved.price });

    // Get token decimals
    log.debug('🔍 UNIV3LP: Getting token metadata');
    const token0Metadata = await ctx.metadataCache.get(token0);
    const token1Metadata = await ctx.metadataCache.get(token1);

    let d0, d1;
    if (!token0Metadata) {
      log.error(`🔍 UNIV3LP: Token ${token0} not found in metadata cache`);
      const erc20Contract = new erc20Abi.Contract(ctx.sqdRpcCtx, token0);
      const token0d = await erc20Contract.decimals();
      d0 = Number(token0d.toString());
      await ctx.metadataCache.set(token0, { decimals: d0 });
    }
    if (!token1Metadata) {
      log.error(`🔍 UNIV3LP: Token ${token1} not found in metadata cache`);
      const erc20Contract = new erc20Abi.Contract(ctx.sqdRpcCtx, token1);
      const token1d = await erc20Contract.decimals();
      d1 = Number(token1d.toString());
      await ctx.metadataCache.set(token1, { decimals: d1 });
    }
    assert(d0 !== undefined, 'Token0 decimals are undefined');
    assert(d1 !== undefined, 'Token1 decimals are undefined');

    log.debug('🔍 UNIV3LP: Token decimals:', { token0: d0, token1: d1 });

    // 6) Compose USD value
    const amount0Decimal = amount0.div(Big(10).pow(d0)).toNumber();
    const amount1Decimal = amount1.div(Big(10).pow(d1)).toNumber();
    const valueUsd = amount0Decimal * token0Resolved.price + amount1Decimal * token1Resolved.price;

    log.debug('🔍 UNIV3LP: Final calculation:', {
      amount0Decimal,
      amount1Decimal,
      token0Price: token0Resolved.price,
      token1Price: token1Resolved.price,
      valueUsd,
    });

    log.debug('🔍 UNIV3LP: Handler completed successfully, returning:', valueUsd);
    return valueUsd;
  } catch (error) {
    log.error(`🔍 UNIV3LP: Failed to price position ${ctx.asset}:`, error);
    log.debug('🔍 UNIV3LP: Handler failed, returning 0');
    return 0;
  }
};
