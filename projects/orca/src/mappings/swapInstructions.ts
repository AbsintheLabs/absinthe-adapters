import { Currency, logger, MessageType } from '@absinthe/common';
import { OrcaInstructionData, SwapData, TwoHopSwapData } from '../utils/types';
import { getJupPrice } from '../utils/pricing';
import { PositionStorageService } from '../services/PositionStorageService';
import { LiquidityMathService } from '../services/LiquidityMathService';

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

async function processSwap(
  data: SwapData,
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
  liquidityMathService: LiquidityMathService,
): Promise<void> {
  logger.info(`💱 [SwapInstructions] Processing swap instruction`, {
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

      token0PriceUsd: {
        value: analysis!.srcAmountUsd.toString(),
        type: 'number',
      },
      amount0: {
        value: analysis!.fromAmount.toString(),
        type: 'number',
      },

      amount0Abs: {
        value: analysis!.fromAmount.toString(),
        type: 'number',
      },
      tick: {
        value: analysis!.currentTick.toString(),
        type: 'number',
      },
    },
    rawAmount: analysis!.fromAmount.toString(),
    displayAmount: analysis!.srcAmountUsd.toString(),
    unixTimestampMs: data.timestamp,
    txHash: data.txHash,
    logIndex: data.logIndex,
    blockNumber: data.slot,
    blockHash: data.blockHash,
    userId: data.accounts.source,
    currency: Currency.USD,
    valueUsd: swappedAmountUSD,
    gasUsed: 0, //todo: fix
    gasFeeUsd: 0, //todo: fix
  };

  // 7. directly call the contract and check the currentTick.
  // 8. check the current tick with all the pools we currently have,

  //   const positionsToActivate: PositionData[] = [];
  //   const positionsToDeactivate: PositionData[] = [];

  //   for (const position of positions) {
  //     const wasActive = position.isActive === 'true';
  //     const isNowActive = position.tickLower <= currentTick && position.tickUpper > currentTick;

  //     if (!wasActive && isNowActive) {
  //       positionsToActivate.push(position);
  //     } else if (wasActive && !isNowActive) {
  //       positionsToDeactivate.push(position);
  //     }
  //   }
  //   await Promise.all([
  //     this.activatePosition(block, currentTick, positionsToActivate),
  //     this.deactivatePosition(
  //       block,
  //       currentTick,
  //       positionsToDeactivate,
  //       protocolStates,
  //       coingeckoApiKey,
  //       chainPlatform,
  //     ),
  //   ]);

  //   private async activatePosition(
  //     block: BlockHeader,
  //     currentTick: number,
  //     positions: PositionData[],
  //   ) {
  //     for (const position of positions) {
  //       position.isActive = 'true';
  //       position.currentTick = currentTick;
  //       position.lastUpdatedBlockTs = block.timestamp;
  //       position.lastUpdatedBlockHeight = block.height;
  //       await this.positionStorageService.updatePosition(position);

  //       console.log(`Started tracking position ${position.positionId}`);
  //     }
  //   }

  //   private async deactivatePosition(
  //     block: BlockHeader,
  //     currentTick: number,
  //     positions: PositionData[],
  //     protocolStates: Map<string, ProtocolStateUniswapV3>,
  //     coingeckoApiKey: string,
  //     chainPlatform: string,
  //   ) {
  //     for (const position of positions) {
  //       position.isActive = 'false';
  //       position.currentTick = currentTick;
  //       let balanceWindow: HistoryWindow | null = null;
  //       await this.positionStorageService.updatePosition(position); //todo: efficiency - double call

  //       const token0 = await this.positionStorageService.getToken(position.token0Id);
  //       const token1 = await this.positionStorageService.getToken(position.token1Id);
  //       if (!token0 || !token1) {
  //         logger.warn(`❌ Skipping position ${position.positionId} - missing token data:`, {
  //           token0Exists: !!token0,
  //           token0Id: position.token0Id,
  //         });
  //         return;
  //       }

  //       const oldLiquidity = BigInt(position.liquidity);

  //       const { humanAmount0: oldHumanAmount0, humanAmount1: oldHumanAmount1 } =
  //         getAmountsForLiquidityRaw(
  //           oldLiquidity,
  //           position.tickLower,
  //           position.tickUpper,
  //           position.currentTick,
  //           token0.decimals,
  //           token1.decimals,
  //         );
  //       const [token0inUSD, token1inUSD] = await getOptimizedTokenPrices(
  //         position.poolId,
  //         token0,
  //         token1,
  //         block,
  //         coingeckoApiKey,
  //         chainPlatform,
  //       );

  //       const oldLiquidityUSD =
  //         Number(oldHumanAmount0) * token0inUSD + Number(oldHumanAmount1) * token1inUSD;

  //       if (oldLiquidityUSD !== 0 && position.lastUpdatedBlockTs) {
  //         balanceWindow = {
  //           userAddress: position.owner,
  //           deltaAmount: 0,
  //           trigger: TimeWindowTrigger.EXHAUSTED,
  //           startTs: position.lastUpdatedBlockTs,
  //           endTs: block.timestamp,
  //           windowDurationMs: this.windowDurationMs,
  //           startBlockNumber: position.lastUpdatedBlockHeight,
  //           endBlockNumber: block.height,
  //           txHash: null,
  //           currency: Currency.USD,
  //           valueUsd: Number(oldLiquidityUSD),
  //           balanceBefore: oldLiquidityUSD.toString(),
  //           balanceAfter: oldLiquidityUSD.toString(),
  //           tokenPrice: 0,
  //           tokenDecimals: 0,
  //           tokens: {
  //             isActive: {
  //               value: 'false',
  //               type: 'boolean',
  //             },
  //             currentTick: {
  //               value: currentTick.toString(),
  //               type: 'number',
  //             },
  //             tickLower: {
  //               value: position.tickLower.toString(),
  //               type: 'number',
  //             },
  //             tickUpper: {
  //               value: position.tickUpper.toString(),
  //               type: 'number',
  //             },
  //             liquidity: {
  //               value: position.liquidity.toString(),
  //               type: 'number',
  //             },
  //             token0Id: {
  //               value: position.token0Id,
  //               type: 'string',
  //             },
  //             token1Id: {
  //               value: position.token1Id,
  //               type: 'string',
  //             },
  //           },
  //         };
  //       }
  //       position.lastUpdatedBlockTs = block.timestamp;
  //       position.lastUpdatedBlockHeight = block.height;
  //       const poolState = protocolStates.get(position.poolId);
  //       await this.positionStorageService.updatePosition(position);

  //       if (poolState) {
  //         if (balanceWindow) {
  //           poolState.balanceWindows.push(balanceWindow);
  //         }
  //       } else {
  //         protocolStates.set(position.poolId, {
  //           balanceWindows: balanceWindow ? [balanceWindow] : [],
  //           transactions: [],
  //         });
  //       }

  //       console.log(`Stopped tracking position ${position.positionId}`);
  //     }
  //   }

  //todo: finally set it with whirlpool in the protocolState
}

