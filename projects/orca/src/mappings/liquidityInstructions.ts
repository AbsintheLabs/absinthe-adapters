import { Currency, HistoryWindow, logger, TimeWindowTrigger } from '@absinthe/common';
import { OrcaInstructionData, LiquidityData, PositionDetails, PoolDetails } from '../utils/types';
import { PositionStorageService } from '../services/PositionStorageService';
import { LiquidityMathService } from '../services/LiquidityMathService';
import { getOptimizedTokenPrices } from '../utils/pricing';

// Base class for liquidity operations
abstract class BaseLiquidityProcessor {
  protected positionStorageService: PositionStorageService;
  protected liquidityMathService: LiquidityMathService;

  constructor(
    liquidityMathService: LiquidityMathService,
    positionStorageService: PositionStorageService,
  ) {
    this.positionStorageService = positionStorageService; // Use the passed instance
    this.liquidityMathService = liquidityMathService;
  }

  abstract process(data: LiquidityData, protocolStates: Map<string, any>): Promise<void>;

  protected async getPositionDetails(position: string, whirlpool: string) {
    const positionDetails = await this.positionStorageService.getPosition(position, whirlpool);
    logger.info(`🏊 [GetPositionDetails] Position details:`, positionDetails);
    if (!positionDetails) {
      throw new Error(`Position not found: ${position} in whirlpool ${whirlpool}`);
    }
    return positionDetails;
  }

  protected async getPool(whirlpool: string) {
    const poolDetails = await this.positionStorageService.getPool(whirlpool);
    if (
      !poolDetails ||
      !poolDetails.token0Decimals ||
      !poolDetails.token1Decimals ||
      !poolDetails.token0Id ||
      !poolDetails.token1Id
    ) {
      throw new Error(`Pool details incomplete for whirlpool: ${whirlpool}`);
    }
    return poolDetails;
  }

  protected async getTokenPrices(whirlpool: string, token0: any, token1: any, timestamp: number) {
    return await getOptimizedTokenPrices(whirlpool, token0, token1, timestamp, 'solana');
  }

  protected calculateAmountsForLiquidity(
    liquidity: bigint,
    tickLower: number,
    tickUpper: number,
    currentTick: number,
    token0Decimals: number,
    token1Decimals: number,
  ) {
    return this.liquidityMathService.getAmountsForLiquidityRaw(
      liquidity,
      tickLower,
      tickUpper,
      currentTick,
      token0Decimals,
      token1Decimals,
    );
  }

  protected createHistoryWindow(
    data: LiquidityData,
    positionDetails: PositionDetails,
    poolDetails: PoolDetails,
    oldLiquidityUSD: number,
    newLiquidityUSD: number,
    amountMintedUSD: number,
    amountMinted0: number,
    amountMinted1: number,
    token0inUSD: number,
    token1inUSD: number,
    liquidityAmount: bigint,
    oldLiquidity: bigint,
    type: 'increase' | 'decrease',
  ) {
    const startTs =
      positionDetails.lastUpdatedBlockTs && positionDetails.lastUpdatedBlockTs > 0
        ? positionDetails.lastUpdatedBlockTs
        : data.timestamp;

    const startBlockNumber =
      positionDetails.lastUpdatedBlockHeight && positionDetails.lastUpdatedBlockHeight > 0
        ? positionDetails.lastUpdatedBlockHeight
        : data.slot;

    return {
      userAddress: positionDetails.owner,
      deltaAmount: amountMintedUSD,
      trigger: type === 'increase' ? TimeWindowTrigger.INCREASE : TimeWindowTrigger.DECREASE,
      startTs,
      endTs: data.timestamp,
      startBlockNumber,
      endBlockNumber: data.slot,
      txHash: data.txHash,
      windowDurationMs: 0, // TODO: fix this
      valueUsd: oldLiquidityUSD,
      balanceBefore: oldLiquidityUSD.toString(),
      balanceAfter: newLiquidityUSD.toString(),
      currency: Currency.USD,
      tokenPrice: null,
      tokenDecimals: null,
      tokens: {
        positionNFTId: { value: positionDetails.positionId, type: 'string' },
        token0Decimals: { value: poolDetails.token0Decimals.toString(), type: 'number' },
        token0PriceUsd: { value: token0inUSD.toString(), type: 'number' },
        amount0: { value: amountMinted0.toString(), type: 'number' },
        amount1: { value: amountMinted1.toString(), type: 'number' },
        token1PriceUsd: { value: token1inUSD.toString(), type: 'number' },
        token1Decimals: { value: poolDetails.token1Decimals.toString(), type: 'number' },
        currentTick: { value: poolDetails.currentTick.toString(), type: 'number' },
        tickLower: { value: positionDetails.tickLower.toString(), type: 'number' },
        tickUpper: { value: positionDetails.tickUpper.toString(), type: 'number' },
        liquidity: { value: liquidityAmount.toString(), type: 'number' },
        oldLiquidity: { value: oldLiquidity.toString(), type: 'number' },
        newLiquidity: { value: positionDetails.liquidity.toString(), type: 'number' },
      },
      type,
    };
  }

