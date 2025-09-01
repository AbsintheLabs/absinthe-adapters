import { logger } from '@absinthe/common';
import { OrcaInstructionData, LiquidityData } from '../utils/types';

export async function processLiquidityInstructions(
  instructionsData: OrcaInstructionData[],
  protocolStates: Map<string, any>,
): Promise<void> {
  logger.info(
    `💧 [LiquidityInstructions] Processing ${instructionsData.length} liquidity instructions`,
  );

  for (const data of instructionsData) {
    try {
      switch (data.type) {
        case 'increaseLiquidity':
          await processIncreaseLiquidity(data as LiquidityData, protocolStates);
          break;
        case 'decreaseLiquidity':
          await processDecreaseLiquidity(data as LiquidityData, protocolStates);
          break;
        case 'increaseLiquidityV2':
          await processIncreaseLiquidityV2(data as LiquidityData, protocolStates);
          break;
        case 'decreaseLiquidityV2':
          await processDecreaseLiquidityV2(data as LiquidityData, protocolStates);
          break;
      }
    } catch (error) {
      logger.error(`❌ [LiquidityInstructions] Failed to process ${data.type}:`, error);
    }
  }
}

async function processIncreaseLiquidity(
  data: LiquidityData,
  protocolStates: Map<string, any>,
): Promise<void> {
  logger.info(`📈 [LiquidityInstructions] Processing increase liquidity`, {
    slot: data.slot,
    txHash: data.txHash,
  });

  logger.info(`🏊 [LiquidityInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });

  const analysis = analyseLiquidityEvents(data.decodedInstruction);
  logger.info(`🏊 [LiquidityInstructions] Liquidity analysis:`, {
    analysis,
  });

  //todo: in redis tracking, check if the whirlpool exists
  // if it does, check if the position exists
  // if it does, check if its in range
  // if it does, update the liquidity (simple addition)

  //todo: flush balance_interval => simillar to univ3 approach}
  //todo: pricing straightforward calculation for ticks <> liquidity math
  //todo: finally push in protocolState
}

async function processDecreaseLiquidity(
  data: LiquidityData,
  protocolStates: Map<string, any>,
): Promise<void> {
  logger.info(`📉 [LiquidityInstructions] Processing decrease liquidity`, {
    slot: data.slot,
    txHash: data.txHash,
  });

  logger.info(`🏊 [LiquidityInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });

  const analysis = analyseLiquidityEvents(data.decodedInstruction);
  logger.info(`🏊 [LiquidityInstructions] Liquidity analysis:`, {
    analysis,
  });

  //todo: in redis tracking, check if the whirlpool exists
  // if it does, check if the position exists
  // if it does, check if its in range
  // if it does, update the liquidity (simple subtraction)

  //todo: flush balance_interval => simillar to univ3 approach}
  //todo: pricing straightforward calculation for ticks <> liquidity math
  //todo: finally push in protocolState
}

async function processIncreaseLiquidityV2(
  data: LiquidityData,
  protocolStates: Map<string, any>,
): Promise<void> {
  logger.info(`📈 [LiquidityInstructions] Processing increase liquidity V2`, {
    slot: data.slot,
    txHash: data.txHash,
  });

  logger.info(`🏊 [LiquidityInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });

  const analysis = analyseLiquidityEvents(data.decodedInstruction);
  logger.info(`🏊 [LiquidityInstructions] Liquidity analysis:`, {
    analysis,
  });

  //todo: in redis tracking, check if the whirlpool exists
  // if it does, check if the position exists
  // if it does, check if its in range
  // if it does, update the liquidity (simple addition)

  //todo: flush balance_interval => simillar to univ3 approach}
  //todo: pricing straightforward calculation for ticks <> liquidity math
  //todo: finally push in protocolState
}

async function processDecreaseLiquidityV2(
  data: LiquidityData,
  protocolStates: Map<string, any>,
): Promise<void> {
  logger.info(`📉 [LiquidityInstructions] Processing decrease liquidity V2`, {
    slot: data.slot,
    txHash: data.txHash,
  });

  logger.info(`🏊 [LiquidityInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });

  const analysis = analyseLiquidityEvents(data.decodedInstruction);
  logger.info(`🏊 [LiquidityInstructions] Liquidity analysis:`, {
    analysis,
  });

  //todo: in redis tracking, check if the whirlpool exists
  // if it does, check if the position exists
  // if it does, check if its in range
  // if it does, update the liquidity (simple subtraction)

  //todo: flush balance_interval => simillar to univ3 approach
  //todo: pricing straightforward calculation for ticks <> liquidity math
  //todo: finally push in protocolState
}

function analyseLiquidityEvents(decodedInstruction: any) {
  return {
    liquidityAmount: decodedInstruction.data.liquidityAmount,
    whirlpool: decodedInstruction.data.whirlpool,
    position: decodedInstruction.data.position,
    positionTokenAccount: decodedInstruction.data.positionTokenAccount,
    positionAuthority: decodedInstruction.data.positionAuthority,
  };
}