async function processSwapV2(
  data: SwapData,
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
  liquidityMathService: LiquidityMathService,
): Promise<void> {
  logger.info(`💱 [SwapInstructions] Processing swapV2 instruction`, {
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

  // todo: simillar logic to swap (described above)
}

async function processTwoHopSwap(
  data: TwoHopSwapData,
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
  liquidityMathService: LiquidityMathService,
): Promise<void> {
  logger.info(`🔗 [SwapInstructions] Processing twoHopSwap instruction`, {
    slot: data.slot,
    txHash: data.txHash,
  });

  logger.info(`🏊 [SwapInstructions] Decoded instruction:`, {
    decodedInstruction: data,
  });

  const analysis = await analyseSwap(data, liquidityMathService);
  logger.info(`💸 [SwapInstructions] Two-hop analysis:`, {
    analysis,
  });

  //todo: exact simillar logic, but check if we get 2 balance changes for one tx object (testing left)
}

async function processTwoHopSwapV2(
  data: TwoHopSwapData,
  protocolStates: Map<string, any>,
  positionStorageService: PositionStorageService,
  liquidityMathService: LiquidityMathService,
): Promise<void> {
  logger.info(`🔗 [SwapInstructions] Processing twoHopSwapV2 instruction`, {
    slot: data.slot,
    txHash: data.txHash,
  });
  logger.info(`🏊 [SwapInstructions] Decoded instruction:`, {
    decodedInstruction: data,
  });
  const analysis = await analyseSwap(data, liquidityMathService);
  logger.info(`💸 [SwapInstructions] Two-hop analysis:`, {
    analysis,
  });

  //todo: exact simillar logic, but check if we get 2 balance changes for one tx object (testing left)
}

async function analyseSwap(decodedInstruction: any, liquidityMathService: LiquidityMathService) {
  const { transfers, tokenBalances, txHash, data } = decodedInstruction;

  const currentTick = liquidityMathService.sqrtPriceX64ToTick(
    decodedInstruction.data.initialSqrtPrice,
  );
  logger.info(`🏊 [SwapInstructions] Transfers:`, {
    transfers,
    transfersLength: transfers.length,
    baseDataTokenBalances: tokenBalances,
  });

  if (transfers.length > 2) {
    // First transfer: source -> intermediate
    let firstTransfer = transfers[0];
    // Last transfer: intermediate -> destination

    // Find token balances for the first and last transfers
    let sourceBalance = tokenBalances.find(
      (tb: any) => tb.account === firstTransfer.accounts.source,
    );

    let destBalance = tokenBalances.find(
      (tb: any) => tb.account === transfers[transfers.length - 1].accounts.destination,
    );

    // Find the intermediate token (the destination of first transfer)
    let intermediateBalance = tokenBalances.find(
      (tb: any) => tb.account === firstTransfer.accounts.destination,
    );

    let sourceMint = sourceBalance?.preMint;
    let intermediateMint = intermediateBalance?.preMint;
    let destMint = destBalance?.postMint;

    const srcMintDetails = await getJupPrice(sourceMint);

    // Calculate source amount
    let srcAmount = Math.abs(
      Number((sourceBalance?.preAmount || 0n) - (sourceBalance?.postAmount || 0n)),
    );

    let srcAmountUsd: number;

    // If srcAmount is 0, calculate from intermediate amount
    if (srcAmount === 0) {
      const intermediateMintDetails = await getJupPrice(intermediateMint);
      const intermediateAmount = Math.abs(
        Number((intermediateBalance?.preAmount || 0n) - (intermediateBalance?.postAmount || 0n)),
      );

      srcAmountUsd =
        (intermediateMintDetails.usdPrice * intermediateAmount) /
        Math.pow(10, intermediateMintDetails.decimals);

      logger.info(`🏊 [SwapInstructions] Using intermediate amount (srcAmount was 0):`, {
        intermediateAmount,
        intermediateMint,
        srcAmountUsd,
      });
    } else {
      srcAmountUsd = (srcMintDetails.usdPrice * srcAmount) / Math.pow(10, srcMintDetails.decimals);
    }

    logger.info(`🔗 [SwapInstructions] Two-hop analysis:`, {
      sourceMint,
      intermediateMint,
      destMint,
      srcAmount,
      srcAmountUsd,
    });

    if (sourceMint && intermediateMint && destMint) {
      return {
        fromToken: sourceMint,
        toToken: destMint,
        fromAmount: srcAmount,
        toAmount: Math.abs(
          Number((destBalance?.postAmount || 0n) - (destBalance?.preAmount || 0n)),
        ),
        srcAmountUsd,
        transactionHash: txHash,
      };
    }
  } else if (transfers.length === 2) {
    let srcBalance = tokenBalances.find((tb: any) => tb.account == transfers[0].accounts.source);
    let destBalance = tokenBalances.find(
      (tb: any) => tb.account === transfers[1].accounts.destination,
    );

    let srcMint = tokenBalances.find(
      (tb: any) => tb.account === transfers[0].accounts.destination,
    )?.preMint;
    let destMint = tokenBalances.find(
      (tb: any) => tb.account === transfers[1].accounts.source,
    )?.preMint;

    // Calculate source amount
    let rawAmount = Math.abs(
      Number((srcBalance?.preAmount || 0n) - (srcBalance?.postAmount || 0n)),
    );

    let valueUsd: number;

    // If srcAmount is 0, calculate from destination amount
    if (rawAmount === 0) {
      const destMintDetails = await getJupPrice(destMint);
      const destAmount = Math.abs(
        Number((destBalance?.postAmount || 0n) - (destBalance?.preAmount || 0n)),
      );

      valueUsd = (destMintDetails.usdPrice * destAmount) / Math.pow(10, destMintDetails.decimals);

      logger.info(`🏊 [SwapInstructions] Using destination amount (srcAmount was 0):`, {
        destAmount,
        destMint,
        valueUsd,
      });
    } else {
      const srcMintDetails = await getJupPrice(srcMint);
      valueUsd = (srcMintDetails.usdPrice * rawAmount) / Math.pow(10, srcMintDetails.decimals);
    }

    logger.info(`🏊 [SwapInstructions] Single swap analysis:`, {
      srcMint,
      destMint,
      srcBalance,
      destBalance,
      rawAmount,
      valueUsd,
    });

    return {
      fromToken: srcMint,
      toToken: destMint,
      fromAmount: Math.abs(Number((srcBalance?.postAmount || 0n) - (srcBalance?.preAmount || 0n))),
      toAmount: Math.abs(Number((destBalance?.postAmount || 0n) - (destBalance?.preAmount || 0n))),
      transactionHash: txHash,
      poolId: data.accounts.whirlpool,
      currentTick: currentTick,
      valueUsd: valueUsd,
      rawAmount: rawAmount.toString(),
    };
  }
}
