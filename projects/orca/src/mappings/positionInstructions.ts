import { logger } from '@absinthe/common';
import { OrcaInstructionData, PositionData } from '../utils/types';

// todo: we will be rewarding the owner and not the positionAuthority
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
): Promise<void> {
  logger.info(
    `🎯 [PositionInstructions] Processing ${instructionsData.length} position instructions`,
  );

  for (const data of instructionsData) {
    try {
      switch (data.type) {
        case 'openPosition':
          await processOpenPosition(data as PositionData, protocolStates);
          break;
        case 'closePosition':
          await processClosePosition(data as PositionData, protocolStates);
          break;
        case 'openPositionWithTokenExtensions':
          await processOpenPositionWithTokenExtensions(data as PositionData, protocolStates);
          break;
        case 'closePositionWithTokenExtensions':
          await processClosePositionWithTokenExtensions(data as PositionData, protocolStates);
          break;
        case 'openPositionWithMetadata':
          await processOpenPositionWithMetadata(data as PositionData, protocolStates);
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
): Promise<void> {
  logger.info(`🔓 [PositionInstructions] Processing open position`, {
    slot: data.slot,
    txHash: data.txHash,
  });
  logger.info(`🏊 [PositionInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });
  const analysis = analyzeOpenPosition(data.decodedInstruction);
  logger.info(`🏊 [PositionInstructions] Position analysis:`, {
    analysis,
  });
  //todo: add this to redis tracking
}

async function processClosePosition(
  data: PositionData,
  protocolStates: Map<string, any>,
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
  logger.info(`🏊 [PositionInstructions] Position analysis:`, {
    position,
    positionMint,
    positionTokenAccount,
  });

  //todo: delete this from redis tracking using positionPDA
}

async function processOpenPositionWithTokenExtensions(
  data: PositionData,
  protocolStates: Map<string, any>,
): Promise<void> {
  logger.info(`🔓 [PositionInstructions] Processing open position with token extensions`, {
    slot: data.slot,
    txHash: data.txHash,
  });
  logger.info(`🏊 [PositionInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });
  const analysis = analyzeOpenPosition(data.decodedInstruction);
  logger.info(`🏊 [PositionInstructions] Position analysis:`, {
    analysis,
  });

  //todo: add this to redis tracking
}

async function processClosePositionWithTokenExtensions(
  data: PositionData,
  protocolStates: Map<string, any>,
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
  logger.info(`🏊 [PositionInstructions] Position analysis:`, {
    position,
    positionMint,
    positionTokenAccount,
  });

  //todo: delete this from redis tracking using positionPDA
}

async function processOpenPositionWithMetadata(
  data: PositionData,
  protocolStates: Map<string, any>,
): Promise<void> {
  logger.info(`🔓 [PositionInstructions] Processing open position with metadata`, {
    slot: data.slot,
    txHash: data.txHash,
  });
  logger.info(`🏊 [PositionInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });
  const analysis = analyzeOpenPosition(data.decodedInstruction);
  logger.info(`🏊 [PositionInstructions] Position analysis:`, {
    analysis,
  });

  //todo: add this to redis tracking
}

function analyzeOpenPosition(decodedInstruction: any) {
  const currentTick = () => {};
  const isTickInRange = () => {}; //todo: implement - call data function from pool hashmap
  return {
    position: decodedInstruction.accounts.position,
    positionMint: decodedInstruction.accounts.positionMint,
    positionTokenAccount: decodedInstruction.accounts.positionTokenAccount,

    whirlpool: decodedInstruction.accounts.whirlpool,

    tickLower: decodedInstruction.data.tickLowerIndex,
    tickUpper: decodedInstruction.data.tickUpperIndex,
    tickRange: decodedInstruction.data.tickUpperIndex - decodedInstruction.data.tickLowerIndex,
    isTickInRange: isTickInRange(),

    tokenProgram:
      decodedInstruction.accounts.tokenProgram || decodedInstruction.accounts.token2022Program,
    systemProgram: decodedInstruction.accounts.systemProgram,
    //todo: check can we add liquidity in the position Initialization step ?
    // => NO, because I think its because its only added in the first step of increaseLiquidity
    // Why is it important => because I am setting it = 0
    liquidity: 0,

    funder: decodedInstruction.accounts.funder,
    owner: decodedInstruction.accounts.owner,
  };
}

function analyseClosePosition(decodedInstruction: any) {
  return {
    position: decodedInstruction.accounts.position,
    positionMint: decodedInstruction.accounts.positionMint,
    positionTokenAccount: decodedInstruction.accounts.positionTokenAccount,
  };
}
