import { logger } from '@absinthe/common';
import { OrcaInstructionData, InitializeData } from '../utils/types';

export async function processTransferInstructions(
  instructionsData: OrcaInstructionData[],
  protocolStates: Map<string, any>,
): Promise<void> {
  logger.info(`🏊 [PoolInstructions] Processing ${instructionsData.length} pool instructions`);

  for (const data of instructionsData) {
    try {
      switch (data.type) {
        case 'transfer':
          await processTransfer(data as any, protocolStates);
          break;
        case 'transferChecked':
          await processTransferChecked(data as any, protocolStates);
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

async function processTransferChecked(data: any, protocolStates: Map<string, any>): Promise<void> {
  logger.info(`🏊 [PoolInstructions] Processing initialize pool V2`, {
    slot: data.slot,
    txHash: data.txHash,
  });

  logger.info(`🏊 [PoolInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });

  //todo: compare the mints and once we find, update the owner in the position
  //todo:udpate redis
}
