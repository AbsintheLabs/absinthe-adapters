import {
  Currency,
  fetchHistoricalUsd,
  logger,
  MessageType,
  pricePosition,
  ValidatedEnvBase,
} from '@absinthe/common';
import { PrintrInstructionData, SwapData } from '../utils/types';
import { getOwnerFromTokenAccount } from '../utils/helper';

export async function processSwapInstructions(
  instructionsData: PrintrInstructionData[],
  protocolStates: Map<string, any>,
  env: ValidatedEnvBase,
  connection: any,
): Promise<void> {
  logger.info(`🔄 [SwapInstructions] Processing ${instructionsData.length} swap instructions`);

  for (const data of instructionsData) {
    try {
      await processSwap(data as SwapData, protocolStates, env, connection);
    } catch (error) {
      logger.error(`❌ [SwapInstructions] Failed to process ${data.type}:`, error);
    }
  }
}

// Common processing logic for all swap types
async function processSwap(
  data: SwapData,
  protocolStates: Map<string, any>,
  env: ValidatedEnvBase,
  connection: any,
): Promise<void> {
  logger.info(`💱 [SwapInstructions] Processing ${data.type} instruction`, {
    slot: data.slot,
    txHash: data.txHash,
    event: data.event,
  });

  const analysis = await analyseSwap(data);
  const solanaPriceInUsd = await fetchHistoricalUsd(
    'solana',
    data.timestamp * 1000,
    env.coingeckoApiKey,
  );
  const valueUsd = analysis.displayAmount * solanaPriceInUsd;

  let outputWalletOwner = null;
  outputWalletOwner = await getOwnerFromTokenAccount(analysis.outputWallet, connection);
  if (!outputWalletOwner) {
    outputWalletOwner = analysis.payer;
  }

  const transactionSchema = {
    eventType: MessageType.TRANSACTION,
    eventName: data.type,
    tokens: {
      price: {
        value: solanaPriceInUsd.toString(),
        type: 'number',
      },
      pool: {
        value: analysis.pool.toLowerCase(),
        type: 'string',
      },
    },
    rawAmount: analysis.rawAmount.toString(),
    displayAmount: analysis.displayAmount,
    unixTimestampMs: data.timestamp * 1000,
    txHash: data.txHash,
    logIndex: data.logIndex,
    blockNumber: data.slot,
    blockHash: data.blockHash,
    userId: outputWalletOwner,
    currency: Currency.USD,
    valueUsd: valueUsd,
    gasUsed: 0, //todo: fix
    gasFeeUsd: 0, //todo: fix
  };

  const protocolState = protocolStates.get(analysis.pool);
  if (protocolState) {
    protocolState.transactions.push(transactionSchema);
  } else {
    protocolStates.set(analysis.pool, {
      balanceWindows: [],
      transactions: [transactionSchema],
    });
  }
  logger.info(`💱 [SwapInstructions] Processed ${data.type} instruction`, {
    transactionSchema,
  });
}

async function analyseSwap(data: any) {
  logger.info(`💱 [AnalyseSwap] Analyzing swap`, {
    tradeDirection: data.event.tradeDirection,
    swapResult: data.event.swapResult,
  });
  const tradeDirection = parseInt(data.event.tradeDirection);
  let rawAmount = null;

  if (tradeDirection === 0) {
    rawAmount = parseInt(data.event.swapResult.outputAmount);
  } else {
    rawAmount = parseInt(data.event.params.amountIn);
  }

  const displayAmount = rawAmount / 10 ** 9;

  return {
    outputWallet: data.decodedInstruction.accounts.outputWallet,
    displayAmount,
    pool: data.event.pool,
    payer: data.decodedInstruction.accounts.payer,
    rawAmount,
  };
}
