import { logger } from '@absinthe/common';
import { OrcaInstructionData, PositionData, PositionDetails } from '../utils/types';
import { PositionStorageService } from '../services/PositionStorageService';
import { activatePosition, deactivatePosition } from '../services/LiquidityManagementService';
import { LiquidityMathService } from '../services/LiquidityMathService';

// NOTE: we will be rewarding the owner and not the positionAuthority
// “Holding” a position is defined in ORCA by owning the position-NFT.

// 	- The NFT is a normal SPL-token whose owner field changes whenever it is transferred.
// 	- Whoever appears as the NFT’s owner in the token account (or in the metadata, if using a compressed NFT) is the party that legally “possesses” the position.
// -
// positionAuthority is only the signer allowed to manage liquidity.

// 	- It can be delegated, rotated, or even set to a program-derived address (PDA) that multiple wallets control.
// 	- A bot could be the authority while the treasury multisig owns the NFT.
// 	- If you reward the authority, an operator could farm rewards by rotating authorities without transferring real ownership.

export async function processPositionInstructions(
  instructionsData: OrcaInstructionData[],
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
  liquidityMathService: LiquidityMathService,
): Promise<void> {
  logger.info(
    `🎯 [PositionInstructions] Processing ${instructionsData.length} position instructions`,
  );

  for (const data of instructionsData) {
    try {
      switch (data.type) {
        case 'openPosition':
          await processOpenPosition(data as PositionData, protocolStates, positionStorageService);
          break;
        case 'closePosition':
          await processClosePosition(data as PositionData, protocolStates, positionStorageService);
          break;
        case 'openPositionWithTokenExtensions':
          await processOpenPositionWithTokenExtensions(
            data as PositionData,
            protocolStates,
            positionStorageService,
          );
          break;
        case 'closePositionWithTokenExtensions':
          await processClosePositionWithTokenExtensions(
            data as PositionData,
            protocolStates,
            positionStorageService,
          );
          break;
        case 'openPositionWithMetadata':
          await processOpenPositionWithMetadata(
            data as PositionData,
            protocolStates,
            positionStorageService,
          );
          break;

        case 'resetPositionRange':
          await processResetPositionRange(
            data as PositionData,
            protocolStates,
            positionStorageService,
            liquidityMathService,
          );
          break;
        case 'transferLockedPosition':
          await processTransferLockedPosition(
            data as PositionData,
            protocolStates,
            positionStorageService,
          );
          break;
        case 'lockPosition':
          await processLockPosition(data as PositionData, protocolStates, positionStorageService);
          break;
      }
    } catch (error) {
      logger.error(`❌ [PositionInstructions] Failed to process ${data.type}:`, error);
    }
  }
}

async function processOpenPosition(
  data: PositionData,
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
): Promise<void> {
  logger.info(`🔓 [PositionInstructions] Processing open position`, {
    slot: data.slot,
    txHash: data.txHash,
  });
  logger.info(`🏊 [PositionInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });
  const positionData = await analyzeOpenPosition(
    data.decodedInstruction,
    data.slot,
    data.timestamp,
    positionStorageService,
  );
  await positionStorageService.storePosition(positionData);

  logger.info(`🏊 [PositionInstructions] Position stored:`, {
    positionData,
  });
}

async function processClosePosition(
  data: PositionData,
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
): Promise<void> {
  logger.info(`🔒 [PositionInstructions] Processing close position`, {
    slot: data.slot,
    txHash: data.txHash,
  });
  logger.info(`🏊 [PositionInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });

  const { position, positionMint, positionTokenAccount } = analyseClosePosition(
    data.decodedInstruction,
  );

  await positionStorageService.deletePosition(position);
  logger.info(`🏊 [PositionInstructions] Position deleted:`, {
    position,
    positionMint,
    positionTokenAccount,
  });
}