  protected updateProtocolState(
    protocolStates: Map<string, any>,
    poolId: string,
    historyWindow: any,
  ) {
    const poolState = protocolStates.get(poolId);
    if (poolState) {
      poolState.balanceWindows.push(historyWindow);
    } else {
      protocolStates.set(poolId, {
        balanceWindows: [historyWindow],
        transactions: [],
      });
      logger.info(`📊 [LiquidityProcessor] Added balance window for pool ${poolId}`);
    }
  }

  protected updatePositionTimestamps(positionDetails: any, data: LiquidityData) {
    positionDetails.lastUpdatedBlockTs = data.timestamp;
    positionDetails.lastUpdatedBlockHeight = data.slot;
    return this.positionStorageService.updatePosition(positionDetails);
  }
}

// Increase Liquidity Processor
class IncreaseLiquidityProcessor extends BaseLiquidityProcessor {
  async process(data: LiquidityData, protocolStates: Map<string, any>): Promise<void> {
    logger.info(`📈 [IncreaseLiquidity] Processing increase liquidity`, {
      slot: data.slot,
      txHash: data.txHash,
    });

    try {
      const { liquidityAmount, whirlpool, positionId } = this.analyseLiquidityEvents(
        data.decodedInstruction,
      );

      const positionDetails = await this.getPositionDetails(positionId, whirlpool);
      const poolDetails = await this.getPool(whirlpool);
      logger.info(`🏊 [IncreaseLiquidity] Position details:`, {
        positionDetails,
        poolDetails,
      });

      if (positionDetails.isActive !== 'true') {
        logger.warn(`⚠️ [IncreaseLiquidity] Position ${positionId} is not active`);
        return;
      }

      const oldLiquidity = BigInt(positionDetails.liquidity);
      const newLiquidity = oldLiquidity + liquidityAmount;
      positionDetails.liquidity = newLiquidity.toString();

      const [token0inUSD, token1inUSD] = await this.getTokenPrices(
        whirlpool,
        { id: poolDetails.token0Id, decimals: poolDetails.token0Decimals },
        { id: poolDetails.token1Id, decimals: poolDetails.token1Decimals },
        data.timestamp,
      );

      const oldAmounts = this.calculateAmountsForLiquidity(
        oldLiquidity,
        positionDetails.tickLower,
        positionDetails.tickUpper,
        poolDetails.currentTick,
        poolDetails.token0Decimals,
        poolDetails.token1Decimals,
      );

      const newAmounts = this.calculateAmountsForLiquidity(
        newLiquidity,
        positionDetails.tickLower,
        positionDetails.tickUpper,
        poolDetails.currentTick,
        poolDetails.token0Decimals,
        poolDetails.token1Decimals,
      );

      const mintedAmounts = this.calculateAmountsForLiquidity(
        liquidityAmount,
        positionDetails.tickLower,
        positionDetails.tickUpper,
        poolDetails.currentTick,
        poolDetails.token0Decimals,
        poolDetails.token1Decimals,
      );

      const oldLiquidityUSD =
        Number(oldAmounts.humanAmount0) * token0inUSD +
        Number(oldAmounts.humanAmount1) * token1inUSD;
      const newLiquidityUSD =
        Number(newAmounts.humanAmount0) * token0inUSD +
        Number(newAmounts.humanAmount1) * token1inUSD;
      const amountMintedUSD =
        Number(mintedAmounts.humanAmount0) * token0inUSD +
        Number(mintedAmounts.humanAmount1) * token1inUSD;

      // Update position
      await this.positionStorageService.updatePosition(positionDetails);

      // Create history window
      const historyWindow = this.createHistoryWindow(
        data,
        positionDetails,
        poolDetails,
        oldLiquidityUSD,
        newLiquidityUSD,
        amountMintedUSD,
        Number(mintedAmounts.humanAmount0),
        Number(mintedAmounts.humanAmount1),
        token0inUSD,
        token1inUSD,
        liquidityAmount,
        oldLiquidity,
        'increase',
      );

      // Update protocol state
      this.updateProtocolState(protocolStates, positionDetails.poolId, historyWindow);

      // Update timestamps
      await this.updatePositionTimestamps(positionDetails, data);

      logger.info(`📈 [IncreaseLiquidity] Successfully processed`, {
        position: positionDetails.positionId,
        oldLiquidity: oldLiquidity.toString(),
        newLiquidity: newLiquidity.toString(),
        amountMintedUSD,
      });
    } catch (error) {
      logger.error(`❌ [IncreaseLiquidity] Failed to process:`, error);
      throw error;
    }
  }

