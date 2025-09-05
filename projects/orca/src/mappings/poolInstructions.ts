import { logger } from '@absinthe/common';
import { OrcaInstructionData, InitializeData } from '../utils/types';
import { LiquidityMathService } from '../services/LiquidityMathService';
import { PositionStorageService } from '../services/PositionStorageService';
import { getJupPrice, getTokenPrice } from '../utils/pricing';

export async function processPoolInstructions(
  instructionsData: OrcaInstructionData[],
  protocolStates: Map<string, any>,
  liquidityMathService: LiquidityMathService,
  positionStorageService: PositionStorageService,
): Promise<void> {
  logger.info(`🏊 [PoolInstructions] Processing ${instructionsData.length} pool instructions`);

  for (const data of instructionsData) {
    try {
      switch (data.type) {
        case 'initializePool':
          await processInitializePool(
            data as InitializeData,
            protocolStates,
            liquidityMathService,
            positionStorageService,
          );
          break;
        case 'initializePoolV2':
          await processInitializePoolV2(
            data as InitializeData,
            protocolStates,
            liquidityMathService,
            positionStorageService,
          );
          break;

        case 'initializePoolWithAdaptiveFee':
          await processInitializePoolWithAdaptiveFee(
            data as InitializeData,
            protocolStates,
            liquidityMathService,
            positionStorageService,
          );
          break;
      }
    } catch (error) {
      logger.error(`❌ [PoolInstructions] Failed to process ${data.type}:`, error);
    }
  }
}

async function processInitializePool(
  data: InitializeData,
  protocolStates: Map<string, any>,
  liquidityMathService: LiquidityMathService,
  positionStorageService: PositionStorageService,
): Promise<void> {
  logger.info(`🏊 [PoolInstructions] Processing initialize pool`, {
    slot: data.slot,
    txHash: data.txHash,
  });

  logger.info(`🏊 [PoolInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });

  const analysis = await analyseInitialization(data.decodedInstruction, liquidityMathService);
  await positionStorageService.storePool(analysis);
  logger.info(`🏊 [PoolInstructions] Analysis:`, {
    analysis,
  });
}

async function processInitializePoolV2(
  data: InitializeData,
  protocolStates: Map<string, any>,
  liquidityMathService: LiquidityMathService,
  positionStorageService: PositionStorageService,
): Promise<void> {
  logger.info(`🏊 [PoolInstructions] Processing initialize pool V2`, {
    slot: data.slot,
    txHash: data.txHash,
  });

  logger.info(`🏊 [PoolInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });

  const analysis = await analyseInitialization(data.decodedInstruction, liquidityMathService);
  await positionStorageService.storePool(analysis);
  logger.info(`🏊 [PoolInstructions] Analysis:`, {
    analysis,
  });
}

async function processInitializePoolWithAdaptiveFee(
  data: InitializeData,
  protocolStates: Map<string, any>,
  liquidityMathService: LiquidityMathService,
  positionStorageService: PositionStorageService,
): Promise<void> {
  logger.info(`🏊 [PoolInstructions] Processing initialize pool V2`, {
    slot: data.slot,
    txHash: data.txHash,
  });

  logger.info(`🏊 [PoolInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });

  const analysis = await analyseInitialization(data.decodedInstruction, liquidityMathService);
  await positionStorageService.storePool(analysis);
  logger.info(`🏊 [PoolInstructions] Analysis:`, {
    analysis,
  });
}

async function analyseInitialization(
  decodedInstruction: any,
  liquidityMathService: LiquidityMathService,
) {
  const token0Decimals = (await getTokenPrice(decodedInstruction.accounts.tokenMintA)).decimals;
  const token1Decimals = (await getTokenPrice(decodedInstruction.accounts.tokenMintB)).decimals;
  const currentTick = liquidityMathService.sqrtPriceX64ToTick(
    decodedInstruction.data.initialSqrtPrice,
  );

  return {
    poolId: decodedInstruction.accounts.whirlpool,
    whirlpoolConfig: decodedInstruction.accounts.whirlpoolsConfig,
    funder: decodedInstruction.accounts.funder,
    tokenVault0: decodedInstruction.accounts.tokenVaultA,
    tokenVault1: decodedInstruction.accounts.tokenVaultB,
    fee: getFeeTierInfo(decodedInstruction),
    tokenProgram: getTokenProgramInfo(decodedInstruction),
    systemProgram: decodedInstruction.accounts.systemProgram,
    tickSpacing: decodedInstruction.data.tickSpacing,
    // initialSqrtPrice: decodedInstruction.data.initialSqrtPrice,
    currentTick: currentTick,
    poolType: getPoolType(decodedInstruction),
    token0Id: decodedInstruction.accounts.tokenMintA,
    token1Id: decodedInstruction.accounts.tokenMintB,
    token0Decimals: token0Decimals,
    token1Decimals: token1Decimals,
  };
}

function getPoolType(decodedInstruction: any): string {
  if (decodedInstruction.accounts.initializePoolAuthority) {
    return 'adaptiveFee';
  } else if (decodedInstruction.accounts.tokenProgramA) {
    return 'v2';
  } else {
    return 'v1';
  }
}

function getTokenProgramInfo(decodedInstruction: any): string {
  if (decodedInstruction.accounts.tokenProgramA && decodedInstruction.accounts.tokenProgramB) {
    // V2 or Adaptive: Has separate programs for each token
    return decodedInstruction.accounts.tokenProgramA;
  } else if (decodedInstruction.accounts.tokenProgram) {
    // V1: Single token program
    return decodedInstruction.accounts.tokenProgram;
  } else {
    return 'unknown';
  }
}

function getFeeTierInfo(decodedInstruction: any): string {
  if (decodedInstruction.accounts.feeTier) {
    return decodedInstruction.accounts.feeTier;
  } else if (decodedInstruction.accounts.adaptiveFeeTier) {
    return 'adaptive'; // ← Adaptive fee pools don't have feeTier
  } else {
    return 'unknown';
  }
}
