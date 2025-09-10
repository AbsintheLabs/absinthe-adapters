import { logger } from '@absinthe/common';
import { OrcaInstructionData, BundledPositionData, PositionBundleMeta } from '../utils/types';
import { PositionStorageService } from '../services/PositionStorageService';
import { LiquidityMathService } from '../services/LiquidityMathService';

export async function processBundlePositionInstructions(
  instructionsData: OrcaInstructionData[],
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
  liquidityMathService: LiquidityMathService,
): Promise<void> {
  logger.info(`📦 [BundleInstructions] Processing ${instructionsData.length} bundle instructions`);

  for (const data of instructionsData) {
    try {
      switch (data.type) {
        case 'initializePositionBundle':
          await processInitializePositionBundle(
            data as BundledPositionData,
            protocolStates,
            positionStorageService,
          );
          break;
        case 'initializePositionBundleWithMetadata':
          await processInitializePositionBundleWithMetadata(
            data as BundledPositionData,
            protocolStates,
            positionStorageService,
          );
          break;
        case 'deletePositionBundle':
          await processDeletePositionBundle(
            data as BundledPositionData,
            protocolStates,
            positionStorageService,
          );
          break;
        case 'openBundledPosition':
          await processOpenBundledPosition(
            data as BundledPositionData,
            protocolStates,
            positionStorageService,
          );
          break;
        case 'closeBundledPosition':
          await processCloseBundledPosition(
            data as BundledPositionData,
            protocolStates,
            positionStorageService,
          );
          break;
      }
    } catch (error) {
      logger.error(`❌ [BundleInstructions] Failed to process ${data.type}:`, error);
    }
  }
}

async function processInitializePositionBundle(
  data: BundledPositionData,
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
): Promise<void> {
  logger.info(`📦 [BundleInstructions] Processing initialize position bundle`, {
    slot: data.slot,
    txHash: data.txHash,
  });

  const { positionBundle, positionBundleMint, owner } = analyzeInitializePositionBundle(
    data.decodedInstruction,
  );

  const bundleMeta: PositionBundleMeta = {
    bundleId: positionBundle,
    positionBundleMint: positionBundleMint,
    owner: owner,
    lastUpdatedBlockTs: data.timestamp,
    lastUpdatedBlockHeight: data.slot,
  };

  await positionStorageService.storePositionBundle(bundleMeta);

  logger.info(`📦 [BundleInstructions] Position bundle initialized:`, {
    bundleId: positionBundle,
    owner,
  });
}

async function processInitializePositionBundleWithMetadata(
  data: BundledPositionData,
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
): Promise<void> {
  logger.info(`📦 [BundleInstructions] Processing initialize position bundle with metadata`, {
    slot: data.slot,
    txHash: data.txHash,
  });

  const { positionBundle, positionBundleMint, owner } = analyzeInitializePositionBundleWithMetadata(
    data.decodedInstruction,
  );

  const bundleMeta: PositionBundleMeta = {
    bundleId: positionBundle,
    positionBundleMint: positionBundleMint,
    owner: owner,
    lastUpdatedBlockTs: data.timestamp,
    lastUpdatedBlockHeight: data.slot,
  };

  await positionStorageService.storePositionBundle(bundleMeta);

  logger.info(`📦 [BundleInstructions] Position bundle with metadata initialized:`, {
    bundleId: positionBundle,
    owner,
  });
}

async function processDeletePositionBundle(
  data: BundledPositionData,
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
): Promise<void> {
  logger.info(`📦 [BundleInstructions] Processing delete position bundle`, {
    slot: data.slot,
    txHash: data.txHash,
  });

  const { positionBundle } = analyzeDeletePositionBundle(data.decodedInstruction);

  await positionStorageService.deletePositionBundle(positionBundle);

  logger.info(`📦 [BundleInstructions] Position bundle deleted:`, {
    bundleId: positionBundle,
  });
}

async function processOpenBundledPosition(
  data: BundledPositionData,
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
): Promise<void> {
  logger.info(`📦 [BundleInstructions] Processing open bundled position`, {
    slot: data.slot,
    txHash: data.txHash,
  });

  const { positionBundle, position, whirlpool, tickLowerIndex, tickUpperIndex, owner } =
    analyzeOpenBundledPosition(data.decodedInstruction);

  //todo: find the positionMint

  const positionMint = '';

  // Get the pool to determine if position is active
  const pool = await positionStorageService.getPool(whirlpool);
  if (!pool) {
    throw new Error(`Pool not found: ${whirlpool}`);
  }

  const isActive =
    pool.currentTick >= tickLowerIndex && pool.currentTick < tickUpperIndex ? 'true' : 'false';

  const positionDetails = {
    positionId: position,
    positionMint: positionMint,
    owner: owner,
    liquidity: '0', // Initial liquidity is 0
    tickLower: tickLowerIndex,
    tickUpper: tickUpperIndex,
    poolId: whirlpool,
    isActive: isActive,
    tokenProgram: '', // Will be set when liquidity is added
    lastUpdatedBlockTs: data.timestamp,
    lastUpdatedBlockHeight: data.slot,
  };

  await positionStorageService.storePositionWithBundle(positionDetails, positionBundle);

  logger.info(`📦 [BundleInstructions] Bundled position opened:`, {
    positionId: position,
    bundleId: positionBundle,
    whirlpool,
    tickRange: `[${tickLowerIndex}, ${tickUpperIndex}]`,
    isActive,
  });
}

async function processCloseBundledPosition(
  data: BundledPositionData,
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
): Promise<void> {
  logger.info(`📦 [BundleInstructions] Processing close bundled position`, {
    slot: data.slot,
    txHash: data.txHash,
  });

  const { position, positionBundle } = analyzeCloseBundledPosition(data.decodedInstruction);

  await positionStorageService.deletePosition(position);

  logger.info(`📦 [BundleInstructions] Bundled position closed:`, {
    positionId: position,
    bundleId: positionBundle,
  });
}

// Analysis functions for decoding instructions
function analyzeInitializePositionBundle(decodedInstruction: any) {
  return {
    positionBundle: decodedInstruction.accounts.positionBundle,
    positionBundleMint: decodedInstruction.accounts.positionBundleMint,
    owner: decodedInstruction.accounts.owner,
  };
}

function analyzeInitializePositionBundleWithMetadata(decodedInstruction: any) {
  return {
    positionBundle: decodedInstruction.accounts.positionBundle,
    positionBundleMint: decodedInstruction.accounts.positionBundleMint,
    owner: decodedInstruction.accounts.owner,
  };
}

function analyzeDeletePositionBundle(decodedInstruction: any) {
  return {
    positionBundle: decodedInstruction.accounts.positionBundle,
  };
}

function analyzeOpenBundledPosition(decodedInstruction: any) {
  return {
    positionBundle: decodedInstruction.accounts.positionBundle,
    position: decodedInstruction.accounts.bundledPosition,
    whirlpool: decodedInstruction.accounts.whirlpool,
    tickLowerIndex: decodedInstruction.data.tickLowerIndex,
    tickUpperIndex: decodedInstruction.data.tickUpperIndex,
    owner: decodedInstruction.accounts.owner,
  };
}

function analyzeCloseBundledPosition(decodedInstruction: any) {
  return {
    position: decodedInstruction.accounts.bundledPosition,
    positionBundle: decodedInstruction.accounts.positionBundle,
  };
}