  private analyseLiquidityEvents(decodedInstruction: any) {
    logger.info(`🏊 [LiquidityDecodedInstruction] Decoded instruction:`, {
      decodedInstruction,
    });
    return {
      liquidityAmount: BigInt(decodedInstruction.data.liquidityAmount),
      whirlpool: decodedInstruction.accounts.whirlpool,
      positionId: decodedInstruction.accounts.position,
      positionTokenAccount: decodedInstruction.accounts.positionTokenAccount,
      positionAuthority: decodedInstruction.accounts.positionAuthority,
    };
  }
}

// Decrease Liquidity Processor
class DecreaseLiquidityProcessor extends BaseLiquidityProcessor {
  async process(data: LiquidityData, protocolStates: Map<string, any>): Promise<void> {
    logger.info(`📉 [DecreaseLiquidity] Processing decrease liquidity`, {
      slot: data.slot,
      txHash: data.txHash,
    });

    try {
      const { liquidityAmount, whirlpool, position } = this.analyseLiquidityEvents(
        data.decodedInstruction,
      );

      const positionDetails = await this.getPositionDetails(position, whirlpool);
      const poolDetails = await this.getPool(whirlpool);
      if (!poolDetails) {
        logger.warn(`⚠️ [DecreaseLiquidity] Pool details not found for whirlpool: ${whirlpool}`);
        return;
      }

      if (positionDetails.isActive !== 'true') {
        logger.warn(`⚠️ [DecreaseLiquidity] Position ${position} is not active`);
        return;
      }

      const oldLiquidity = BigInt(positionDetails.liquidity);
      const newLiquidity = oldLiquidity - liquidityAmount;

      if (newLiquidity < 0n) {
        logger.error(`❌ [DecreaseLiquidity] Cannot decrease more liquidity than available`);
        return;
      }

      positionDetails.liquidity = newLiquidity.toString();

      const [token0inUSD, token1inUSD] = await this.getTokenPrices(
        whirlpool,
        poolDetails.token0Id,
        poolDetails.token1Id,
        data.timestamp,
      );

      const oldAmounts = this.calculateAmountsForLiquidity(
        oldLiquidity,
        positionDetails.tickLower,
        positionDetails.tickUpper,
        poolDetails.currentTick,
        poolDetails.token0Decimals,
        poolDetails.token1Decimals,
      );

      const newAmounts = this.calculateAmountsForLiquidity(
        newLiquidity,
        positionDetails.tickLower,
        positionDetails.tickUpper,
        poolDetails.currentTick,
        poolDetails.token0Decimals,
        poolDetails.token1Decimals,
      );

      const removedAmounts = this.calculateAmountsForLiquidity(
        liquidityAmount,
        positionDetails.tickLower,
        positionDetails.tickUpper,
        poolDetails.currentTick,
        poolDetails.token0Decimals,
        poolDetails.token1Decimals,
      );

      const oldLiquidityUSD =
        Number(oldAmounts.humanAmount0) * token0inUSD +
        Number(oldAmounts.humanAmount1) * token1inUSD;
      const newLiquidityUSD =
        Number(newAmounts.humanAmount0) * token0inUSD +
        Number(newAmounts.humanAmount1) * token1inUSD;
      const amountRemovedUSD =
        Number(removedAmounts.humanAmount0) * token0inUSD +
        Number(removedAmounts.humanAmount1) * token1inUSD;

      // Update position
      await this.positionStorageService.updatePosition(positionDetails);

      // Create history window
      const historyWindow = this.createHistoryWindow(
        data,
        positionDetails,
        poolDetails,
        oldLiquidityUSD,
        newLiquidityUSD,
        amountRemovedUSD,
        Number(removedAmounts.humanAmount0),
        Number(removedAmounts.humanAmount1),
        token0inUSD,
        token1inUSD,
        liquidityAmount,
        oldLiquidity,
        'decrease',
      );

      // Update protocol state
      this.updateProtocolState(protocolStates, positionDetails.poolId, historyWindow);

      // Update timestamps
      await this.updatePositionTimestamps(positionDetails, data);

      logger.info(`📉 [DecreaseLiquidity] Successfully processed`, {
        position: positionDetails.positionId,
        oldLiquidity: oldLiquidity.toString(),
        newLiquidity: newLiquidity.toString(),
        amountRemovedUSD,
      });
    } catch (error) {
      logger.error(`❌ [DecreaseLiquidity] Failed to process:`, error);
      throw error;
    }
  }

