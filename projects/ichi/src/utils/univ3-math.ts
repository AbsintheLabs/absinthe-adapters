// Uniswap v3 math utilities for position valuation
// Mirrors LiquidityAmounts.getAmountsForLiquidity and SqrtPriceMath.getAmount{0,1}Delta

import Big from 'big.js';

// Constants from Uniswap v3
const Q96 = new Big(2).pow(96);
const MAX_UINT256 = new Big(2).pow(256).minus(1);

export interface AmountsFromLiquidityParams {
  liquidity: string; // uint128
  sqrtPriceX96: string; // uint160
  tickLower: number;
  tickUpper: number;
}

export interface TokenAmounts {
  amount0: string;
  amount1: string;
}

/**
 * Calculate token amounts for a given liquidity and price range
 * Mirrors Uniswap v3 LiquidityAmounts.getAmountsForLiquidity
 */
export function amountsFromLiquidity(params: AmountsFromLiquidityParams): TokenAmounts {
  const { liquidity, sqrtPriceX96, tickLower, tickUpper } = params;

  const L = new Big(liquidity);
  const sqrtPrice = new Big(sqrtPriceX96).div(Q96);

  // Calculate sqrt ratios for tick bounds
  const sqrtRatioLower = tickToSqrtRatio(tickLower);
  const sqrtRatioUpper = tickToSqrtRatio(tickUpper);

  let amount0 = new Big(0);
  let amount1 = new Big(0);

  if (sqrtPrice.lt(sqrtRatioLower)) {
    // Current price < lower bound, only token0 is needed
    amount0 = getAmount0Delta(sqrtRatioLower, sqrtRatioUpper, L);
  } else if (sqrtPrice.lt(sqrtRatioUpper)) {
    // Current price between bounds, both tokens needed
    amount0 = getAmount0Delta(sqrtPrice, sqrtRatioUpper, L);
    amount1 = getAmount1Delta(sqrtRatioLower, sqrtPrice, L);
  } else {
    // Current price > upper bound, only token1 is needed
    amount1 = getAmount1Delta(sqrtRatioLower, sqrtRatioUpper, L);
  }

  return {
    amount0: amount0.toFixed(0), // Return as string to avoid precision loss
    amount1: amount1.toFixed(0),
  };
}

/**
 * Convert tick to sqrt price ratio
 * Mirrors TickMath.getSqrtRatioAtTick
 */
function tickToSqrtRatio(tick: number): Big {
  const absTick = Math.abs(tick);

  let ratio = new Big(2).pow(128);
  if (absTick & 0x1) ratio = ratio.times('7923212382335979915').div(Q96); // ≈ 1.0000499987502499
  if (absTick & 0x2) ratio = ratio.times('792120104710355840').div(Q96); // ≈ 1.0000999999999999
  if (absTick & 0x4) ratio = ratio.times('792069855166840540').div(Q96); // ≈ 1.0001999999999999
  if (absTick & 0x8) ratio = ratio.times('79196777275495480').div(Q96); // ≈ 1.0003999999999999
  if (absTick & 0x10) ratio = ratio.times('7917522517213440').div(Q96); // ≈ 1.0007999999999999
  if (absTick & 0x20) ratio = ratio.times('7914897498588060').div(Q96); // ≈ 1.0015999999999999
  if (absTick & 0x40) ratio = ratio.times('791021805733710').div(Q96); // ≈ 1.0031999999999999
  if (absTick & 0x80) ratio = ratio.times('789570887755580').div(Q96); // ≈ 1.0063999999999999
  if (absTick & 0x100) ratio = ratio.times('785950558253770').div(Q96); // ≈ 1.0128
  if (absTick & 0x200) ratio = ratio.times('778844919210280').div(Q96); // ≈ 1.0255999999999999
  if (absTick & 0x400) ratio = ratio.times('764911936058560').div(Q96); // ≈ 1.0512
  if (absTick & 0x800) ratio = ratio.times('736907686946860').div(Q96); // ≈ 1.1024
  if (absTick & 0x1000) ratio = ratio.times('673173808894080').div(Q96); // ≈ 1.2048
  if (absTick & 0x2000) ratio = ratio.times('571810880528000').div(Q96); // ≈ 1.4096
  if (absTick & 0x4000) ratio = ratio.times('430560967572000').div(Q96); // ≈ 1.8192
  if (absTick & 0x8000) ratio = ratio.times('257110087081000').div(Q96); // ≈ 2.56
  if (absTick & 0x10000) ratio = ratio.times('129195948557000').div(Q96); // ≈ 4.096
  if (absTick & 0x20000) ratio = ratio.times('64775213692000').div(Q96); // ≈ 8.192
  if (absTick & 0x40000) ratio = ratio.times('32369205936000').div(Q96); // ≈ 16.384

  if (tick > 0) {
    ratio = MAX_UINT256.div(ratio);
  }

  return ratio;
}

/**
 * Calculate amount0 delta between two sqrt price ratios
 * Mirrors SqrtPriceMath.getAmount0Delta
 */
function getAmount0Delta(sqrtRatioA: Big, sqrtRatioB: Big, liquidity: Big): Big {
  const numerator = liquidity.times(Q96).times(sqrtRatioB.minus(sqrtRatioA));
  const denominator = sqrtRatioB.times(sqrtRatioA);
  return numerator.div(denominator);
}

/**
 * Calculate amount1 delta between two sqrt price ratios
 * Mirrors SqrtPriceMath.getAmount1Delta
 */
function getAmount1Delta(sqrtRatioA: Big, sqrtRatioB: Big, liquidity: Big): Big {
  return liquidity.times(sqrtRatioB.minus(sqrtRatioA)).div(Q96);
}
