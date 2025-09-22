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
import { getJupPrice } from '../utils/pricing';

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

  let price = 0;
  let valueUsd = 0;

  if (JUPITER_PRICES_MINT.includes(analysis.mint!)) {
    const response = await getJupPrice(analysis.mint!, data.timestamp * 1000);
    valueUsd = pricePosition(response.usdPrice, analysis.amount, response.decimals);
    price = response.usdPrice;
  } else {
    const { coingeckoId, decimals } = fetchCoingeckoIdFromTokenMint(analysis.mint!);
    const timeStampMs = data.timestamp * 1000;
    price = await fetchHistoricalUsd(coingeckoId, timeStampMs, env.coingeckoApiKey);
    valueUsd = pricePosition(price, analysis.amount, decimals);
  }

  let outputWalletOwner = null;
  outputWalletOwner = await getOwnerFromTokenAccount(analysis.outputWallet, connection);
  if (!outputWalletOwner) {
    outputWalletOwner = analysis.payer;
  }

  logger.info(`💸 [SwapInstructions] Price:`, {
    price,
    valueUsd,
    analysis,
  });

  const transactionSchema = {
    eventType: MessageType.TRANSACTION,
    eventName: data.type,
    tokens: {
      quoteMint: {
        value: analysis.mint,
        type: 'string',
      },
      price: {
        value: price.toString(),
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
    rawAmount: analysis.amount.toString(),
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
  if (swapIntent && swapIntent.kind === 'SellMeme') {
    amount = swapIntent.value.sell.amount;
    mint = data.decodedInstruction.accounts.memeMint;
  } else if (swapIntent && swapIntent.kind === 'SpendQuote') {
    amount = swapIntent.value.sell.amount;
    mint = data.decodedInstruction.accounts.quoteMint;
  } else if (swapIntent && swapIntent.kind === 'SpendAllQuote') {
    logger.info('Not supported yet');
  }

  return {
    outputWallet: data.decodedInstruction.accounts.outputWallet,
    mint,
    dbcPool: data.decodedInstruction.accounts.dbcPool,
    dammPool: data.decodedInstruction.accounts.dammPool,
    dammPosition: data.decodedInstruction.accounts.dammPosition,
    payer: data.decodedInstruction.accounts.payer,
    amount,
  };
}
