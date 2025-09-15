import { Currency, logger, MessageType } from '@absinthe/common';
import { OrcaInstructionData, PositionDetails, SwapData, TwoHopSwapData } from '../utils/types';
import { getJupPrice, getTokenPrice } from '../utils/pricing';
import { PositionStorageService } from '../services/PositionStorageService';
import { LiquidityMathService } from '../services/LiquidityMathService';
import { activatePosition, deactivatePosition } from '../services/LiquidityManagementService';
import { getTickPriceOffChain } from '../utils/helper';

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

  // Check if this swap should reward users (default to true for backwards compatibility)
  const shouldRewardUser = (data as any).shouldRewardUser !== false;

  // Only create transaction schema if we should reward AND have a userAddress
  if (shouldRewardUser && analysis?.userAddress) {
    const poolDetails = await positionStorageService.getPool(analysis.poolId);

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
          value: analysis.fromAmount.toString(),
          type: 'number',
        },
        amount1: {
          value: analysis.toAmount.toString(),
          type: 'number',
        },
        currentTick: {
          value: analysis.currentTick.toString(),
          type: 'number',
        },
        aToB: {
          value: analysis.aToB,
          type: 'string',
        },
      },
      rawAmount: analysis.fromAmount.toString(),
      displayAmount: analysis.valueUsd,
      unixTimestampMs: data.timestamp,
      txHash: data.txHash,
      logIndex: data.logIndex,
      blockNumber: data.slot,
      blockHash: data.blockHash,
      userId: analysis.userAddress,
      currency: Currency.USD,
      valueUsd: analysis.valueUsd,
      gasUsed: 0, //todo: fix
      gasFeeUsd: 0, //todo: fix
    };

    const protocolState = protocolStates.get(analysis.poolId);
    if (protocolState) {
      protocolState.transactions.push(transactionSchema);
    } else {
      protocolStates.set(analysis.poolId, {
        balanceWindows: [],
        transactions: [transactionSchema],
      });
    }

    logger.info(`📊 [SwapInstructions] Added user reward transaction for pool ${analysis.poolId}`);
  } else if (!shouldRewardUser && analysis?.userAddress) {
    logger.info(
      `🚫 [SwapInstructions] Skipping user reward for second hop pool ${analysis?.poolId}`,
      {
        txHash: data.txHash,
        poolId: analysis.poolId,
        userAddress: analysis.userAddress,
      },
    );
  } else {
    logger.warn(`⚠️ [SwapInstructions] Skipping transaction schema - userAddress is undefined`, {
      txHash: data.txHash,
      analysis,
      shouldRewardUser,
    });
  }

  // ALWAYS process position activation/deactivation regardless of shouldRewardUser flag
  // This ensures ticks are updated correctly for both hops
  if (analysis?.poolId && analysis?.currentTick !== undefined) {
    const poolDetails = await positionStorageService.getPool(analysis.poolId);
    const positionsToActivate: PositionDetails[] = [];
    const positionsToDeactivate: PositionDetails[] = [];

    const positions = await positionStorageService.getAllPositionsByPoolId(analysis.poolId);

    for (const position of positions) {
      const wasActive = position.isActive === 'true';
      const isNowActive =
        position.tickLower <= analysis.currentTick! && position.tickUpper > analysis.currentTick!;

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
        analysis.currentTick!,
        positionsToActivate,
        poolDetails!,
        positionStorageService,
      ),
      deactivatePosition(
        data.slot,
        data.timestamp,
        analysis.currentTick!,
        positionsToDeactivate,
        poolDetails!,
        protocolStates,
        positionStorageService,
        liquidityMathService,
      ),
    ]);

    logger.info(`🔄 [SwapInstructions] Processed liquidity changes for pool ${analysis.poolId}`, {
      currentTick: analysis.currentTick,
      positionsActivated: positionsToActivate.length,
      positionsDeactivated: positionsToDeactivate.length,
      userRewarded: shouldRewardUser,
    });
  } else {
    logger.warn(
      `⚠️ [SwapInstructions] Cannot process liquidity changes - missing poolId or currentTick`,
      {
        poolId: analysis?.poolId,
        currentTick: analysis?.currentTick,
        txHash: data.txHash,
      },
    );
  }
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
  const { preSqrtPrice, postSqrtPrice, sqrtPriceX64 } = await getTickPriceOffChain(
    data.decodedInstruction.accounts.whirlpool,
    data.slot,
  );

  logger.info(`🏊 [SwapInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction.data,
    sqrtPriceLimit: data.decodedInstruction.data.sqrtPriceLimit,
    txHash: data.txHash,
    preSqrtPrice,
    postSqrtPrice,
    sqrtPriceX64,
  });

  const currentTick = liquidityMathService.sqrtPriceX64ToTick(sqrtPriceX64);
  logger.info(`🏊 [SwapInstructions] Transfers:`, {
    transfers: data.transfers,
    transfersLength: data.transfers.length,
    baseDataTokenBalances: data.tokenBalances,
  });

  if (data.transfers.length === 2) {
    let srcBalance, destBalance, srcMint, destMint;

    // Detect transfer type by checking if tokenMint field exists
    const hasTokenMint = data.transfers[0].accounts.tokenMint !== undefined;

    if (hasTokenMint) {
      // transferChecked instructions - use owner + tokenMint matching
      srcBalance = data.tokenBalances.find(
        (tb: any) =>
          tb.preOwner === data.transfers[0].accounts.owner &&
          tb.preMint === data.transfers[0].accounts.tokenMint,
      );
      destBalance = data.tokenBalances.find(
        (tb: any) =>
          tb.preOwner === data.transfers[1].accounts.owner &&
          tb.preMint === data.transfers[1].accounts.tokenMint,
      );
      srcMint = data.transfers[0].accounts.tokenMint;
      destMint = data.transfers[1].accounts.tokenMint;

      logger.info(`🔄 [SwapInstructions] Using transferChecked matching:`, {
        transfer0: data.transfers[0].accounts,
        transfer1: data.transfers[1].accounts,
        srcBalance: srcBalance?.account,
        destBalance: destBalance?.account,
      });
    } else {
      // Regular transfer instructions - use account address matching
      srcBalance = data.tokenBalances.find(
        (tb: any) => tb.account === data.transfers[0].accounts.source,
      );
      destBalance = data.tokenBalances.find(
        (tb: any) => tb.account === data.transfers[1].accounts.destination,
      );
      srcMint = data.tokenBalances.find(
        (tb: any) => tb.account === data.transfers[0].accounts.destination,
      )?.preMint;
      destMint = data.tokenBalances.find(
        (tb: any) => tb.account === data.transfers[1].accounts.source,
      )?.preMint;

      logger.info(`🔄 [SwapInstructions] Using transfer matching:`, {
        transfer0: data.transfers[0].accounts,
        transfer1: data.transfers[1].accounts,
        srcBalance: srcBalance?.account,
        destBalance: destBalance?.account,
      });
    }

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
      aToB: data.decodedInstruction.data.aToB,
      rawAmount: rawAmount.toString(),
    };
  }
}
