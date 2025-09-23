import {
  Currency,
  fetchHistoricalUsd,
  logger,
  MessageType,
  pricePosition,
  ValidatedEnvBase,
} from '@absinthe/common';
import { PrintrInstructionData, SwapData } from '../utils/types';
import { fetchCoingeckoIdFromTokenMint, getOwnerFromTokenAccount } from '../utils/helper';
import { JUPITER_PRICES_MINT, TOKEN_MINT_DETAILS } from '../utils/consts';
import { getJupPrice, priceMemeinQuote } from '../utils/pricing';

export async function processSwapInstructions(
  instructionsData: PrintrInstructionData[],
  protocolStates: Map<string, any>,
  env: ValidatedEnvBase,
  connection: any,
): Promise<void> {
  logger.info(`🔄 [SwapInstructions] Processing ${instructionsData.length} swap instructions`);

  for (const data of instructionsData) {
    try {
      switch (data.type) {
        case 'swap':
          await processSwap(data as SwapData, protocolStates, env, connection);
          break;
      }
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
  });

  const analysis = await analyseSwap(data);

  let valueUsd = 0;
  let valueQuote = 0;
  const timeStampMs = data.timestamp * 1000;

  if (analysis.mintType === 'meme') {
    const { quotePerBase, basePerQuote, quoteDecimals, baseDecimals } = await priceMemeinQuote(
      analysis.memeMint!,
      analysis.quoteMint!,
      connection,
      analysis.sqrtPriceQ64,
    );
    const memePrice = parseFloat(quotePerBase);
    valueQuote = pricePosition(memePrice, analysis.amount, quoteDecimals);
    const solanaPriceInUsd = await fetchHistoricalUsd('solana', timeStampMs, env.coingeckoApiKey);
    valueUsd = valueQuote * solanaPriceInUsd;
  } else {
    const quotePrice = await fetchHistoricalUsd('solana', timeStampMs, env.coingeckoApiKey);
    valueQuote = pricePosition(quotePrice, analysis.amount, 9);
  }

  let outputWalletOwner = null;
  outputWalletOwner = await getOwnerFromTokenAccount(analysis.outputWallet, connection);
  if (!outputWalletOwner) {
    outputWalletOwner = analysis.payer;
  }

  logger.info(`💸 [SwapInstructions] Price:`, {
    valueQuote,
    valueUsd,
    analysis,
  });

  const transactionSchema = {
    eventType: MessageType.TRANSACTION,
    eventName: data.type,
    tokens: {
      quoteMint: {
        value: analysis.quoteMint,
        type: 'string',
      },
      price: {
        value: valueQuote.toString(),
        type: 'number',
      },
      amount: {
        value: analysis.amount.toString(),
        type: 'number',
      },
      dbcPool: {
        value: analysis.dbcPool,
        type: 'string',
      },
      dammPool: {
        value: analysis.dammPool,
        type: 'string',
      },
      dammPosition: {
        value: analysis.dammPosition,
        type: 'string',
      },
    },
    rawAmount: valueQuote.toString(),
    displayAmount: valueUsd,
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

  const protocolState = protocolStates.get(analysis.dbcPool);
  if (protocolState) {
    protocolState.transactions.push(transactionSchema);
  } else {
    protocolStates.set(analysis.dbcPool, {
      balanceWindows: [],
      transactions: [transactionSchema],
    });
  }
}

async function analyseSwap(data: any) {
  const swapIntent = data.decodedInstruction.data.params;
  let amount = null;
  let mint = null;
  let mintType = null;
  if (swapIntent && swapIntent.kind === 'SellMeme') {
    amount = swapIntent.value.sell.amount;
    mint = data.decodedInstruction.accounts.memeMint;
    mintType = 'meme';
  } else if (swapIntent && swapIntent.kind === 'SpendQuote') {
    amount = swapIntent.value.sell.amount;
    mint = data.decodedInstruction.accounts.quoteMint;
    mintType = 'quote';
  } else if (swapIntent && swapIntent.kind === 'SpendAllQuote') {
    logger.info('Not supported yet');
  }

  return {
    outputWallet: data.decodedInstruction.accounts.outputWallet,
    memeMint: data.decodedInstruction.accounts.memeMint,
    quoteMint: data.decodedInstruction.accounts.quoteMint,
    dbcPool: data.decodedInstruction.accounts.dbcPool,
    dammPool: data.decodedInstruction.accounts.dammPool,
    dammPosition: data.decodedInstruction.accounts.dammPosition,
    payer: data.decodedInstruction.accounts.payer,
    amount,
    mintType,
    sqrtPriceQ64: data.decodedInstruction.accounts.sqrtPriceQ64, // todo: try to get this from the instruction data
  };
}