async function processOpenPositionWithTokenExtensions(
  data: PositionData,
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
): Promise<void> {
  logger.info(`🔓 [PositionInstructions] Processing open position with token extensions`, {
    slot: data.slot,
    txHash: data.txHash,
  });
  logger.info(`🏊 [PositionInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });
  const positionData = await analyzeOpenPosition(
    data.decodedInstruction,
    data.slot,
    data.timestamp,
    positionStorageService,
  );
  await positionStorageService.storePosition(positionData);
  logger.info(`🏊 [PositionInstructions] Position stored:`, {
    positionData,
  });
}

async function processClosePositionWithTokenExtensions(
  data: PositionData,
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
): Promise<void> {
  logger.info(`🔒 [PositionInstructions] Processing close position with token extensions`, {
    slot: data.slot,
    txHash: data.txHash,
  });
  logger.info(`🏊 [PositionInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });

  const { position, positionMint, positionTokenAccount } = analyseClosePosition(
    data.decodedInstruction,
  );
  await positionStorageService.deletePosition(position);
  logger.info(`🏊 [PositionInstructions] Position deleted:`, {
    position,
    positionMint,
    positionTokenAccount,
  });
}

async function processOpenPositionWithMetadata(
  data: PositionData,
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
): Promise<void> {
  logger.info(`🔓 [PositionInstructions] Processing open position with metadata`, {
    slot: data.slot,
    txHash: data.txHash,
  });
  logger.info(`🏊 [PositionInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });
  const positionData = await analyzeOpenPosition(
    data.decodedInstruction,
    data.slot,
    data.timestamp,
    positionStorageService,
  );
  await positionStorageService.storePosition(positionData);
  logger.info(`🏊 [PositionInstructions] Position stored:`, {
    positionData,
  });
}

async function processResetPositionRange(
  data: PositionData,
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
  liquidityMathService: LiquidityMathService,
): Promise<void> {
  logger.info(`🔄 [PositionInstructions] Processing reset position range`, {
    slot: data.slot,
    txHash: data.txHash,
  });

  const { position, positionMint, whirlpool, tickLowerIndex, tickUpperIndex } =
    analyseResetPositionRange(data.decodedInstruction);

  logger.info(`🏊 [ResetPositionRangeInstructions] Reset position range:`, {
    position,
    positionMint,
    whirlpool,
    tickLowerIndex,
    tickUpperIndex,
  });

  const positionDetails = await positionStorageService.getPosition(position, whirlpool);

  if (!positionDetails) {
    throw new Error(`Position not found: ${position} in whirlpool ${whirlpool}`);
  }

  const pool = await positionStorageService.getPool(whirlpool);
  if (!pool) {
    throw new Error(`Pool not found: ${whirlpool}`);
  }

  //todo: uncomment
  // const newIsActive =
  //   pool.currentTick >= tickLowerIndex && pool.currentTick < tickUpperIndex ? 'true' : 'false';

  // Update the position with new tick range
  await positionStorageService.updatePosition({
    ...positionDetails,
    tickLower: tickLowerIndex,
    tickUpper: tickUpperIndex,
    isActive: 'true', //todo: uncomment
    lastUpdatedBlockTs: data.timestamp,
    lastUpdatedBlockHeight: data.slot,
  });

  const positionsToActivate: PositionDetails[] = [];
  const positionsToDeactivate: PositionDetails[] = [];

  // Get all positions in this pool (including the one we just updated)
  const allPositions = await positionStorageService.getAllPositionsByPoolId(whirlpool);

  for (const pos of allPositions) {
    const wasActive = pos.isActive === 'true';
    const isNowActive = pos.tickLower <= pool.currentTick && pos.tickUpper > pool.currentTick;

    if (!wasActive && isNowActive) {
      positionsToActivate.push(pos);
    } else if (wasActive && !isNowActive) {
      positionsToDeactivate.push(pos);
    }
  }

  // Process activation/deactivation
  //todo: uncomment
  // await Promise.all([
  //   activatePosition(
  //     data.slot,
  //     data.timestamp,
  //     pool.currentTick,
  //     positionsToActivate,
  //     pool,
  //     positionStorageService,
  //   ),
  //   deactivatePosition(
  //     data.slot,
  //     data.timestamp,
  //     pool.currentTick,
  //     positionsToDeactivate,
  //     pool,
  //     protocolStates,
  //     positionStorageService,
  //     liquidityMathService,
  //   ),
  // ]);

  logger.info(`🔄 [ResetPositionRange] Processed position range reset for ${position}`, {
    newTickRange: `[${tickLowerIndex}, ${tickUpperIndex}]`,
    newIsActive: 'true', //todo: uncomment
    positionsActivated: positionsToActivate.length,
    positionsDeactivated: positionsToDeactivate.length,
  });
}

async function processTransferLockedPosition(
  data: PositionData,
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
): Promise<void> {
  logger.info(`🔄 [PositionInstructions] Processing transfer locked position`, {
    slot: data.slot,
    txHash: data.txHash,
  });

  const { position, whirlpool, receiver, positionMint } = analyseTransferLockedPosition(
    data.decodedInstruction,
  );
  const positionDetails = await positionStorageService.getPosition(position, whirlpool);

  if (!positionDetails) {
    throw new Error(`Position not found: ${position} in whirlpool ${whirlpool}`);
  }

  await positionStorageService.updatePosition({
    ...positionDetails,
    owner: receiver,
    positionMint: positionMint,
    lastUpdatedBlockTs: data.timestamp,
    lastUpdatedBlockHeight: data.slot,
  });

  logger.info(`🏊 [TransferLockedPositionInstructions] Transfer locked position:`, {
    position,
    positionMint,
    whirlpool,
    receiver,
  });
}

async function processLockPosition(
  data: PositionData,
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
): Promise<void> {
  logger.info(`🔄 [PositionInstructions] Processing lock position`, {
    slot: data.slot,
    txHash: data.txHash,
  });

  const { position, positionMint, whirlpool, lockType } = analyseLockPosition(
    data.decodedInstruction,
  );

  logger.info(`🏊 [LockPositionInstructions] Lock position:`, {
    position,
    positionMint,
    whirlpool,
    lockType,
  });
}

async function analyzeOpenPosition(
  decodedInstruction: any,
  slot: number,
  timestamp: number,
  positionStorageService: PositionStorageService,
) {
  //note: do we need current tick logic, after we have already fetched it in the pool initialization step ?
  // => No, we can use the current tick from the pool initialization step (only place to worry is if we have swaps between the pool init and open position (as maybe some other position exists))

  const pool = await positionStorageService.getPool(decodedInstruction.accounts.whirlpool);
  const currentTick = pool?.currentTick; //note :can never be null

  const isActive = () => {
    if (!currentTick) {
      return 'false';
    }
    if (
      currentTick > decodedInstruction.data.tickLowerIndex &&
      currentTick < decodedInstruction.data.tickUpperIndex
    ) {
      return 'true';
    }
    return 'false';
  };

  return {
    positionId: decodedInstruction.accounts.position,
    positionMint: decodedInstruction.accounts.positionMint,
    // positionTokenAccount: decodedInstruction.accounts.positionTokenAccount,
    poolId: decodedInstruction.accounts.whirlpool,
    tickLower: decodedInstruction.data.tickLowerIndex,
    tickUpper: decodedInstruction.data.tickUpperIndex,
    isActive: 'true', //todo: change to isActive()
    tokenProgram:
      decodedInstruction.accounts.tokenProgram || decodedInstruction.accounts.token2022Program,
    liquidity: '0',
    owner: decodedInstruction.accounts.owner,
    lastUpdatedBlockTs: timestamp,
    lastUpdatedBlockHeight: slot,
  };
}

function analyseClosePosition(decodedInstruction: any) {
  return {
    position: decodedInstruction.accounts.position,
    positionMint: decodedInstruction.accounts.positionMint,
    positionTokenAccount: decodedInstruction.accounts.positionTokenAccount,
  };
}

function analyseResetPositionRange(decodedInstruction: any) {
  return {
    position: decodedInstruction.accounts.position,
    positionMint: decodedInstruction.accounts.positionMint,
    whirlpool: decodedInstruction.accounts.whirlpool,
    tickLowerIndex: decodedInstruction.data.newTickLowerIndex,
    tickUpperIndex: decodedInstruction.data.newTickUpperIndex,
  };
}

function analyseLockPosition(decodedInstruction: any) {
  return {
    position: decodedInstruction.accounts.position,
    positionMint: decodedInstruction.accounts.positionMint,
    whirlpool: decodedInstruction.accounts.whirlpool,
    lockType: decodedInstruction.data.lockType,
  };
}

function analyseTransferLockedPosition(decodedInstruction: any) {
  return {
    position: decodedInstruction.accounts.position,
    positionMint: decodedInstruction.accounts.positionMint,
    whirlpool: decodedInstruction.accounts.whirlpool,
    receiver: decodedInstruction.accounts.receiver,
    positionTokenAccount: decodedInstruction.accounts.positionTokenAccount,
    destinationTokenAccount: decodedInstruction.accounts.destinationTokenAccount,
    positionAuthority: decodedInstruction.accounts.positionAuthority,
  };
}
