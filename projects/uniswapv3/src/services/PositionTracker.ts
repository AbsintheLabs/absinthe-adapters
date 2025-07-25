import { Currency, HistoryWindow, TimeWindowTrigger } from '@absinthe/common';
import { BlockHeader, SwapData } from '../utils/interfaces/interfaces';
import { PositionStorageService } from './PositionStorageService';
import { PositionData, ProtocolStateUniswapV3 } from '../utils/interfaces/univ3Types';

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
  ) {
    for (const position of positions) {
      position.isActive = 'false';
      let balanceWindow: HistoryWindow | null = null;
      if (position.liquidity !== '0' && position.lastUpdatedBlockTs) {
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
          valueUsd: Number(position.liquidity), // TODO: Calculate USD value
          balanceBefore: position.liquidity,
          balanceAfter: position.liquidity,
          tokenPrice: 0, // TODO: Calculate token price
          tokenDecimals: 0, // TODO: Get from position
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

  async handleIncreaseLiquidity(block: BlockHeader, data: IncDecData, amountMintedUSD: number) {
    const position = await this.positionStorageService.getPosition(data.tokenId);

    if (!position) {
      //this case is already handled and should never happen
      console.log(`Position ${data.tokenId} not found case reached`);
    } else {
      const oldLiquidity = position.liquidity;
      position.liquidity = (BigInt(position.liquidity) + data.liquidity).toString();

      if (position.isActive) {
        const historyWindow = await this.flushLiquidityChange(
          position.positionId,
          oldLiquidity,
          data.liquidity.toString(),
          TimeWindowTrigger.TRANSFER, //.INCREASE
          block,
          data.transactionHash,
          amountMintedUSD,
        );
        return historyWindow;
      } else {
        position.lastUpdatedBlockTs = block.timestamp;
        position.lastUpdatedBlockHeight = block.height;
        await this.positionStorageService.updatePosition(position);
      }
    }
    return null;
  }

  async handleDecreaseLiquidity(block: BlockHeader, data: IncDecData, amountBurnedUSD: number) {
    const position = await this.positionStorageService.getPosition(data.tokenId);
    if (!position) return;

    const oldLiquidity = position.liquidity;
    //todo: watch the sign if its correct or not
    const newLiquidity = (BigInt(oldLiquidity) - data.liquidity).toString();
    position.liquidity = newLiquidity;

    if (BigInt(newLiquidity) === 0n) {
      //if balance is 0, delete the position from tracking- just delete it
      await this.positionStorageService.deletePosition(data.tokenId);
      return;
    }

    if (position.isActive) {
      const historyWindow = await this.flushLiquidityChange(
        position.positionId,
        oldLiquidity,
        data.liquidity.toString(),
        TimeWindowTrigger.TRANSFER, //.DECREASE
        block,
        data.transactionHash,
        amountBurnedUSD,
      );
      return historyWindow;
    } else {
      position.lastUpdatedBlockTs = block.timestamp;
      position.lastUpdatedBlockHeight = block.height;
      await this.positionStorageService.updatePosition(position);

      return null;
    }
  }

  async handleTransfer(block: BlockHeader, data: TransferData) {
    const position = await this.positionStorageService.getPosition(data.tokenId);

    if (!position) return;

    if (position.isActive) {
      const historyWindow = await this.flushLiquidityChange(
        position.positionId,
        position.liquidity,
        '0', //in case of transfer, the liquidity delta is 0
        TimeWindowTrigger.TRANSFER,
        block,
        data.transactionHash,
        0,
      );
      //todo: in this case also update the owner to be 0xaddress
      return historyWindow;
    } else {
      position.lastUpdatedBlockTs = block.timestamp;
      position.lastUpdatedBlockHeight = block.height;
      position.owner = data.to;
      await this.positionStorageService.updatePosition(position);
      return null;
    }

    //todo: maybe we should just delete the position here
  }

  async handleSwap(
    block: BlockHeader,
    data: SwapData,
    positions: PositionData[],
    protocolStates: Map<string, ProtocolStateUniswapV3>,
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
      this.deactivatePosition(block, positionsToDeactivate, protocolStates),
    ]);
  }

  private async flushLiquidityChange(
    positionId: string,
    oldLiquidity: string,
    liquidity: string,
    trigger: TimeWindowTrigger,
    block: BlockHeader,
    transactionHash: string,
    deltaAmountUSD: number,
  ): Promise<HistoryWindow | null> {
    const position = await this.positionStorageService.getPosition(positionId);

    const blockTimestamp = block.timestamp;
    const blockHeight = block.height;

    if (!position) return null;
    //todo: uncomment this later on for sure 100%
    if (oldLiquidity === '0') return null;

    const historyWindow = {
      userAddress: position.owner,
      deltaAmount: deltaAmountUSD,
      trigger: trigger,
      startTs: position.lastUpdatedBlockTs,
      endTs: blockTimestamp,
      startBlockNumber: position.lastUpdatedBlockHeight,
      endBlockNumber: blockHeight,
      txHash: transactionHash,
      windowDurationMs: this.windowDurationMs, // todo: pass in case of exhausted
      valueUsd: Number(oldLiquidity), //todo: make it usd value
      balanceBefore: oldLiquidity.toString(),
      balanceAfter: position.liquidity.toString(),
      currency: Currency.USD,
      tokenPrice: 0, //todo: remove them
      tokenDecimals: 0, //todo:remove them
    };

    position.lastUpdatedBlockTs = blockTimestamp;
    position.lastUpdatedBlockHeight = blockHeight;
    await this.positionStorageService.updatePosition(position);

    return historyWindow;
  }
}
