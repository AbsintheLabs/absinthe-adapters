import { Currency, HistoryWindow, logger, TimeWindowTrigger } from '@absinthe/common';
import { OrcaInstructionData, InitializeData } from '../utils/types';
import { PositionStorageService } from '../services/PositionStorageService';
import { getOptimizedTokenPrices } from '../utils/pricing';
import { LiquidityMathService } from '../services/LiquidityMathService';

export async function processTransferInstructions(
  instructionsData: OrcaInstructionData[],
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
  liquidityMathService: LiquidityMathService,
): Promise<void> {
  logger.info(`🏊 [PoolInstructions] Processing ${instructionsData.length} pool instructions`);

  for (const data of instructionsData) {
    try {
      switch (data.type) {
        case 'transfer':
          await processTransfer(data as any, protocolStates);
          break;
        case 'transferChecked':
          await processTransferChecked(
            data as any,
            protocolStates,
            positionStorageService,
            liquidityMathService,
          );
          break;
      }
    } catch (error) {
      logger.error(`❌ [PoolInstructions] Failed to process ${data.type}:`, error);
    }
  }
}

async function processTransfer(data: any, protocolStates: Map<string, any>): Promise<void> {
  logger.info(`🏊 [PoolInstructions] Processing initialize pool`, {
    slot: data.slot,
    txHash: data.txHash,
  });

  logger.info(`🏊 [PoolInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });

  //todo: find the mint in the source - tested in the other repo
  //todo: compare the mints and once we find, update the owner in the position
  //todo: update redis
}

async function processTransferChecked(
  data: any,
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
  liquidityMathService: LiquidityMathService,
): Promise<void> {
  logger.info(`🏊 [PoolInstructions] Processing initialize pool V2`, {
    slot: data.slot,
    txHash: data.txHash,
  });

  //todo: bundlemints are also preincluded, but make sure to change the owner of positionbundle , and not only limiting to bundlePosition

  const tokenMint = data.decodedInstruction.accounts.tokenMint;
  logger.info(`🏊 [TransferChecked Instruction Activity] Token mint:`, {
    tokenMint,
  });

  const sourceBalance = data.tokenBalances?.find(
    (balance: any) => balance.account === data.decodedInstruction.accounts.source,
  );
  const destinationBalance = data.tokenBalances?.find(
    (balance: any) => balance.account === data.decodedInstruction.accounts.destination,
  );

  if (sourceBalance?.preMint) {
    const positions = await positionStorageService.getAllPositions();
    logger.info(`🏊 [TransferChecked Instruction Activity] Positions:`, {
      positions,
    });

    const position = positions.find((position) => position.positionMint === tokenMint);
    logger.info(`🏊 [TransferChecked Instruction Activity] Position:`, {
      position,
    });
    if (!position) {
      return; // Just ignore if position not found
    }

    if (position.isActive != 'true') {
      logger.info(`🏊 [TransferChecked Instruction Activity] Position is not active`, {
        position,
      });
      return;
    }

    const pool = await positionStorageService.getPool(position?.poolId);
    const oldLiquidity = BigInt(position.liquidity);

    const { humanAmount0: oldHumanAmount0, humanAmount1: oldHumanAmount1 } =
      liquidityMathService.getAmountsForLiquidityRaw(
        oldLiquidity,
        position.tickLower,
        position.tickUpper,
        pool?.currentTick as number,
        pool?.token0Decimals as number,
        pool?.token1Decimals as number,
      );

    const [token0inUSD, token1inUSD] = await getOptimizedTokenPrices(
      position.poolId,
      { id: pool?.token0Id || '', decimals: pool?.token0Decimals || 0 },
      { id: pool?.token1Id || '', decimals: pool?.token1Decimals || 0 },
      data.timestamp,
      'solana',
    );

    const oldLiquidityUSD =
      Number(oldHumanAmount0) * token0inUSD + Number(oldHumanAmount1) * token1inUSD;

    let balanceWindow: HistoryWindow | null = null;

    if (oldLiquidityUSD !== 0 && position.lastUpdatedBlockTs) {
      balanceWindow = {
        userAddress: position.owner,
        deltaAmount: 0,
        trigger: TimeWindowTrigger.TRANSFER,
        startTs: position.lastUpdatedBlockTs,
        endTs: data.timestamp,
        windowDurationMs: 0,
        startBlockNumber: position.lastUpdatedBlockHeight,
        endBlockNumber: data.slot,
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
          destinationOwner: {
            value: destinationBalance?.postOwner || destinationBalance?.preOwner,
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
          liquidity: {
            value: position.liquidity.toString(),
            type: 'number',
          },
          token0Id: {
            value: pool?.token0Id || '',
            type: 'string',
          },
          token1Id: {
            value: pool?.token1Id || '',
            type: 'string',
          },
        },
      };
    }
    position.lastUpdatedBlockTs = data.timestamp;
    position.lastUpdatedBlockHeight = data.slot;
    position.owner = destinationBalance?.postOwner || destinationBalance?.preOwner;

    await positionStorageService.updatePosition(position);

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

    logger.info(`Stopped tracking position ${position.positionId} ,at slot ${data.slot}`, {
      position,
    });
    // Log the match
    logger.info(`🎯 [TransferChecked] Found position match for transfer`, {
      tokenMint,
      oldOwner: position.owner,
      newOwner: destinationBalance?.postOwner || destinationBalance?.preOwner,
      slot: data.slot,
      txHash: data.txHash,
    });
  }
}
