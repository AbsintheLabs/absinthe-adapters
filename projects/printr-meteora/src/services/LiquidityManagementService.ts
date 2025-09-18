import { Currency, HistoryWindow, logger, TimeWindowTrigger } from '@absinthe/common';
import { PoolDetails, PositionDetails, ProtocolStateOrca } from '../utils/types';
import { PositionStorageService } from './PositionStorageService';
import { getOptimizedTokenPrices } from '../utils/pricing';
import { LiquidityMathService } from './LiquidityMathService';

async function activatePosition(
  slot: number,
  timestamp: number,
  currentTick: number,
  positions: PositionDetails[],
  pool: PoolDetails,
  positionStorageService: PositionStorageService,
) {
  for (const position of positions) {
    position.isActive = 'true';
    pool.currentTick = currentTick;
    position.lastUpdatedBlockTs = timestamp;
    position.lastUpdatedBlockHeight = slot;
    await positionStorageService.updatePosition(position);
    await positionStorageService.updatePool(pool);

    logger.info(`Started tracking position ${position.positionId}`);
  }
}

async function deactivatePosition(
  slot: number,
  timestamp: number,
  currentTick: number,
  positions: PositionDetails[],
  pool: PoolDetails,
  protocolStates: Map<string, ProtocolStateOrca>,
  positionStorageService: PositionStorageService,
  liquidityMathService: LiquidityMathService,
) {
  for (const position of positions) {
    let balanceWindow: HistoryWindow | null = null;

    if (!pool.token0Id || !pool.token1Id) {
      logger.warn(`❌ Skipping position ${position.positionId} - missing token data:`, {
        token0Exists: !!pool.token0Id,
        token0Id: pool.token0Id,
      });
      return;
    }

    const oldLiquidity = BigInt(position.liquidity);

    const { humanAmount0: oldHumanAmount0, humanAmount1: oldHumanAmount1 } =
      liquidityMathService.getAmountsForLiquidityRaw(
        oldLiquidity,
        position.tickLower,
        position.tickUpper,
        currentTick,
        pool.token0Decimals,
        pool.token1Decimals,
      );
    const [token0inUSD, token1inUSD] = await getOptimizedTokenPrices(
      position.poolId,
      { id: pool.token0Id, decimals: pool.token0Decimals },
      { id: pool.token1Id, decimals: pool.token1Decimals },
      timestamp,
      'solana',
    );

    const oldLiquidityUSD =
      Number(oldHumanAmount0) * token0inUSD + Number(oldHumanAmount1) * token1inUSD;

    if (oldLiquidityUSD !== 0 && position.lastUpdatedBlockTs) {
      balanceWindow = {
        userAddress: position.owner,
        deltaAmount: 0,
        trigger: TimeWindowTrigger.EXHAUSTED,
        startTs: position.lastUpdatedBlockTs,
        endTs: timestamp,
        windowDurationMs: 0,
        startBlockNumber: position.lastUpdatedBlockHeight,
        endBlockNumber: slot,
        txHash: null,
        currency: Currency.USD,
        valueUsd: Number(oldLiquidityUSD),
        balanceBefore: oldLiquidityUSD.toString(),
        balanceAfter: oldLiquidityUSD.toString(),
        tokenPrice: 0,
        tokenDecimals: 0,
        tokens: {
          isActive: {
            value: 'false',
            type: 'boolean',
          },
          currentTick: {
            value: currentTick.toString(),
            type: 'number',
          },
          tickLower: {
            value: position.tickLower.toString(),
            type: 'number',
          },
          tickUpper: {
            value: position.tickUpper.toString(),
            type: 'number',
          },
          liquidity: {
            value: position.liquidity.toString(),
            type: 'number',
          },
          token0Id: {
            value: pool.token0Id,
            type: 'string',
          },
          token1Id: {
            value: pool.token1Id,
            type: 'string',
          },
        },
      };
    }
    position.lastUpdatedBlockTs = timestamp;
    position.lastUpdatedBlockHeight = slot;
    position.isActive = 'false';
    pool.currentTick = currentTick;

    await positionStorageService.updatePosition(position);
    await positionStorageService.updatePool(pool);

    const poolState = protocolStates.get(position.poolId);

    if (poolState) {
      if (balanceWindow) {
        poolState.balanceWindows.push(balanceWindow);
      }
    } else {
      protocolStates.set(position.poolId, {
        balanceWindows: balanceWindow ? [balanceWindow] : [],
        transactions: [],
      });
    }

    logger.info(`Stopped tracking position ${position.positionId} ,at slot ${slot}`, {
      position,
    });
  }
}

export { activatePosition, deactivatePosition };
