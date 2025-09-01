import { logger } from '@absinthe/common';
import { OrcaInstructionData, SwapData, TwoHopSwapData } from '../utils/types';

export async function processSwapInstructions(
  instructionsData: OrcaInstructionData[],
  protocolStates: Map<string, any>,
): Promise<void> {
  logger.info(`🔄 [SwapInstructions] Processing ${instructionsData.length} swap instructions`);

  for (const data of instructionsData) {
    try {
      switch (data.type) {
        case 'swap':
          await processSwap(data as SwapData, protocolStates);
          break;
        case 'swapV2':
          await processSwapV2(data as SwapData, protocolStates);
          break;
        case 'twoHopSwap':
          await processTwoHopSwap(data as TwoHopSwapData, protocolStates);
          break;
        case 'twoHopSwapV2':
          await processTwoHopSwapV2(data as TwoHopSwapData, protocolStates);
          break;
      }
    } catch (error) {
      logger.error(`❌ [SwapInstructions] Failed to process ${data.type}:`, error);
    }
  }
}

async function processSwap(data: SwapData, protocolStates: Map<string, any>): Promise<void> {
  logger.info(`💱 [SwapInstructions] Processing swap instruction`, {
    slot: data.slot,
    txHash: data.txHash,
  });

  logger.info(`🏊 [SwapInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });
  const analysis = analyseSwap(data.decodedInstruction);
  logger.info(`💸 [SwapInstructions] Swap analysis:`, {
    analysis,
  });
  // todo:
  //  1. we can only track some specific pools like we have done in univ3 and have their coingeckoId's already defined in consts.ts file
  //  2. For the dynamic pools research is in wip
  // 3. we can check both the srcMint and the destMint to see if they are in the tracked tokens list
  // 4. If we need volume, emit both of them in the txn event, else only emit one

  // 5. Send this in the transaction event => straightforward.
  // 6. make sure to include the relavent protocolMetadata for the pool
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

async function processSwapV2(data: SwapData, protocolStates: Map<string, any>): Promise<void> {
  logger.info(`💱 [SwapInstructions] Processing swapV2 instruction`, {
    slot: data.slot,
    txHash: data.txHash,
  });

  logger.info(`🏊 [SwapInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });

  const analysis = analyseSwap(data.decodedInstruction);
  logger.info(`💸 [SwapInstructions] Swap analysis:`, {
    analysis,
  });

  // todo: simillar logic to swap (described above)
}

async function processTwoHopSwap(
  data: TwoHopSwapData,
  protocolStates: Map<string, any>,
): Promise<void> {
  logger.info(`🔗 [SwapInstructions] Processing twoHopSwap instruction`, {
    slot: data.slot,
    txHash: data.txHash,
  });

  logger.info(`🏊 [SwapInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });

  //todo: exact simillar logic, but check if we get 2 balance changes for one tx object (testing left)
}

async function processTwoHopSwapV2(
  data: TwoHopSwapData,
  protocolStates: Map<string, any>,
): Promise<void> {
  logger.info(`🔗 [SwapInstructions] Processing twoHopSwapV2 instruction`, {
    slot: data.slot,
    txHash: data.txHash,
  });
  logger.info(`🏊 [SwapInstructions] Decoded instruction:`, {
    decodedInstruction: data.decodedInstruction,
  });

  //todo: exact simillar logic, but check if we get 2 balance changes for one tx object (testing left)
}

function analyseSwap(decodedInstruction: any) {
  const { tokenBalances } = decodedInstruction.baseData;

  //todo: pass the ins in the baseData in batchProcessor file
  //   let srcTransfer = tokenProgram.instructions.transfer.decode(ins.inner[0]);
  //   let destTransfer = tokenProgram.instructions.transfer.decode(ins.inner[1]);
  let srcTransfer = { accounts: { source: '', destination: '' } };
  let destTransfer = { accounts: { source: '', destination: '' } };
  let srcBalance = tokenBalances.find((tb: any) => tb.account == srcTransfer.accounts.source);
  let destBalance = tokenBalances.find(
    (tb: any) => tb.account === destTransfer.accounts.destination,
  );

  let srcMint = tokenBalances.find(
    (tb: any) => tb.account === srcTransfer.accounts.destination,
  )?.preMint;
  let destMint = tokenBalances.find(
    (tb: any) => tb.account === destTransfer.accounts.source,
  )?.preMint;

  let fromAccount = tokenBalances.find((tb: any) => tb.account === srcTransfer.accounts.source);
  let toAccount = tokenBalances.find((tb: any) => tb.account === destTransfer.accounts.destination);

  return {
    fromAccount,
    toAccount,
    whirlpool: decodedInstruction.data.whirlpool,
    srcMint: srcMint,
    destMint: destMint,
    srcBalance: srcBalance,
    destBalance: destBalance,
  };
}