  private analyseLiquidityEvents(decodedInstruction: any) {
    return {
      liquidityAmount: BigInt(decodedInstruction.data.liquidityAmount),
      whirlpool: decodedInstruction.accounts.whirlpool,
      position: decodedInstruction.accounts.position,
      positionTokenAccount: decodedInstruction.accounts.positionTokenAccount,
      positionAuthority: decodedInstruction.accounts.positionAuthority,
    };
  }
}

// V2 versions - extend the base processors
class IncreaseLiquidityV2Processor extends IncreaseLiquidityProcessor {
  async process(data: LiquidityData, protocolStates: Map<string, any>): Promise<void> {
    logger.info(`📈 [IncreaseLiquidityV2] Processing increase liquidity V2`, {
      slot: data.slot,
      txHash: data.txHash,
    });

    // V2 specific logic can be added here if needed
    await super.process(data, protocolStates);
  }

  protected createHistoryWindow(
    data: LiquidityData,
    positionDetails: PositionDetails,
    poolDetails: PoolDetails,
    oldLiquidityUSD: number,
    newLiquidityUSD: number,
    amountMintedUSD: number,
    amountMinted0: number,
    amountMinted1: number,
    token0inUSD: number,
    token1inUSD: number,
    liquidityAmount: bigint,
    oldLiquidity: bigint,
    type: 'increase' | 'decrease',
  ) {
    const baseWindow = super.createHistoryWindow(
      data,
      positionDetails,
      poolDetails,
      oldLiquidityUSD,
      newLiquidityUSD,
      amountMintedUSD,
      amountMinted0,
      amountMinted1,
      token0inUSD,
      token1inUSD,
      liquidityAmount,
      oldLiquidity,
      type,
    );

    return { ...baseWindow, type: 'increasev2' as any };
  }
}

