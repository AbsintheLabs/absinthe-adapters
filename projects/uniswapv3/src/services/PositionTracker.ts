import { Currency, HistoryWindow, logger, TimeWindowTrigger, Token } from '@absinthe/common';
import { BlockHeader, SwapData } from '../utils/interfaces/interfaces';
import { PositionStorageService } from './PositionStorageService';
import { PositionData, ProtocolStateUniswapV3 } from '../utils/interfaces/univ3Types';
import { BigDecimal } from '@subsquid/big-decimal';
import { getOptimizedTokenPrices } from '../utils/pricing';
import { getAmountsForLiquidityRaw } from '../utils/liquidityMath';

interface IncDecData {
  tokenId: string;
  amount0: bigint;
  amount1: bigint;
  liquidity: bigint;
  transactionHash: string;
}

interface TransferData {
  tokenId: string;
  to: string;
  transactionHash: string;
}

export class PositionTracker {
  private positionStorageService: PositionStorageService;
  private windowDurationMs: number;

  constructor(positionStorageService: PositionStorageService, windowDurationMs: number) {
    this.positionStorageService = positionStorageService;
    this.windowDurationMs = windowDurationMs;
  }

  private async activatePosition(
    block: BlockHeader,
    currentTick: number,
    positions: PositionData[],
  ) {
    for (const position of positions) {
      position.isActive = 'true';
      position.currentTick = currentTick;
      position.lastUpdatedBlockTs = block.timestamp;
      position.lastUpdatedBlockHeight = block.height;
      await this.positionStorageService.updatePosition(position);

      console.log(`Started tracking position ${position.positionId}`);
    }
  }

  private async deactivatePosition(
    block: BlockHeader,
    currentTick: number,
    positions: PositionData[],
    protocolStates: Map<string, ProtocolStateUniswapV3>,
    coingeckoApiKey: string,
    chainPlatform: string,
  ) {
    for (const position of positions) {
      position.isActive = 'false';
      position.currentTick = currentTick;
      let balanceWindow: HistoryWindow | null = null;
      await this.positionStorageService.updatePosition(position); //todo: check-double

      const token0 = await this.positionStorageService.getToken(position.token0Id);
      const token1 = await this.positionStorageService.getToken(position.token1Id);
      if (!token0 || !token1) {
        logger.warn(`❌ Skipping position ${position.positionId} - missing token data:`, {
          token0Exists: !!token0,
          token0Id: position.token0Id,
        });
        return;
      }

      const oldLiquidity = BigInt(position.liquidity);

      const { humanAmount0: oldHumanAmount0, humanAmount1: oldHumanAmount1 } =
        getAmountsForLiquidityRaw(
          oldLiquidity,
          position.tickLower,
          position.tickUpper,
          position.currentTick,
          token0.decimals,
          token1.decimals,
        );
      const [token0inUSD, token1inUSD] = await getOptimizedTokenPrices(
        position.poolId,
        token0,
        token1,
        block,
        coingeckoApiKey,
        chainPlatform,
      );

      const oldLiquidityUSD =
        Number(oldHumanAmount0) * token0inUSD + Number(oldHumanAmount1) * token1inUSD;

      if (oldLiquidityUSD !== 0 && position.lastUpdatedBlockTs) {
        balanceWindow = {
          userAddress: position.owner,
          deltaAmount: 0,
          trigger: TimeWindowTrigger.EXHAUSTED,
          startTs: position.lastUpdatedBlockTs,
          endTs: block.timestamp,
          windowDurationMs: this.windowDurationMs,
          startBlockNumber: position.lastUpdatedBlockHeight,
          endBlockNumber: block.height,
          txHash: null,
          currency: Currency.USD,
          valueUsd: 0,
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
              value: position.token0Id,
              type: 'string',
            },
            token1Id: {
              value: position.token1Id,
              type: 'string',
            },
          },
        };
      }
      position.lastUpdatedBlockTs = block.timestamp;
      position.lastUpdatedBlockHeight = block.height;
      const poolState = protocolStates.get(position.poolId);
      await this.positionStorageService.updatePosition(position); //todo: check

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

