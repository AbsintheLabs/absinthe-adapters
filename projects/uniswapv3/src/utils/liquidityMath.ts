function tickToSqrtPriceX96(tick: number): bigint {
  const sqrtPrice = Math.pow(1.0001, tick / 2);
  return BigInt(Math.floor(sqrtPrice * Math.pow(2, 96)));
}

function getAmountsForLiquidityRaw(
  liquidity: bigint, // raw liquidity (integer, as on-chain)
  lowerTick: number,
  upperTick: number,
  currentTick: number,
  decimals0: number,
  decimals1: number,
): {
  rawAmount0: bigint;
  rawAmount1: bigint;
  humanAmount0: string;
  humanAmount1: string;
} {
  const sqrtPaX96 = tickToSqrtPriceX96(lowerTick);
  const sqrtPbX96 = tickToSqrtPriceX96(upperTick);
  const sqrtPX96 = tickToSqrtPriceX96(currentTick);

  let rawAmount0 = 0n;
  let rawAmount1 = 0n;

  if (currentTick <= lowerTick) {
    // All in token0
    rawAmount0 = (liquidity * ((1n << 96n) * (sqrtPbX96 - sqrtPaX96))) / (sqrtPaX96 * sqrtPbX96);
    rawAmount1 = 0n;
  } else if (currentTick >= upperTick) {
    // All in token1
    rawAmount0 = 0n;
    rawAmount1 = (liquidity * (sqrtPbX96 - sqrtPaX96)) / (1n << 96n);
  } else {
    // In range: both tokens
    rawAmount0 = (liquidity * ((1n << 96n) * (sqrtPbX96 - sqrtPX96))) / (sqrtPX96 * sqrtPbX96);
    rawAmount1 = (liquidity * (sqrtPX96 - sqrtPaX96)) / (1n << 96n);
  }

  // Convert to human-readable decimals
  const humanAmount0 = (Number(rawAmount0) / Math.pow(10, decimals0)).toString();
  const humanAmount1 = (Number(rawAmount1) / Math.pow(10, decimals1)).toString();

  return {
    rawAmount0,
    rawAmount1,
    humanAmount0,
    humanAmount1,
  };
}

export { getAmountsForLiquidityRaw };