class DecreaseLiquidityV2Processor extends DecreaseLiquidityProcessor {
  async process(data: LiquidityData, protocolStates: Map<string, any>): Promise<void> {
    logger.info(`📉 [DecreaseLiquidityV2] Processing decrease liquidity V2`, {
      slot: data.slot,
      txHash: data.txHash,
    });

    // V2 specific logic can be added here if needed
    await super.process(data, protocolStates);
  }

  protected createHistoryWindow(
    data: LiquidityData,
    positionDetails: PositionDetails,
    poolDetails: PoolDetails,
    oldLiquidityUSD: number,
    newLiquidityUSD: number,
    amountMintedUSD: number,
    amountMinted0: number,
    amountMinted1: number,
    token0inUSD: number,
    token1inUSD: number,
    liquidityAmount: bigint,
    oldLiquidity: bigint,
    type: 'increase' | 'decrease',
  ) {
    const baseWindow = super.createHistoryWindow(
      data,
      positionDetails,
      poolDetails,
      oldLiquidityUSD,
      newLiquidityUSD,
      amountMintedUSD,
      amountMinted0,
      amountMinted1,
      token0inUSD,
      token1inUSD,
      liquidityAmount,
      oldLiquidity,
      type,
    );

    return { ...baseWindow, type: 'decreasev2' as any };
  }
}

// Main orchestrator class
export class LiquidityInstructionsProcessor {
  private processors: Map<string, BaseLiquidityProcessor>;

  constructor(
    liquidityMathService: LiquidityMathService,
    positionStorageService: PositionStorageService,
  ) {
    this.processors = new Map<string, BaseLiquidityProcessor>([
      [
        'increaseLiquidity',
        new IncreaseLiquidityProcessor(liquidityMathService, positionStorageService),
      ],
      [
        'decreaseLiquidity',
        new DecreaseLiquidityProcessor(liquidityMathService, positionStorageService),
      ],
      [
        'increaseLiquidityV2',
        new IncreaseLiquidityV2Processor(liquidityMathService, positionStorageService),
      ],
      [
        'decreaseLiquidityV2',
        new DecreaseLiquidityV2Processor(liquidityMathService, positionStorageService),
      ],
    ]);
  }

  async processLiquidityInstructions(
    instructionsData: OrcaInstructionData[],
    protocolStates: Map<string, any>,
    liquidityMathService: LiquidityMathService,
  ): Promise<void> {
    logger.info(
      `💧 [LiquidityInstructions] Processing ${instructionsData.length} liquidity instructions`,
    );

    for (const data of instructionsData) {
      try {
        const processor = this.processors.get(data.type);
        if (processor) {
          await processor.process(data as LiquidityData, protocolStates);
        } else {
          logger.warn(`⚠️ [LiquidityInstructions] Unknown instruction type: ${data.type}`);
        }
      } catch (error) {
        logger.error(`❌ [LiquidityInstructions] Failed to process ${data.type}:`, error);
      }
    }
  }
}

// Legacy function for backward compatibility
export async function processLiquidityInstructions(
  instructionsData: OrcaInstructionData[],
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
  liquidityMathService: LiquidityMathService,
): Promise<void> {
  const processor = new LiquidityInstructionsProcessor(
    liquidityMathService,
    positionStorageService,
  );
  await processor.processLiquidityInstructions(
    instructionsData,
    protocolStates,
    liquidityMathService,
  );
}