      console.log(`Stopped tracking position ${position.positionId}`);
    }
  }

  async handleIncreaseLiquidity(
    block: BlockHeader,
    data: IncDecData,
    liquidityMinted: bigint,
    price0: number,
    price1: number,
    token0Decimals: number,
    token1Decimals: number,
  ) {
    const position = await this.positionStorageService.getPosition(data.tokenId);

    if (!position) return; //never true

    const oldLiquidity = BigInt(position.liquidity);
    position.liquidity = (BigInt(position.liquidity) + liquidityMinted).toString();

    const { humanAmount0: oldHumanAmount0, humanAmount1: oldHumanAmount1 } =
      getAmountsForLiquidityRaw(
        oldLiquidity,
        position.tickLower,
        position.tickUpper,
        position.currentTick,
        token0Decimals,
        token1Decimals,
      );
    const oldLiquidityUSD = Number(oldHumanAmount0) * price0 + Number(oldHumanAmount1) * price1;

    const { humanAmount0: newHumanAmount0, humanAmount1: newHumanAmount1 } =
      getAmountsForLiquidityRaw(
        BigInt(position.liquidity),
        position.tickLower,
        position.tickUpper,
        position.currentTick,
        token0Decimals,
        token1Decimals,
      );
    const newLiquidityUSD = Number(newHumanAmount0) * price0 + Number(newHumanAmount1) * price1;

    const { humanAmount0: amountMinted0, humanAmount1: amountMinted1 } = getAmountsForLiquidityRaw(
      liquidityMinted,
      position.tickLower,
      position.tickUpper,
      position.currentTick,
      token0Decimals,
      token1Decimals,
    );
    const amountMintedUSD = Number(amountMinted0) * price0 + Number(amountMinted1) * price1;

    await this.positionStorageService.updatePosition(position); //todo: reduce double calls
    logger.info(`💰 [Tracker] handleIncreaseLiquidity`, {
      price0,
      price1,
      liquidityMinted,
      oldHumanAmount0,
      oldHumanAmount1,
      oldLiquidityUSD,
      newHumanAmount0,
      newHumanAmount1,
      newLiquidityUSD,
      amountMinted0,
      amountMinted1,
      amountMintedUSD,
    });
    if (position.isActive === 'true') {
      const historyWindow = await this.flushLiquidityChange(
        position.positionId,
        oldLiquidityUSD.toString(),
        newLiquidityUSD.toString(),
        TimeWindowTrigger.TRANSFER, //.INCREASE
        block,
        data.transactionHash,
        amountMintedUSD,
        {
          positionNFTId: {
            value: position.positionId,
            type: 'string',
          },
          token0Decimals: {
            value: token0Decimals.toString(),
            type: 'number',
          },
          token0PriceUsd: {
            value: price0.toString(),
            type: 'number',
          },
          amount0: {
            value: data.amount0.toString(),
            type: 'number',
          },
          amount1: {
            value: data.amount1.toString(),
            type: 'number',
          },
          token1PriceUsd: {
            value: price1.toString(),
            type: 'number',
          },
          token1Decimals: {
            value: token1Decimals.toString(),
            type: 'number',
          },
          currentTick: {
            value: position.currentTick.toString(),
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
            value: liquidityMinted.toString(),
            type: 'number',
          },
          oldLiquidity: {
            value: oldLiquidity.toString(),
            type: 'number',
          },
          newLiquidity: {
            value: position.liquidity.toString(),
            type: 'number',
          },
        },
        'increase',
      );
      return historyWindow;
    } else {
      position.lastUpdatedBlockTs = block.timestamp;
      position.lastUpdatedBlockHeight = block.height;
      await this.positionStorageService.updatePosition(position);
      return null;
    }
  }

  async handleDecreaseLiquidity(
    block: BlockHeader,
    data: IncDecData,
    liquidityBurned: bigint,
    price0: number,
    price1: number,
    token0Decimals: number,
    token1Decimals: number,
  ) {
    const position = await this.positionStorageService.getPosition(data.tokenId);
    if (!position) return;

    const oldLiquidity = BigInt(position.liquidity);
    position.liquidity = (BigInt(position.liquidity) - liquidityBurned).toString();

    const { humanAmount0, humanAmount1 } = getAmountsForLiquidityRaw(
      oldLiquidity,
      position.tickLower,
      position.tickUpper,
      position.currentTick,
      token0Decimals,
      token1Decimals,
    );
    const oldLiquidityUSD = Number(humanAmount0) * price0 + Number(humanAmount1) * price1;

    const { humanAmount0: newHumanAmount0, humanAmount1: newHumanAmount1 } =
      getAmountsForLiquidityRaw(
        BigInt(position.liquidity),
        position.tickLower,
        position.tickUpper,
        position.currentTick,
        token0Decimals,
        token1Decimals,
      );
    const newLiquidityUSD = Number(newHumanAmount0) * price0 + Number(newHumanAmount1) * price1;

    const { humanAmount0: amountBurned0, humanAmount1: amountBurned1 } = getAmountsForLiquidityRaw(
      liquidityBurned,
      position.tickLower,
      position.tickUpper,
      position.currentTick,
      token0Decimals,
      token1Decimals,
    );

    const amountBurnedUSD = Number(amountBurned0) * price0 + Number(amountBurned1) * price1;

    await this.positionStorageService.updatePosition(position); //todo: reduce double calls
    // if (BigInt(position.liquidity) === 0n) {
    //   //if balance is 0, delete the position from tracking- just delete it
    //   await this.positionStorageService.deletePosition(data.tokenId);
    //   return;
    // }

    logger.info(`💰 [Tracker] handleDecreaseLiquidity`, {
      oldLiquidityUSD,
      price0,
      price1,
      humanAmount0,
      humanAmount1,
      oldLiquidity,
      liquidityBurned,
      amountBurnedUSD,
      newLiquidityUSD,
    });
    if (position.isActive === 'true') {
      const historyWindow = await this.flushLiquidityChange(
        position.positionId,
        oldLiquidityUSD.toString(),
        newLiquidityUSD.toString(),
        TimeWindowTrigger.TRANSFER, //.DECREASE
        block,
        data.transactionHash,
        amountBurnedUSD,
        {
          positionNFTId: {
            value: position.positionId,
            type: 'string',
          },
          token0Decimals: {
            value: token0Decimals.toString(),
            type: 'number',
          },
          token0PriceUsd: {
            value: price0.toString(),
            type: 'number',
          },
          amount0: {
            value: data.amount0.toString(),
            type: 'number',
          },
          amount1: {
            value: data.amount1.toString(),
            type: 'number',
          },
          token1PriceUsd: {
            value: price1.toString(),
            type: 'number',
          },
          token1Decimals: {
            value: token1Decimals.toString(),
            type: 'number',
          },
          currentTick: {
            value: position.currentTick.toString(),
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
          oldLiquidity: {
            value: oldLiquidity.toString(),
            type: 'number',
          },
          newLiquidity: {
            value: position.liquidity.toString(),
            type: 'number',
          },
          liquidity: {
            value: liquidityBurned.toString(),
            type: 'number',
          },
        },
        'decrease',
      );
      return historyWindow;
    } else {
      position.lastUpdatedBlockTs = block.timestamp;
      position.lastUpdatedBlockHeight = block.height;
      await this.positionStorageService.updatePosition(position);
      return null;
    }
  }

  async handleTransfer(
    block: BlockHeader,
    data: TransferData,
    price0: number,
    price1: number,
    token0Decimals: number,
    token1Decimals: number,
  ) {
    const position = await this.positionStorageService.getPosition(data.tokenId);

    if (!position) return;

    const oldLiquidity = BigInt(position.liquidity);

    const { humanAmount0, humanAmount1 } = getAmountsForLiquidityRaw(
      oldLiquidity,
      position.tickLower,
      position.tickUpper,
      position.currentTick,
      token0Decimals,
      token1Decimals,
    );
    const oldLiquidityUSD = Number(humanAmount0) * price0 + Number(humanAmount1) * price1;

    logger.info(`💰 [Tracker] handleTransfer`, {
      oldLiquidityUSD,
      price0,
      price1,
      humanAmount0,
      humanAmount1,
    });

    if (position.isActive === 'true') {
      const historyWindow = await this.flushLiquidityChange(
        position.positionId,
        oldLiquidityUSD.toString(),
        oldLiquidityUSD.toString(),
        TimeWindowTrigger.TRANSFER,
        block,
        data.transactionHash,
        0,
        {
          token0Decimals: {
            value: token0Decimals.toString(),
            type: 'number',
          },
          token1Decimals: {
            value: token1Decimals.toString(),
            type: 'number',
          },
          positionNFTId: {
            value: position.positionId,
            type: 'string',
          },
          token0PriceUsd: {
            value: price0.toString(),
            type: 'number',
          },
          token1PriceUsd: {
            value: price1.toString(),
            type: 'number',
          },
          currentTick: {
            value: position.currentTick.toString(),
            type: 'number',
          },
          token0Id: {
            value: position.token0Id,
            type: 'string',
          },
          token1Id: {
            value: position.token1Id,
            type: 'string',
          },
          tickLower: {
            value: position.tickLower.toString(),
            type: 'number',
          },
          tickUpper: {
            value: position.tickUpper.toString(),
            type: 'number',
          },
          oldLiquidity: {
            value: oldLiquidity.toString(),
            type: 'number',
          },
          newLiquidity: {
            value: position.liquidity.toString(),
            type: 'number',
          },
        },
        'transfer',
      );
      position.owner = data.to;
      await this.positionStorageService.updatePosition(position); //todo: remove two separate updatePosition calls
      return historyWindow;
    } else {
      position.lastUpdatedBlockTs = block.timestamp;
      position.lastUpdatedBlockHeight = block.height;
      position.owner = data.to;
      await this.positionStorageService.updatePosition(position);
      return null;
    }
  }

  async handleSwap(
    block: BlockHeader,
    data: SwapData,
    positions: PositionData[],
    protocolStates: Map<string, ProtocolStateUniswapV3>,
    coingeckoApiKey: string,
    chainPlatform: string,
  ) {
    const currentTick = data.tick;
    console.log(block.height, 'block.height');
    const positionsToActivate: PositionData[] = [];
    const positionsToDeactivate: PositionData[] = [];

    for (const position of positions) {
      const wasActive = position.isActive === 'true';
      const isNowActive = position.tickLower <= currentTick && position.tickUpper > currentTick;

      if (!wasActive && isNowActive) {
        positionsToActivate.push(position);
      } else if (wasActive && !isNowActive) {
        positionsToDeactivate.push(position);
      }
    }

    await Promise.all([
      this.activatePosition(block, currentTick, positionsToActivate),
      this.deactivatePosition(
        block,
        currentTick,
        positionsToDeactivate,
        protocolStates,
        coingeckoApiKey,
        chainPlatform,
      ),
    ]);
  }

  private async flushLiquidityChange(
    positionId: string,
    oldLiquidityUSD: string,
    newLiquidityUSD: string,
    trigger: TimeWindowTrigger,
    block: BlockHeader,
    transactionHash: string,
    deltaAmountUSD: number,
    tokens: { [key: string]: { value: string; type: string } },
    type?: string,
  ): Promise<HistoryWindow | null> {
    const position = await this.positionStorageService.getPosition(positionId);

    const blockTimestamp = block.timestamp;
    const blockHeight = block.height;

    if (!position) return null;

    // Handle cases where start timestamp or block number is 0
    const startTs =
      position.lastUpdatedBlockTs && position.lastUpdatedBlockTs > 0
        ? position.lastUpdatedBlockTs
        : blockTimestamp;
    const startBlockNumber =
      position.lastUpdatedBlockHeight && position.lastUpdatedBlockHeight > 0
        ? position.lastUpdatedBlockHeight
        : blockHeight;

    const historyWindow = {
      userAddress: position.owner,
      deltaAmount: deltaAmountUSD,
      trigger: trigger,
      startTs: startTs,
      endTs: blockTimestamp,
      startBlockNumber: startBlockNumber,
      endBlockNumber: blockHeight,
      txHash: transactionHash,
      windowDurationMs: this.windowDurationMs,
      valueUsd: deltaAmountUSD,
      balanceBefore: oldLiquidityUSD,
      balanceAfter: newLiquidityUSD,
      currency: Currency.USD,
      tokenPrice: 0, //todo: remove them
      tokenDecimals: 0, //todo:remove them,
      tokens: tokens,
      type: type || '',
    };

    position.lastUpdatedBlockTs = blockTimestamp;
    position.lastUpdatedBlockHeight = blockHeight;
    await this.positionStorageService.updatePosition(position);

    return historyWindow;
  }
}
