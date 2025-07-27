import { Currency, HistoryWindow, logger, TimeWindowTrigger, Token } from '@absinthe/common';
import { BlockHeader, SwapData } from '../utils/interfaces/interfaces';
import { PositionStorageService } from './PositionStorageService';
import { PositionData, ProtocolStateUniswapV3 } from '../utils/interfaces/univ3Types';
import { BigDecimal } from '@subsquid/big-decimal';
import { getOptimizedTokenPrices } from '../utils/pricing';

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

  private async activatePosition(block: BlockHeader, positions: PositionData[]) {
    for (const position of positions) {
      position.isActive = 'true';
      position.lastUpdatedBlockTs = block.timestamp;
      position.lastUpdatedBlockHeight = block.height;
      await this.positionStorageService.updatePosition(position);

      console.log(`Started tracking position ${position.positionId}`);
    }
  }

  private async deactivatePosition(
    block: BlockHeader,
    positions: PositionData[],
    protocolStates: Map<string, ProtocolStateUniswapV3>,
    coingeckoApiKey: string,
    chainPlatform: string,
  ) {
    for (const position of positions) {
      position.isActive = 'false';
      let balanceWindow: HistoryWindow | null = null;

      const token0 = await this.positionStorageService.getToken(position.token0Id);
      const token1 = await this.positionStorageService.getToken(position.token1Id);
      if (!token0 || !token1) {
        logger.warn(`❌ Skipping position ${position.positionId} - missing token data:`, {
          token0Exists: !!token0,
          token0Id: position.token0Id,
        });
        return;
      }

      const depositedToken0 = position.depositedToken0;
      const depositedToken1 = position.depositedToken1;

      const oldAmount0 = BigDecimal(depositedToken0, token0.decimals).toNumber();
      const oldAmount1 = BigDecimal(depositedToken1, token1.decimals).toNumber();

      const [token0inUSD, token1inUSD] = await getOptimizedTokenPrices(
        position.poolId,
        token0,
        token1,
        block,
        coingeckoApiKey,
        chainPlatform,
      );

      const oldLiquidityUSD = oldAmount0 * token0inUSD + oldAmount1 * token1inUSD;

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
          tokens: {},
        };
      }
      position.lastUpdatedBlockTs = block.timestamp;
      position.lastUpdatedBlockHeight = block.height;
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

      await this.positionStorageService.updatePosition(position);

      console.log(`Stopped tracking position ${position.positionId}`);
    }
  }

  async handleIncreaseLiquidity(
    block: BlockHeader,
    data: IncDecData,
    amountMintedUSD: number,
    price0: number,
    price1: number,
    token0Decimals: number,
    token1Decimals: number,
  ) {
    const position = await this.positionStorageService.getPosition(data.tokenId);

    if (!position) return; //never true

    const depositedToken0 = position.depositedToken0; // 1*10^18 eth
    const depositedToken1 = position.depositedToken1; // 2000*10^6 usdc

    const oldAmount0 = BigDecimal(depositedToken0, token0Decimals).toNumber(); //1 eth
    const oldAmount1 = BigDecimal(depositedToken1, token1Decimals).toNumber(); //2000 usdc

    const oldLiquidityUSD = oldAmount0 * price0 + oldAmount1 * price1; //1*1000 + 2000*1000 = 2100000 usd

    position.depositedToken0 = (BigInt(depositedToken0) + data.amount0).toString(); //1+0.5 *10^18 eth
    position.depositedToken1 = (BigInt(depositedToken1) + data.amount1).toString(); //2000*10^6 + 1000*10^6 usdc

    const newAmount0 = BigDecimal(position.depositedToken0, token0Decimals).toNumber(); //1.5 eth
    const newAmount1 = BigDecimal(position.depositedToken1, token1Decimals).toNumber(); //3000 usdc

    const newLiquidityUSD = newAmount0 * price0 + newAmount1 * price1; //1.5*1000 + 3000*1000 = 3150000 usd
    await this.positionStorageService.updatePosition(position); //todo: reduce double calls

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
    amountBurnedUSD: number,
    price0: number,
    price1: number,
    token0Decimals: number,
    token1Decimals: number,
  ) {
    const position = await this.positionStorageService.getPosition(data.tokenId);
    if (!position) return;

    const depositedToken0 = position.depositedToken0; // 1.5 eth
    const depositedToken1 = position.depositedToken1; // 3000 usdc

    const oldAmount0 = BigDecimal(depositedToken0, token0Decimals).toNumber(); //1.5 eth
    const oldAmount1 = BigDecimal(depositedToken1, token1Decimals).toNumber(); //3000 usdc

    const oldLiquidityUSD = oldAmount0 * price0 + oldAmount1 * price1; //1.5*1000 + 3000*1000 = 3150000 usd

    position.depositedToken0 = (BigInt(depositedToken0) - data.amount0).toString(); //1.5-0.5 *10^18 eth
    position.depositedToken1 = (BigInt(depositedToken1) - data.amount1).toString(); //3000*10^6 - 1000*10^6 usdc

    const newAmount0 = BigDecimal(position.depositedToken0, token0Decimals).toNumber(); //1 eth
    const newAmount1 = BigDecimal(position.depositedToken1, token1Decimals).toNumber(); //2000 usdc

    const newLiquidityUSD = newAmount0 * price0 + newAmount1 * price1; //1*1000 + 2000*1000 = 2100000 usd
    await this.positionStorageService.updatePosition(position); //todo: reduce double calls

    if (BigInt(position.depositedToken0) === 0n && BigInt(position.depositedToken1) === 0n) {
      //if balance is 0, delete the position from tracking- just delete it
      await this.positionStorageService.deletePosition(data.tokenId);
      return;
    }

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

    const depositedToken0 = position.depositedToken0;
    const depositedToken1 = position.depositedToken1;

    const oldAmount0 = BigDecimal(depositedToken0, token0Decimals).toNumber();
    const oldAmount1 = BigDecimal(depositedToken1, token1Decimals).toNumber();

    const oldLiquidityUSD = oldAmount0 * price0 + oldAmount1 * price1;

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
      this.activatePosition(block, positionsToActivate),
      this.deactivatePosition(
        block,
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

    const historyWindow = {
      userAddress: position.owner,
      deltaAmount: deltaAmountUSD,
      trigger: trigger,
      startTs: position.lastUpdatedBlockTs,
      endTs: blockTimestamp,
      startBlockNumber: position.lastUpdatedBlockHeight,
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
