import { Currency, logger, MessageType } from '@absinthe/common';
import { OrcaInstructionData, PositionDetails, SwapData, TwoHopSwapData } from '../utils/types';
import { getJupPrice, getTokenPrice } from '../utils/pricing';
import { PositionStorageService } from '../services/PositionStorageService';
import { LiquidityMathService } from '../services/LiquidityMathService';
import { activatePosition, deactivatePosition } from '../services/LiquidityManagementService';

export async function processSwapInstructions(
  instructionsData: OrcaInstructionData[],
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
  liquidityMathService: LiquidityMathService,
): Promise<void> {
  logger.info(`🔄 [SwapInstructions] Processing ${instructionsData.length} swap instructions`);

  for (const data of instructionsData) {
    try {
      switch (data.type) {
        case 'swap':
          await processSwap(
            data as SwapData,
            protocolStates,
            positionStorageService,
            liquidityMathService,
          );
          break;
        case 'swapV2':
          await processSwapV2(
            data as SwapData,
            protocolStates,
            positionStorageService,
            liquidityMathService,
          );
          break;
        case 'twoHopSwap':
          await processTwoHopSwap(
            data as TwoHopSwapData,
            protocolStates,
            positionStorageService,
            liquidityMathService,
          );
          break;
        case 'twoHopSwapV2':
          await processTwoHopSwapV2(
            data as TwoHopSwapData,
            protocolStates,
            positionStorageService,
            liquidityMathService,
          );
          break;
      }
    } catch (error) {
      logger.error(`❌ [SwapInstructions] Failed to process ${data.type}:`, error);
    }
  }
}

// Common processing logic for all swap types
async function processSwapCommon(
  data: SwapData | TwoHopSwapData,
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
  liquidityMathService: LiquidityMathService,
): Promise<void> {
  logger.info(`💱 [SwapInstructions] Processing ${data.type} instruction`, {
    slot: data.slot,
    txHash: data.txHash,
  });

  logger.info(`🏊 [SwapInstructions] Decoded instruction:`, {
    decodedInstruction: data,
  });

  const analysis = await analyseSwap(data, liquidityMathService);
  logger.info(`💸 [SwapInstructions] Swap analysis:`, {
    analysis,
  });

  if (!analysis?.userAddress) {
    logger.warn(`⚠️ [SwapInstructions] Skipping transaction schema - userAddress is undefined`, {
      txHash: data.txHash,
      analysis,
    });
    return;
  }

  const poolDetails = await positionStorageService.getPool(analysis!.poolId);

  const transactionSchema = {
    eventType: MessageType.TRANSACTION,
    eventName: data.type,
    tokens: {
      token0Decimals: {
        value: poolDetails!.token0Decimals.toString(),
        type: 'number',
      },
      token0Address: {
        value: poolDetails!.token0Id,
        type: 'string',
      },
      token1Decimals: {
        value: poolDetails!.token1Decimals.toString(),
        type: 'number',
      },
      token1Address: {
        value: poolDetails!.token1Id,
        type: 'string',
      },
      amount0: {
        value: analysis!.fromAmount.toString(),
        type: 'number',
      },
      amount1: {
        value: analysis!.toAmount.toString(),
        type: 'number',
      },
      currentTick: {
        value: analysis!.currentTick.toString(),
        type: 'number',
      },
    },
    rawAmount: analysis!.fromAmount.toString(),
    displayAmount: analysis!.valueUsd.toString(),
    unixTimestampMs: data.timestamp,
    txHash: data.txHash,
    logIndex: data.logIndex,
    blockNumber: data.slot,
    blockHash: data.blockHash,
    userId: analysis!.userAddress,
    currency: Currency.USD,
    valueUsd: analysis!.valueUsd,
    gasUsed: 0, //todo: fix
    gasFeeUsd: 0, //todo: fix
  };

  const protocolState = protocolStates.get(analysis!.poolId);
  if (protocolState) {
    protocolState.transactions.push(transactionSchema);
  } else {
    protocolStates.set(analysis!.poolId, {
      balanceWindows: [],
      transactions: [transactionSchema],
    });
    logger.info(`📊 [SwapInstructions] Added transaction for pool ${analysis!.poolId}`);
  }

  const positionsToActivate: PositionDetails[] = [];
  const positionsToDeactivate: PositionDetails[] = [];

  const positions = await positionStorageService.getAllPositionsByPoolId(analysis!.poolId);

  for (const position of positions) {
    const wasActive = position.isActive === 'true';
    const isNowActive =
      position.tickLower <= analysis!.currentTick && position.tickUpper > analysis!.currentTick;

    if (!wasActive && isNowActive) {
      positionsToActivate.push(position);
    } else if (wasActive && !isNowActive) {
      positionsToDeactivate.push(position);
    }
  }

  await Promise.all([
    activatePosition(
      data.slot,
      data.timestamp,
      analysis!.currentTick,
      positionsToActivate,
      poolDetails!,
      positionStorageService,
    ),
    deactivatePosition(
      data.slot,
      data.timestamp,
      analysis!.currentTick,
      positionsToDeactivate,
      poolDetails!,
      protocolStates,
      positionStorageService,
      liquidityMathService,
    ),
  ]);
}

