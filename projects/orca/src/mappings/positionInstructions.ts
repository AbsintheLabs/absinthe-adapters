import { logger } from '@absinthe/common';
import { OrcaInstructionData, PositionData } from '../utils/types';
import { PositionStorageService } from '../services/PositionStorageService';

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
    isActive: isActive(),
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
