import { logger } from '@absinthe/common';
import { OrcaInstructionData, FeeData, RewardData } from '../utils/types';

//todo: testing needed (ignore)
export async function processFeeInstructions(
  instructionsData: OrcaInstructionData[],
  protocolStates: Map<string, any>,
): Promise<void> {
  logger.info(`💰 [FeeInstructions] Processing ${instructionsData.length} fee instructions`);

  for (const data of instructionsData) {
    try {
      switch (data.type) {
        case 'collectFees':
          await processCollectFees(data as FeeData, protocolStates);
          break;
        case 'collectProtocolFees':
          await processCollectProtocolFees(data as FeeData, protocolStates);
          break;
        case 'collectReward':
          await processCollectReward(data as RewardData, protocolStates);
          break;
        case 'collectFeesV2':
          await processCollectFeesV2(data as FeeData, protocolStates);
          break;
        case 'collectProtocolFeesV2':
          await processCollectProtocolFeesV2(data as FeeData, protocolStates);
          break;
        case 'collectRewardV2':
          await processCollectRewardV2(data as RewardData, protocolStates);
          break;
      }
    } catch (error) {
      logger.error(`❌ [FeeInstructions] Failed to process ${data.type}:`, error);
    }
  }
}

async function processCollectFees(data: FeeData, protocolStates: Map<string, any>): Promise<void> {
  logger.info(`💸 [FeeInstructions] Processing collect fees`, {
    slot: data.slot,
    txHash: data.txHash,
  });
  logger.info(`🏊 [FeeInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });

  const analysis = analyseClaimedFeesByPosition(data.decodedInstruction);
  logger.info(`💸 [FeeInstructions] Fees analysis:`, {
    analysis,
  });

  //todo: update this in redis on position level
}

async function processCollectProtocolFees(
  data: FeeData,
  protocolStates: Map<string, any>,
): Promise<void> {
  logger.info(`🏛️ [FeeInstructions] Processing collect protocol fees`, {
    slot: data.slot,
    txHash: data.txHash,
  });
  logger.info(`🏊 [FeeInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });

  const analysis = analyseClaimedProtocolFeesByPool(data.decodedInstruction);
  logger.info(`🏛️ [FeeInstructions] Protocol fees analysis:`, {
    analysis,
  });

  //todo: update this in redis on pool level
}

async function processCollectReward(
  data: RewardData,
  protocolStates: Map<string, any>,
): Promise<void> {
  logger.info(`🎁 [FeeInstructions] Processing collect reward`, {
    slot: data.slot,
    txHash: data.txHash,
  });
  logger.info(`🏊 [FeeInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });

  const analysis = analyseClaimedRewardByPosition(data.decodedInstruction);
  logger.info(`🎁 [FeeInstructions] Reward analysis:`, {
    analysis,
  });

  //todo: update this in redis on position level
}

async function processCollectFeesV2(
  data: FeeData,
  protocolStates: Map<string, any>,
): Promise<void> {
  logger.info(`💸 [FeeInstructions] Processing collect fees V2`, {
    slot: data.slot,
    txHash: data.txHash,
  });
  logger.info(`🏊 [FeeInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });

  const analysis = analyseClaimedFeesByPosition(data.decodedInstruction);
  logger.info(`💸 [FeeInstructions] Fees analysis:`, {
    analysis,
  });

  //todo: update this in redis on position level
}

async function processCollectProtocolFeesV2(
  data: FeeData,
  protocolStates: Map<string, any>,
): Promise<void> {
  logger.info(`🏛️ [FeeInstructions] Processing collect protocol fees V2`, {
    slot: data.slot,
    txHash: data.txHash,
  });
  logger.info(`🏊 [FeeInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });
  const analysis = analyseClaimedProtocolFeesByPool(data.decodedInstruction);
  logger.info(`🏛️ [FeeInstructions] Protocol fees analysis:`, {
    analysis,
  });

  //todo: update this in redis on pool level
}

async function processCollectRewardV2(
  data: RewardData,
  protocolStates: Map<string, any>,
): Promise<void> {
  logger.info(`🎁 [FeeInstructions] Processing collect reward V2`, {
    slot: data.slot,
    txHash: data.txHash,
  });
  logger.info(`🏊 [FeeInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });

  const analysis = analyseClaimedRewardByPosition(data.decodedInstruction);
  logger.info(`🎁 [FeeInstructions] Reward analysis:`, {
    analysis,
  });

  //todo: update this in redis on position level
}

function analyseClaimedProtocolFeesByPool(decodedInstruction: any) {
  return {
    whirlpool: decodedInstruction.data.whirlpool,
    tokenVaultA: decodedInstruction.data.tokenVaultA,
    tokenVaultB: decodedInstruction.data.tokenVaultB,
    collectProtocolFeesAuthority: decodedInstruction.data.collectProtocolFeesAuthority,
    fees: decodedInstruction.unit, //todo: check if this is correct
  };
}

function analyseClaimedFeesByPosition(decodedInstruction: any) {
  return {
    whirlpool: decodedInstruction.data.whirlpool,
    tokenVaultA: decodedInstruction.data.tokenVaultA,
    tokenVaultB: decodedInstruction.data.tokenVaultB,
    collectFeesAuthority: decodedInstruction.data.collectFeesAuthority,
    fees: decodedInstruction.unit, //todo: check if this is correct
  };
}

function analyseClaimedRewardByPosition(decodedInstruction: any) {
  return {
    whirlpool: decodedInstruction.data.whirlpool,
    tokenVaultA: decodedInstruction.data.tokenVaultA,
    tokenVaultB: decodedInstruction.data.tokenVaultB,
    collectRewardAuthority: decodedInstruction.data.collectRewardAuthority,
    reward: decodedInstruction.unit, //todo: check if this is correct
  };
}