async function processSwap(
  data: SwapData,
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
  liquidityMathService: LiquidityMathService,
): Promise<void> {
  await processSwapCommon(data, protocolStates, positionStorageService, liquidityMathService);
}

async function processSwapV2(
  data: SwapData,
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
  liquidityMathService: LiquidityMathService,
): Promise<void> {
  await processSwapCommon(data, protocolStates, positionStorageService, liquidityMathService);
}

async function processTwoHopSwap(
  data: TwoHopSwapData,
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
  liquidityMathService: LiquidityMathService,
): Promise<void> {
  await processSwapCommon(data, protocolStates, positionStorageService, liquidityMathService);
}

async function processTwoHopSwapV2(
  data: TwoHopSwapData,
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
  liquidityMathService: LiquidityMathService,
): Promise<void> {
  await processSwapCommon(data, protocolStates, positionStorageService, liquidityMathService);
}

async function analyseSwap(data: any, liquidityMathService: LiquidityMathService) {
  logger.info(`🏊 [SwapInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction.data,
    sqrtPriceLimit: data.decodedInstruction.data.sqrtPriceLimit,
    sqrtPriceLimitOne: data.decodedInstruction.data.sqrtPriceLimitOne,
  });

  const currentTick = liquidityMathService.sqrtPriceX64ToTick(
    data.decodedInstruction.data.sqrtPriceLimit || data.decodedInstruction.data.sqrtPriceLimitOne,
  );
  logger.info(`🏊 [SwapInstructions] Transfers:`, {
    transfers: data.transfers,
    transfersLength: data.transfers.length,
    baseDataTokenBalances: data.tokenBalances,
  });

  if (data.transfers.length > 2) {
    // First transfer: source -> intermediate
    let firstTransfer = data.transfers[0];
    // Last transfer: intermediate -> destination

    // Find token balances for the first and last transfers
    let sourceBalance = data.tokenBalances.find(
      (tb: any) => tb.account === firstTransfer.accounts.source,
    );

    let destBalance = data.tokenBalances.find(
      (tb: any) => tb.account === data.transfers[data.transfers.length - 1].accounts.destination,
    );

    // Find the intermediate token (the destination of first transfer)
    let intermediateBalance = data.tokenBalances.find(
      (tb: any) => tb.account === firstTransfer.accounts.destination,
    );

    let sourceMint = sourceBalance?.preMint;
    let intermediateMint = intermediateBalance?.preMint;

    let sourceUserAddress = sourceBalance?.preOwner;
    let destinationUserAddress = intermediateBalance?.preOwner;

    let userAddress: string | undefined;

    const srcMintDetails = await getTokenPrice(sourceMint);

    // Calculate source amount
    let srcAmount = Math.abs(
      Number((sourceBalance?.preAmount || 0n) - (sourceBalance?.postAmount || 0n)),
    );

    let srcAmountUsd: number = 0;

    // Priority 1: Use source amount and source user address if both are available
    if (srcAmount > 0 && sourceUserAddress) {
      userAddress = sourceUserAddress;
      srcAmountUsd = (srcMintDetails.usdPrice * srcAmount) / Math.pow(10, srcMintDetails.decimals);

      logger.info(`🏊 [SwapInstructions] Using source amount and address:`, {
        srcAmount,
        srcMint: sourceMint,
        srcAmountUsd,
        userAddress,
      });
    }
    // Priority 2: If srcAmount > 0 but srcAddress is null, price it for srcBalance but user should be destBalance
    else if (srcAmount > 0 && !sourceUserAddress) {
      userAddress = destBalance?.preOwner; // Use destination address
      srcAmountUsd = (srcMintDetails.usdPrice * srcAmount) / Math.pow(10, srcMintDetails.decimals); // Price using source

      logger.info(`🏊 [SwapInstructions] Using src amount for pricing but destAddress as user:`, {
        srcAmount,
        srcMint: sourceMint,
        srcAmountUsd,
        userAddress,
      });
    }
    // Priority 3: If srcAmount is 0, use intermediate amount and destination address
    else if (intermediateMint) {
      const intermediateMintDetails = await getTokenPrice(intermediateMint);
      const intermediateAmount = Math.abs(
        Number((intermediateBalance?.preAmount || 0n) - (intermediateBalance?.postAmount || 0n)),
      );
      userAddress = destinationUserAddress; // This can be undefined, but we still price it

      srcAmountUsd =
        (intermediateMintDetails.usdPrice * intermediateAmount) /
        Math.pow(10, intermediateMintDetails.decimals);

      logger.info(`🏊 [SwapInstructions] Using intermediate amount (fallback):`, {
        intermediateAmount,
        intermediateMint,
        srcAmountUsd,
        userAddress,
      });
    }

    logger.info(`🔗 [SwapInstructions] Two-hop analysis:`, {
      sourceMint,
      intermediateMint,
      srcAmount,
      valueUsd: srcAmountUsd,
      userAddress,
    });

    if (sourceMint && intermediateMint && destBalance?.postMint) {
      return {
        fromToken: sourceMint,
        toToken: intermediateMint,
        fromAmount: srcAmount,
        toAmount: Math.abs(
          Number((destBalance?.postAmount || 0n) - (destBalance?.preAmount || 0n)),
        ),
        valueUsd: srcAmountUsd,
        rawAmount: srcAmount.toString(),
        userAddress: userAddress,
        transactionHash: data.txHash,
        poolId: data.accounts.whirlpool,
        fromAddress: sourceUserAddress,
        toAddress: destinationUserAddress,
        currentTick: currentTick,
      };
    }
  } else if (data.transfers.length === 2) {
    let srcBalance = data.tokenBalances.find(
      (tb: any) => tb.account == data.transfers[0].accounts.source,
    );
    let destBalance = data.tokenBalances.find(
      (tb: any) => tb.account === data.transfers[1].accounts.destination,
    );

    let srcMint = data.tokenBalances.find(
      (tb: any) => tb.account === data.transfers[0].accounts.destination,
    )?.preMint;
    let destMint = data.tokenBalances.find(
      (tb: any) => tb.account === data.transfers[1].accounts.source,
    )?.preMint;

    // Calculate source amount
    let rawAmount = Math.abs(
      Number((srcBalance?.preAmount || 0n) - (srcBalance?.postAmount || 0n)),
    );

    let valueUsd: number = 0;
    let userAddress: string | undefined;

    let srcAddress = srcBalance?.preOwner;
    let destAddress = destBalance?.preOwner;

    // Priority 1: Use source amount and source address if both are available
    if (rawAmount > 0 && srcAddress) {
      const srcMintDetails = await getTokenPrice(srcMint);
      valueUsd = (srcMintDetails.usdPrice * rawAmount) / Math.pow(10, srcMintDetails.decimals);
      userAddress = srcAddress;

      logger.info(`🏊 [SwapInstructions] Using source amount and address:`, {
        rawAmount,
        srcMint,
        valueUsd,
        userAddress,
      });
    }
    // Priority 2: If srcAmount > 0 but srcAddress is null, price it for srcBalance but user should be destBalance
    else if (rawAmount > 0 && !srcAddress) {
      const srcMintDetails = await getTokenPrice(srcMint);
      userAddress = destAddress; // Use destination address
      valueUsd = (srcMintDetails.usdPrice * rawAmount) / Math.pow(10, srcMintDetails.decimals); // Price using source

      logger.info(`🏊 [SwapInstructions] Using src amount for pricing but destAddress as user:`, {
        rawAmount,
        srcMint,
        valueUsd,
        userAddress,
      });
    }
    // Priority 3: If srcAmount is 0, use destination amount and address
    else if (destMint) {
      const destMintDetails = await getTokenPrice(destMint);
      const destAmount = Math.abs(
        Number((destBalance?.postAmount || 0n) - (destBalance?.preAmount || 0n)),
      );

      valueUsd = (destMintDetails.usdPrice * destAmount) / Math.pow(10, destMintDetails.decimals);
      userAddress = destAddress; // This can be undefined, but we still price it

      logger.info(`🏊 [SwapInstructions] Using destination amount (fallback):`, {
        destAmount,
        destMint,
        valueUsd,
        userAddress,
      });
    }

    logger.info(`🏊 [SwapInstructions] Single swap analysis:`, {
      srcMint,
      destMint,
      srcBalance,
      destBalance,
      rawAmount,
      valueUsd,
      userAddress,
    });

    return {
      fromToken: srcMint,
      toToken: destMint,
      fromAmount: Math.abs(Number((srcBalance?.postAmount || 0n) - (srcBalance?.preAmount || 0n))),
      toAmount: Math.abs(Number((destBalance?.postAmount || 0n) - (destBalance?.preAmount || 0n))),
      transactionHash: data.txHash,
      poolId: data.decodedInstruction.accounts.whirlpool,
      fromAddress: srcAddress,
      toAddress: destAddress,
      currentTick: currentTick,
      valueUsd: valueUsd,
      userAddress: userAddress,
      rawAmount: rawAmount.toString(),
    };
  }
}
