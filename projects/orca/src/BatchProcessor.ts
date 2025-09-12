import { run } from '@subsquid/batch-processor';

import {
  AbsintheApiClient,
  Chain,
  Currency,
  ValidatedEnvBase,
  toTransaction,
  logger,
  PriceFeed,
  TokenPreference,
  toTimeWeightedBalance,
  TimeWindowTrigger,
  HOURS_TO_SECONDS,
} from '@absinthe/common';
import * as whirlpoolProgram from './abi/whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
import * as tokenProgram from './abi/TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
import { processor } from './processor';
import { createHash } from 'crypto';
import { TypeormDatabase } from '@subsquid/typeorm-store';

import {
  OrcaProtocol,
  ProtocolStateOrca,
  OrcaInstructionData,
  PositionDetails,
  PoolDetails,
} from './utils/types';
import { augmentBlock } from '@subsquid/solana-objects';

// Import all the mapping handlers
import { processSwapInstructions } from './mappings/swapInstructions';
import { processLiquidityInstructions } from './mappings/liquidityInstructions';
import { processFeeInstructions } from './mappings/feeInstructions';
import { processPositionInstructions } from './mappings/positionInstructions';
import { processPoolInstructions } from './mappings/poolInstructions';
import { processTransferInstructions } from './mappings/transferInstruction';
import { LiquidityMathService } from './services/LiquidityMathService';
import { PositionStorageService } from './services/PositionStorageService';
import { getOptimizedTokenPrices } from './utils/pricing';
import { processBundlePositionInstructions } from './mappings/bundleInstructions';
import { Connection } from '@solana/web3.js';
import { WHIRLPOOL_ADDRESSES, TOKEN_EXTENSION_PROGRAM_ID } from './utils/consts';
export class OrcaProcessor {
  private readonly protocol: OrcaProtocol;
  private readonly schemaName: string;
  private readonly refreshWindow: number;
  private readonly apiClient: AbsintheApiClient;
  private readonly chainConfig: Chain;
  private readonly env: ValidatedEnvBase;
  private readonly liquidityMathService: LiquidityMathService;
  private readonly positionStorageService: PositionStorageService;
  private readonly connection: Connection;
  constructor(
    dexProtocol: OrcaProtocol,
    refreshWindow: number,
    apiClient: AbsintheApiClient,
    env: ValidatedEnvBase,
    chainConfig: Chain,
    rpcUrl: string,
  ) {
    this.protocol = dexProtocol;
    this.refreshWindow = refreshWindow;
    this.apiClient = apiClient;
    this.env = env;
    this.chainConfig = chainConfig;
    this.schemaName = this.generateSchemaName();
    // Fix: Convert hours to seconds (since Solana timestamps are in seconds)
    this.refreshWindow = this.protocol.balanceFlushIntervalHours * HOURS_TO_SECONDS;
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.positionStorageService = new PositionStorageService();
    this.liquidityMathService = new LiquidityMathService();
  }

  private generateSchemaName(): string {
    const hash = createHash('md5')
      .update(
        this.protocol.type +
          this.protocol.name +
          this.protocol.contractAddress +
          this.chainConfig.networkId.toString(),
      )
      .digest('hex');
    return `orca-${hash}`;
  }

  async run(): Promise<void> {
    run(
      processor,
      new TypeormDatabase({ supportHotBlocks: false, stateSchema: this.schemaName }),
      async (ctx) => {
        try {
          await this.processBatch(ctx);
        } catch (error) {
          console.error('Error processing batch:', (error as Error).message);
          throw error;
        }
      },
    );
  }

  private async processBatch(ctx: any): Promise<void> {
    const blocks = ctx.blocks.map(augmentBlock);
    logger.info(
      `🔄 Processing batch of ${blocks.length} blocks, from ${blocks[0].header.height} to ${blocks[blocks.length - 1].header.height}`,
    );

    const protocolStates = await this.initializeProtocolStates(ctx);

    // Process blocks individually for all instructions
    for (const block of blocks) {
      logger.info(
        `🔄 Processing block ${block.header.height} with ${block.instructions.length} instructions, timestamp: ${new Date(block.header.timestamp).toISOString()}, slot: ${block.header.slot}, events: ${block.logs.length}`,
      );

      const blockInstructions: OrcaInstructionData[] = [];

      for (let ins of block.instructions) {
        if (ins.programId === whirlpoolProgram.programId) {
          logger.info(`🏊 [ProcessBatch] Decoding Whirlpool instruction:`, {
            instruction: ins,
          });
          const instructionData = this.decodeInstruction(ins, block);
          if (instructionData) {
            logger.info(`🏊 [ProcessBatch] Whirlpool instruction decoded:`, {
              instructionData,
            });
            blockInstructions.push(instructionData);
          }
        }
        // Check for Token program instructions (transfer and transferChecked)
        else if (
          ins.programId === tokenProgram.programId ||
          ins.programId === TOKEN_EXTENSION_PROGRAM_ID
        ) {
          logger.info(`🏊 [ProcessBatch] Decoding Token instruction:`, {
            instruction: ins,
          });
          const instructionData = this.decodeInstruction(ins, block);
          if (instructionData) {
            logger.info(`🏊 [ProcessBatch] Token instruction decoded:`, {
              instructionData,
            });
            blockInstructions.push(instructionData);
          }
        }
      }

      // Process all instructions for this block
      if (blockInstructions.length > 0) {
        await this.processBlockInstructions(blockInstructions, protocolStates);
      }

      await this.processPeriodicBalanceFlush(
        block.header.height,
        block.header.timestamp,
        protocolStates,
      );
    }
    await this.finalizeBatch(ctx, protocolStates);
  }

  private async initializeProtocolStates(ctx: any): Promise<Map<string, ProtocolStateOrca>> {
    const protocolStates = new Map<string, ProtocolStateOrca>();

    for (const pool of WHIRLPOOL_ADDRESSES) {
      const contractAddress = pool;
      protocolStates.set(contractAddress, {
        balanceWindows: [],
        transactions: [],
      });
    }

    return protocolStates;
  }

  //todo: update in the processor.ts later
  private isTargetPoolInstruction(whirlPoolAddress: string): boolean {
    logger.info(`🏊 [IsTargetPoolInstruction] Checking if ${whirlPoolAddress} is a target pool`);
    return WHIRLPOOL_ADDRESSES.map((addr) => addr.toLowerCase()).includes(
      whirlPoolAddress.toLowerCase(),
    );
  }

  // Update your decodeInstruction method to use this filter
  private decodeInstruction(ins: any, block: any): OrcaInstructionData | null {
    try {
      const slot = block.header.slot;
      const tx = ins.getTransaction().signatures[0];
      const tokenBalances = ins.getTransaction().tokenBalances;

      const baseData = {
        slot,
        txHash: tx,
        logIndex: null, //todo: find equivalent in solana
        blockHash: '', // todo: find equivalent in solana
        timestamp: block.header.timestamp,
        tokenBalances,
      };

      // Use switch statement to decode instruction
      switch (ins.d8) {
        case whirlpoolProgram.instructions.swap.d8:
          logger.info(`🏊 [ProcessBatch] Inner instructions swap (dp):`, {
            inner: ins.inner,
          });
          const innerTransfers = ins.inner
            ? ins.inner
                .map((inner: any) => {
                  try {
                    if (
                      (inner.programId === tokenProgram.programId ||
                        inner.programId === TOKEN_EXTENSION_PROGRAM_ID) &&
                      inner.d1 === tokenProgram.instructions.transfer.d1
                    ) {
                      return tokenProgram.instructions.transfer.decode({
                        accounts: inner.accounts,
                        data: inner.data,
                      });
                    } else if (
                      (inner.programId === tokenProgram.programId ||
                        inner.programId === TOKEN_EXTENSION_PROGRAM_ID) &&
                      inner.d1 === tokenProgram.instructions.transferChecked.d1
                    ) {
                      return tokenProgram.instructions.transferChecked.decode({
                        accounts: inner.accounts,
                        data: inner.data,
                      });
                    }
                    return null;
                  } catch (error) {
                    logger.warn(`Failed to decode transfer:`, {
                      error: error,
                      programId: inner.programId,
                    });
                    return null;
                  }
                })
                .filter((t: any) => t !== null)
            : [];

          logger.info(`🏊 [ProcessBatch] Inner transfers swap:`, {
            innerTransfers,
          });

          const decodedInstruction = whirlpoolProgram.instructions.swap.decode(ins);

          if (!this.isTargetPoolInstruction(decodedInstruction.accounts.whirlpool)) {
            return null;
          }

          return {
            ...baseData,
            type: 'swap',
            transfers: innerTransfers,
            decodedInstruction,
            shouldRewardUser: true,
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.swapV2.d8:
          logger.info(`🏊 [ProcessBatch] Inner instructions swapV2:`, {
            inner: ins.inner,
          });
          const innerTransfersV2 = ins.inner
            ? ins.inner
                .map((inner: any) => {
                  try {
                    if (
                      (inner.programId === tokenProgram.programId ||
                        inner.programId === TOKEN_EXTENSION_PROGRAM_ID) &&
                      inner.d1 === tokenProgram.instructions.transfer.d1
                    ) {
                      return tokenProgram.instructions.transfer.decode({
                        accounts: inner.accounts,
                        data: inner.data,
                      });
                    } else if (
                      (inner.programId === tokenProgram.programId ||
                        inner.programId === TOKEN_EXTENSION_PROGRAM_ID) &&
                      inner.d1 === tokenProgram.instructions.transferChecked.d1
                    ) {
                      return tokenProgram.instructions.transferChecked.decode({
                        accounts: inner.accounts,
                        data: inner.data,
                      });
                    }
                    return null;
                  } catch (error) {
                    logger.warn(`Failed to decode transfer:`, {
                      error: error,
                      programId: inner.programId,
                    });
                    return null;
                  }
                })
                .filter((t: any) => t !== null)
            : [];

          logger.info(`🏊 [ProcessBatch] Inner transfers swapV2:`, {
            innerTransfersV2,
          });

          const decodedSwapV2 = whirlpoolProgram.instructions.swapV2.decode(ins);
          if (!this.isTargetPoolInstruction(decodedSwapV2.accounts.whirlpool)) {
            return null;
          }

          return {
            ...baseData,
            type: 'swapV2',
            transfers: innerTransfersV2,
            decodedInstruction: decodedSwapV2,
            shouldRewardUser: true,
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.increaseLiquidity.d8:
          const decodedIncreaseLiquidity =
            whirlpoolProgram.instructions.increaseLiquidity.decode(ins);
          if (!this.isTargetPoolInstruction(decodedIncreaseLiquidity.accounts.whirlpool)) {
            return null;
          }
          return {
            ...baseData,
            type: 'increaseLiquidity',
            decodedInstruction: decodedIncreaseLiquidity,
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.decreaseLiquidity.d8:
          const decodedDecreaseLiquidity =
            whirlpoolProgram.instructions.decreaseLiquidity.decode(ins);
          if (!this.isTargetPoolInstruction(decodedDecreaseLiquidity.accounts.whirlpool)) {
            return null;
          }
          return {
            ...baseData,
            type: 'decreaseLiquidity',
            decodedInstruction: decodedDecreaseLiquidity,
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.collectFees.d8:
          const decodedCollectFees = whirlpoolProgram.instructions.collectFees.decode(ins);
          if (!this.isTargetPoolInstruction(decodedCollectFees.accounts.whirlpool)) {
            return null;
          }
          return {
            ...baseData,
            type: 'collectFees',
            decodedInstruction: decodedCollectFees,
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.collectProtocolFees.d8:
          const decodedCollectProtocolFees =
            whirlpoolProgram.instructions.collectProtocolFees.decode(ins);
          if (!this.isTargetPoolInstruction(decodedCollectProtocolFees.accounts.whirlpool)) {
            return null;
          }
          return {
            ...baseData,
            type: 'collectProtocolFees',
            decodedInstruction: decodedCollectProtocolFees,
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.collectReward.d8:
          const decodedCollectReward = whirlpoolProgram.instructions.collectReward.decode(ins);
          if (!this.isTargetPoolInstruction(decodedCollectReward.accounts.whirlpool)) {
            return null;
          }
          return {
            ...baseData,
            type: 'collectReward',
            decodedInstruction: decodedCollectReward,
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.collectFeesV2.d8:
          const decodedCollectFeesV2 = whirlpoolProgram.instructions.collectFeesV2.decode(ins);
          if (!this.isTargetPoolInstruction(decodedCollectFeesV2.accounts.whirlpool)) {
            return null;
          }
          return {
            ...baseData,
            type: 'collectFeesV2',
            decodedInstruction: decodedCollectFeesV2,
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.collectProtocolFeesV2.d8:
          const decodedCollectProtocolFeesV2 =
            whirlpoolProgram.instructions.collectProtocolFeesV2.decode(ins);
          if (!this.isTargetPoolInstruction(decodedCollectProtocolFeesV2.accounts.whirlpool)) {
            return null;
          }
          return {
            ...baseData,
            type: 'collectProtocolFeesV2',
            decodedInstruction: decodedCollectProtocolFeesV2,
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.collectRewardV2.d8:
          const decodedCollectRewardV2 = whirlpoolProgram.instructions.collectRewardV2.decode(ins);
          if (!this.isTargetPoolInstruction(decodedCollectRewardV2.accounts.whirlpool)) {
            return null;
          }
          return {
            ...baseData,
            type: 'collectRewardV2',
            decodedInstruction: decodedCollectRewardV2,
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.decreaseLiquidityV2.d8:
          const decodedDecreaseLiquidityV2 =
            whirlpoolProgram.instructions.decreaseLiquidityV2.decode(ins);
          if (!this.isTargetPoolInstruction(decodedDecreaseLiquidityV2.accounts.whirlpool)) {
            return null;
          }
          return {
            ...baseData,
            type: 'decreaseLiquidityV2',
            decodedInstruction: decodedDecreaseLiquidityV2,
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.increaseLiquidityV2.d8:
          const decodedIncreaseLiquidityV2 =
            whirlpoolProgram.instructions.increaseLiquidityV2.decode(ins);
          if (!this.isTargetPoolInstruction(decodedIncreaseLiquidityV2.accounts.whirlpool)) {
            return null;
          }
          return {
            ...baseData,
            type: 'increaseLiquidityV2',
            decodedInstruction: decodedIncreaseLiquidityV2,
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.twoHopSwapV2.d8:
          logger.info(`🏊 [ProcessBatch] Inner instructions twoHopSwapV2:`, {
            inner: ins.inner,
          });
          const decodedTwoHopSwapV2 = whirlpoolProgram.instructions.twoHopSwapV2.decode(ins);

          // Check if either whirlpoolOne or whirlpoolTwo is our target pool
          const isWhirlpoolOneTargetV2 = this.isTargetPoolInstruction(
            decodedTwoHopSwapV2.accounts.whirlpoolOne,
          );
          const isWhirlpoolTwoTargetV2 = this.isTargetPoolInstruction(
            decodedTwoHopSwapV2.accounts.whirlpoolTwo,
          );

          if (!isWhirlpoolOneTargetV2 && !isWhirlpoolTwoTargetV2) {
            return null;
          }

          // Determine which pool we're tracking and filter transfers accordingly
          const targetPoolAddressV2 = isWhirlpoolOneTargetV2
            ? decodedTwoHopSwapV2.accounts.whirlpoolOne
            : decodedTwoHopSwapV2.accounts.whirlpoolTwo;

          const allTransfersV2 = ins.inner
            ? ins.inner
                .map((inner: any) => {
                  try {
                    if (
                      (inner.programId === tokenProgram.programId ||
                        inner.programId === TOKEN_EXTENSION_PROGRAM_ID) &&
                      inner.d1 === tokenProgram.instructions.transfer.d1
                    ) {
                      return tokenProgram.instructions.transfer.decode({
                        accounts: inner.accounts,
                        data: inner.data,
                      });
                    } else if (
                      (inner.programId === tokenProgram.programId ||
                        inner.programId === TOKEN_EXTENSION_PROGRAM_ID) &&
                      inner.d1 === tokenProgram.instructions.transferChecked.d1
                    ) {
                      return tokenProgram.instructions.transferChecked.decode({
                        accounts: inner.accounts,
                        data: inner.data,
                      });
                    }
                    return null;
                  } catch (error) {
                    logger.warn(`Failed to decode transfer:`, {
                      error: error,
                      programId: inner.programId,
                    });
                    return null;
                  }
                })
                .filter((t: any) => t !== null)
            : [];

          // For twoHopSwapV2, extract only the 2 transfers relevant to our target pool
          // If we're tracking the first hop, take transfers 0 and 1
          // If we're tracking the second hop, take transfers 1 and 2
          let relevantTransfersV2: any[] = [];
          if (isWhirlpoolOneTargetV2) {
            // First hop: take first two transfers
            relevantTransfersV2 = allTransfersV2.slice(0, 2);
          } else if (isWhirlpoolTwoTargetV2) {
            // Second hop: take last two transfers
            relevantTransfersV2 = allTransfersV2.slice(-2);
          }

          logger.info(
            `🏊 [ProcessBatch] Filtered transfers for target pool ${targetPoolAddressV2}:`,
            {
              allTransfers: allTransfersV2.length,
              relevantTransfers: relevantTransfersV2.length,
              targetPool: targetPoolAddressV2,
              isFirstHop: isWhirlpoolOneTargetV2,
            },
          );

          // Create a modified decoded instruction that points to our target pool
          const modifiedDecodedInstructionV2 = {
            ...decodedTwoHopSwapV2,
            accounts: {
              ...decodedTwoHopSwapV2.accounts,
              whirlpool: targetPoolAddressV2, // Set the whirlpool to our target pool
            },
            data: {
              ...decodedTwoHopSwapV2.data,
              // Use the appropriate sqrtPriceLimit based on which hop we're tracking
              sqrtPriceLimit: isWhirlpoolOneTargetV2
                ? decodedTwoHopSwapV2.data.sqrtPriceLimitOne
                : decodedTwoHopSwapV2.data.sqrtPriceLimitTwo,
            },
          };

          if (isWhirlpoolOneTargetV2) {
            // First hop: should reward users
            return {
              ...baseData,
              type: 'twoHopSwapV2',
              transfers: relevantTransfersV2,
              decodedInstruction: modifiedDecodedInstructionV2,
              shouldRewardUser: true, // Add this flag
            } as OrcaInstructionData;
          } else if (isWhirlpoolTwoTargetV2) {
            // Second hop: should NOT reward users, only update ticks
            return {
              ...baseData,
              type: 'twoHopSwapV2',
              transfers: relevantTransfersV2,
              decodedInstruction: modifiedDecodedInstructionV2,
              shouldRewardUser: false, // Add this flag
            } as OrcaInstructionData;
          }

        case whirlpoolProgram.instructions.twoHopSwap.d8:
          logger.info(`🏊 [ProcessBatch] Inner instructions twoHopSwap:`, {
            inner: ins.inner,
          });
          const decodedTwoHopSwap = whirlpoolProgram.instructions.twoHopSwap.decode(ins);

          // Check if either whirlpoolOne or whirlpoolTwo is our target pool
          const isWhirlpoolOneTarget = this.isTargetPoolInstruction(
            decodedTwoHopSwap.accounts.whirlpoolOne,
          );
          const isWhirlpoolTwoTarget = this.isTargetPoolInstruction(
            decodedTwoHopSwap.accounts.whirlpoolTwo,
          );

          if (!isWhirlpoolOneTarget && !isWhirlpoolTwoTarget) {
            return null;
          }

          // Determine which pool we're tracking and filter transfers accordingly
          const targetPoolAddress = isWhirlpoolOneTarget
            ? decodedTwoHopSwap.accounts.whirlpoolOne
            : decodedTwoHopSwap.accounts.whirlpoolTwo;

          const allTransfers = ins.inner
            ? ins.inner
                .map((inner: any) => {
                  try {
                    if (
                      (inner.programId === tokenProgram.programId ||
                        inner.programId === TOKEN_EXTENSION_PROGRAM_ID) &&
                      inner.d1 === tokenProgram.instructions.transfer.d1
                    ) {
                      return tokenProgram.instructions.transfer.decode({
                        accounts: inner.accounts,
                        data: inner.data,
                      });
                    } else if (
                      (inner.programId === tokenProgram.programId ||
                        inner.programId === TOKEN_EXTENSION_PROGRAM_ID) &&
                      inner.d1 === tokenProgram.instructions.transferChecked.d1
                    ) {
                      return tokenProgram.instructions.transferChecked.decode({
                        accounts: inner.accounts,
                        data: inner.data,
                      });
                    }
                    return null;
                  } catch (error) {
                    logger.warn(`Failed to decode transfer:`, {
                      error: error,
                      programId: inner.programId,
                    });
                    return null;
                  }
                })
                .filter((t: any) => t !== null)
            : [];

          // For twoHopSwap, extract only the 2 transfers relevant to our target pool
          // If we're tracking the first hop, take transfers 0 and 1
          // If we're tracking the second hop, take transfers 1 and 2
          let relevantTransfers: any[] = [];
          if (isWhirlpoolOneTarget) {
            // First hop: take first two transfers
            relevantTransfers = allTransfers.slice(0, 2);
          } else if (isWhirlpoolTwoTarget) {
            // Second hop: take last two transfers
            relevantTransfers = allTransfers.slice(-2);
          }

          logger.info(
            `🏊 [ProcessBatch] Filtered transfers for target pool ${targetPoolAddress}:`,
            {
              allTransfers: allTransfers.length,
              relevantTransfers: relevantTransfers.length,
              targetPool: targetPoolAddress,
              isFirstHop: isWhirlpoolOneTarget,
            },
          );

          // Create a modified decoded instruction that points to our target pool
          const modifiedDecodedInstruction = {
            ...decodedTwoHopSwap,
            accounts: {
              ...decodedTwoHopSwap.accounts,
              whirlpool: targetPoolAddress, // Set the whirlpool to our target pool
            },
            data: {
              ...decodedTwoHopSwap.data,
              // Use the appropriate sqrtPriceLimit based on which hop we're tracking
              sqrtPriceLimit: isWhirlpoolOneTarget
                ? decodedTwoHopSwap.data.sqrtPriceLimitOne
                : decodedTwoHopSwap.data.sqrtPriceLimitTwo,
            },
          };

          if (isWhirlpoolOneTarget) {
            // First hop: should reward users
            return {
              ...baseData,
              type: 'twoHopSwap',
              transfers: relevantTransfers,
              decodedInstruction: modifiedDecodedInstruction,
              shouldRewardUser: true, // Add this flag
            } as OrcaInstructionData;
          } else if (isWhirlpoolTwoTarget) {
            // Second hop: should NOT reward users, only update ticks
            return {
              ...baseData,
              type: 'twoHopSwap',
              transfers: relevantTransfers,
              decodedInstruction: modifiedDecodedInstruction,
              shouldRewardUser: false, // Add this flag
            } as OrcaInstructionData;
          }

        case whirlpoolProgram.instructions.openPosition.d8:
          const decodedOpenPosition = whirlpoolProgram.instructions.openPosition.decode(ins);
          if (!this.isTargetPoolInstruction(decodedOpenPosition.accounts.whirlpool)) {
            return null;
          }
          return {
            ...baseData,
            type: 'openPosition',
            decodedInstruction: decodedOpenPosition,
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.closePosition.d8:
          const decodedClosePosition = whirlpoolProgram.instructions.closePosition.decode(ins);

          return {
            ...baseData,
            type: 'closePosition',
            decodedInstruction: decodedClosePosition,
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.openPositionWithTokenExtensions.d8:
          const decodedOpenPositionWithTokenExtensions =
            whirlpoolProgram.instructions.openPositionWithTokenExtensions.decode(ins);

          if (
            !this.isTargetPoolInstruction(decodedOpenPositionWithTokenExtensions.accounts.whirlpool)
          ) {
            logger.info(
              `🏊 [ProcessBatch] Open position with token extensions is not a target pool`,
            );
            return null;
          }
          return {
            ...baseData,
            type: 'openPositionWithTokenExtensions',
            decodedInstruction: decodedOpenPositionWithTokenExtensions,
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.closePositionWithTokenExtensions.d8:
          const decodedClosePositionWithTokenExtensions =
            whirlpoolProgram.instructions.closePositionWithTokenExtensions.decode(ins);

          return {
            ...baseData,
            type: 'closePositionWithTokenExtensions',
            decodedInstruction: decodedClosePositionWithTokenExtensions,
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.openPositionWithMetadata.d8:
          const decodedOpenPositionWithMetadata =
            whirlpoolProgram.instructions.openPositionWithMetadata.decode(ins);
          if (!this.isTargetPoolInstruction(decodedOpenPositionWithMetadata.accounts.whirlpool)) {
            return null;
          }
          return {
            ...baseData,
            type: 'openPositionWithMetadata',
            decodedInstruction: decodedOpenPositionWithMetadata,
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.initializePoolV2.d8:
          const decodedInitializePoolV2 =
            whirlpoolProgram.instructions.initializePoolV2.decode(ins);
          if (!this.isTargetPoolInstruction(decodedInitializePoolV2.accounts.whirlpool)) {
            return null;
          }
          return {
            ...baseData,
            type: 'initializePoolV2',
            decodedInstruction: decodedInitializePoolV2,
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.initializePool.d8:
          const decodedInitializePool = whirlpoolProgram.instructions.initializePool.decode(ins);
          if (!this.isTargetPoolInstruction(decodedInitializePool.accounts.whirlpool)) {
            return null;
          }
          return {
            ...baseData,
            type: 'initializePool',
            decodedInstruction: decodedInitializePool,
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.initializePoolWithAdaptiveFee.d8:
          const decodedInitializePoolWithAdaptiveFee =
            whirlpoolProgram.instructions.initializePoolWithAdaptiveFee.decode(ins);
          if (
            !this.isTargetPoolInstruction(decodedInitializePoolWithAdaptiveFee.accounts.whirlpool)
          ) {
            return null;
          }
          return {
            ...baseData,
            type: 'initializePoolWithAdaptiveFee',
            decodedInstruction: decodedInitializePoolWithAdaptiveFee,
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.resetPositionRange.d8:
          const decodedResetPositionRange =
            whirlpoolProgram.instructions.resetPositionRange.decode(ins);
          if (!this.isTargetPoolInstruction(decodedResetPositionRange.accounts.whirlpool)) {
            return null;
          }
          return {
            ...baseData,
            type: 'resetPositionRange',
            decodedInstruction: decodedResetPositionRange,
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.transferLockedPosition.d8:
          return {
            ...baseData,
            type: 'transferLockedPosition',
            decodedInstruction: whirlpoolProgram.instructions.transferLockedPosition.decode(ins),
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.lockPosition.d8:
          return {
            ...baseData,
            type: 'lockPosition',
            decodedInstruction: whirlpoolProgram.instructions.lockPosition.decode(ins),
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.openBundledPosition.d8:
          return {
            ...baseData,
            type: 'openBundledPosition',
            decodedInstruction: whirlpoolProgram.instructions.openBundledPosition.decode(ins),
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.closeBundledPosition.d8:
          return {
            ...baseData,
            type: 'closeBundledPosition',
            decodedInstruction: whirlpoolProgram.instructions.closeBundledPosition.decode(ins),
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.initializePositionBundle.d8:
          return {
            ...baseData,
            type: 'initializePositionBundle',
            decodedInstruction: whirlpoolProgram.instructions.initializePositionBundle.decode(ins),
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.initializePositionBundleWithMetadata.d8:
          return {
            ...baseData,
            type: 'initializePositionBundleWithMetadata',
            decodedInstruction:
              whirlpoolProgram.instructions.initializePositionBundleWithMetadata.decode(ins),
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.deletePositionBundle.d8:
          return {
            ...baseData,
            type: 'deletePositionBundle',
            decodedInstruction: whirlpoolProgram.instructions.deletePositionBundle.decode(ins),
          } as OrcaInstructionData;

        default:
          // If d8 doesn't match, try d1 for Token instructions
          switch (ins.d1) {
            case tokenProgram.instructions.transfer.d1:
              return {
                ...baseData,
                type: 'transfer',
                decodedInstruction: tokenProgram.instructions.transfer.decode(ins),
              } as OrcaInstructionData;

            case tokenProgram.instructions.transferChecked.d1:
              logger.info(`🏊 [ProcessBatch] transferChecked instruction:`, {
                inner: ins.inner,
                programId: ins.programId,
              });
              return {
                ...baseData,
                type: 'transferChecked',
                tokenBalances,
                decodedInstruction: tokenProgram.instructions.transferChecked.decode(ins),
              } as OrcaInstructionData;

            default:
              return null;
          }
      }
    } catch (error) {
      logger.warn(`⚠️ [DecodeInstruction] Failed to decode instruction:`, {
        error: error as Error,
        discriminator: ins.d8,
        programId: ins.programId,
      });
      return null; // Skip this instruction instead of crashing
    }
  }

  private async processBlockInstructions(
    blockInstructions: OrcaInstructionData[],
    protocolStates: Map<string, ProtocolStateOrca>,
  ): Promise<void> {
    // Group non-pool instructions by category
    const swapInstructions = blockInstructions.filter((data) =>
      ['swap', 'swapV2', 'twoHopSwap', 'twoHopSwapV2'].includes(data.type),
    );

    const liquidityInstructions = blockInstructions.filter((data) =>
      [
        'increaseLiquidity',
        'decreaseLiquidity',
        'increaseLiquidityV2',
        'decreaseLiquidityV2',
      ].includes(data.type),
    );

    const feeInstructions = blockInstructions.filter((data) =>
      [
        'collectFees',
        'collectProtocolFees',
        'collectFeesV2',
        'collectProtocolFeesV2',
        'collectReward',
        'collectRewardV2',
      ].includes(data.type),
    );

    const openPositionInstructions = blockInstructions.filter((data) =>
      ['openPosition', 'openPositionWithTokenExtensions', 'openPositionWithMetadata'].includes(
        data.type,
      ),
    );

    const closePositionInstructions = blockInstructions.filter((data) =>
      ['closePosition', 'closePositionWithTokenExtensions'].includes(data.type),
    );

    const poolInstructions = blockInstructions.filter((data) =>
      ['initializePoolV2', 'initializePool', 'initializePoolWithAdaptiveFee'].includes(data.type),
    );

    const transferInstructions = blockInstructions.filter((data) =>
      ['transfer', 'transferChecked'].includes(data.type),
    );

    const extraPositionInstructions = blockInstructions.filter((data) =>
      ['resetPositionRange', 'transferLockedPosition', 'lockPosition'].includes(data.type),
    );

    const openBundledPositionInstructions = blockInstructions.filter((data) =>
      [
        'openBundledPosition',
        'initializePositionBundle',
        'initializePositionBundleWithMetadata',
      ].includes(data.type),
    );

    const closeBundledPositionInstructions = blockInstructions.filter((data) =>
      ['closeBundledPosition', 'deletePositionBundle'].includes(data.type),
    );

    if (poolInstructions.length > 0) {
      await processPoolInstructions(
        poolInstructions,
        protocolStates,
        this.liquidityMathService,
        this.positionStorageService,
      );
    }

    if (swapInstructions.length > 0) {
      await processSwapInstructions(
        swapInstructions,
        protocolStates,
        this.positionStorageService,
        this.liquidityMathService,
      );
    }

    if (transferInstructions.length > 0) {
      await processTransferInstructions(
        transferInstructions,
        protocolStates,
        this.positionStorageService,
        this.liquidityMathService,
      );
    }

    if (openPositionInstructions.length > 0) {
      logger.info(
        `🏊 [ProcessBlockInstructions] Processing ${openPositionInstructions.length} open position instructions`,
      );
      await processPositionInstructions(
        openPositionInstructions,
        protocolStates,
        this.positionStorageService,
        this.liquidityMathService,
      );
    }

    if (openBundledPositionInstructions.length > 0) {
      logger.info(
        `🏊 [ProcessBlockInstructions] Processing ${openBundledPositionInstructions.length} open bundled position instructions`,
      );
      await processBundlePositionInstructions(
        openBundledPositionInstructions,
        protocolStates,
        this.positionStorageService,
        this.liquidityMathService,
        this.connection,
      );
    }

    if (liquidityInstructions.length > 0) {
      await processLiquidityInstructions(
        liquidityInstructions,
        protocolStates,
        this.positionStorageService,
        this.liquidityMathService,
      );
    }

    if (closePositionInstructions.length > 0) {
      logger.info(
        `🏊 [ProcessBlockInstructions] Processing ${closePositionInstructions.length} close position instructions`,
      );
      await processPositionInstructions(
        closePositionInstructions,
        protocolStates,
        this.positionStorageService,
        this.liquidityMathService,
      );
    }

    if (closeBundledPositionInstructions.length > 0) {
      logger.info(
        `🏊 [ProcessBlockInstructions] Processing ${closeBundledPositionInstructions.length} close bundled position instructions`,
      );
      await processBundlePositionInstructions(
        closeBundledPositionInstructions,
        protocolStates,
        this.positionStorageService,
        this.liquidityMathService,
        this.connection,
      );
    }

    if (feeInstructions.length > 0) {
      await processFeeInstructions(feeInstructions, protocolStates);
    }

    if (extraPositionInstructions.length > 0) {
      await processPositionInstructions(
        extraPositionInstructions,
        protocolStates,
        this.positionStorageService,
        this.liquidityMathService,
      );
    }
  }

  private async processPeriodicBalanceFlush(
    slot: number,
    timestamp: number,
    protocolStates: Map<string, ProtocolStateOrca>,
  ): Promise<void> {
    for (const [contractAddress, protocolState] of protocolStates.entries()) {
      const positionsByPoolId =
        await this.positionStorageService.getAllPositionsByPoolId(contractAddress);
      logger.info(`🏊 [ProcessPeriodicBalanceFlush] Positions by pool id:`, {
        positionsByPoolId: positionsByPoolId.length,
        contractAddress,
      });
      const pool = await this.positionStorageService.getPool(contractAddress);
      logger.info(`🏊 [ProcessPeriodicBalanceFlush] Pool:`, {
        pool,
        contractAddress,
      });
      if (positionsByPoolId.length === 0) {
        continue;
      }

      for (const position of positionsByPoolId) {
        logger.info(`🏊 [ProcessPeriodicBalanceFlush] Position:`, {
          position,
          contractAddress,
        });
        if (position.isActive === 'true') {
          logger.info(`🏊 [ProcessPeriodicBalanceFlush] Position is active:`, {
            position,
            contractAddress,
          });
          await this.processPositionExhaustion(position, pool!, slot, timestamp, protocolStates);
        }
      }
    }
  }

  private async processPositionExhaustion(
    position: PositionDetails,
    pool: PoolDetails,
    slot: number,
    timestamp: number,
    protocolStates: Map<string, ProtocolStateOrca>,
  ): Promise<void> {
    const currentTs = timestamp;

    logger.info(`🔍 [ProcessPositionExhaustion] Starting exhaustion check:`, {
      positionId: position.positionId,
      poolId: position.poolId,
      owner: position.owner,
      isActive: position.isActive,
      currentTs,
      slot,
      refreshWindow: this.refreshWindow,
      refreshWindowHours: this.refreshWindow / (60 * 60), // Convert seconds to hours for readability
    });

    if (!position.lastUpdatedBlockTs) {
      logger.info(
        `🆕 [ProcessPositionExhaustion] First time processing position - setting initial timestamp:`,
        {
          positionId: position.positionId,
          currentTs,
        },
      );
      position.lastUpdatedBlockTs = currentTs;
      await this.positionStorageService.updatePosition(position);
      return;
    }

    // Debug the while condition
    const timeSinceLastUpdate = currentTs - Number(position.lastUpdatedBlockTs);
    const shouldProcess = Number(position.lastUpdatedBlockTs) + this.refreshWindow <= currentTs;

    logger.info(`🔍 [ProcessPositionExhaustion] Time analysis:`, {
      positionId: position.positionId,
      lastUpdatedBlockTs: position.lastUpdatedBlockTs,
      currentTs,
      timeSinceLastUpdate,
      timeSinceLastUpdateHours: timeSinceLastUpdate / (60 * 60),
      refreshWindow: this.refreshWindow,
      shouldProcess,
      calculation: `${Number(position.lastUpdatedBlockTs)} + ${this.refreshWindow} <= ${currentTs}`,
    });

    if (!shouldProcess) {
      logger.info(`⏭️ [ProcessPositionExhaustion] Skipping - not enough time elapsed:`, {
        positionId: position.positionId,
        timeRemaining: Number(position.lastUpdatedBlockTs) + this.refreshWindow - currentTs,
        timeRemainingHours:
          (Number(position.lastUpdatedBlockTs) + this.refreshWindow - currentTs) / (60 * 60),
      });
      return;
    }

    let windowCount = 0;
    while (
      position.lastUpdatedBlockTs &&
      Number(position.lastUpdatedBlockTs) + this.refreshWindow <= currentTs
    ) {
      windowCount++;
      logger.info(`🔄 [ProcessPositionExhaustion] Processing window ${windowCount}:`, {
        positionId: position.positionId,
        lastUpdatedBlockTs: position.lastUpdatedBlockTs,
      });

      const windowsSinceEpoch = Math.floor(
        Number(position.lastUpdatedBlockTs) / this.refreshWindow,
      );
      const nextBoundaryTs: number = (windowsSinceEpoch + 1) * this.refreshWindow;

      logger.info(`🔍 [ProcessPositionExhaustion] Window calculation:`, {
        positionId: position.positionId,
        windowsSinceEpoch,
        nextBoundaryTs,
        currentTs,
        windowDuration: nextBoundaryTs - Number(position.lastUpdatedBlockTs),
        windowDurationHours: (nextBoundaryTs - Number(position.lastUpdatedBlockTs)) / (60 * 60),
      });

      if (!pool.token0Id || !pool.token1Id) {
        logger.warn(`❌ Skipping position ${position.positionId} - missing token data:`, {
          token0Exists: !!pool.token0Id,
          token0Id: pool.token0Id,
          token1Exists: !!pool.token1Id,
          token1Id: pool.token1Id,
          pool,
        });
        return;
      }

      const liquidity = BigInt(position.liquidity);
      logger.info(`🔍 [ProcessPositionExhaustion] Position details:`, {
        positionId: position.positionId,
        liquidity: position.liquidity,
        tickLower: position.tickLower,
        tickUpper: position.tickUpper,
        poolCurrentTick: pool.currentTick,
        isInRange: position.tickLower <= pool.currentTick && position.tickUpper > pool.currentTick,
      });

      const { humanAmount0: oldHumanAmount0, humanAmount1: oldHumanAmount1 } =
        this.liquidityMathService.getAmountsForLiquidityRaw(
          liquidity,
          position.tickLower,
          position.tickUpper,
          pool.currentTick,
          pool.token0Decimals,
          pool.token1Decimals,
        );

      logger.info(`🔍 [ProcessPositionExhaustion] Liquidity amounts:`, {
        positionId: position.positionId,
        humanAmount0: oldHumanAmount0,
        humanAmount1: oldHumanAmount1,
        token0Decimals: pool.token0Decimals,
        token1Decimals: pool.token1Decimals,
      });

      const [token0inUSD, token1inUSD] = await getOptimizedTokenPrices(
        position.poolId,
        { id: pool.token0Id, decimals: pool.token0Decimals },
        { id: pool.token1Id, decimals: pool.token1Decimals },
        timestamp,
        'solana',
      );

      logger.info(`🔍 [ProcessPositionExhaustion] Token prices:`, {
        positionId: position.positionId,
        token0Id: pool.token0Id,
        token1Id: pool.token1Id,
        token0inUSD,
        token1inUSD,
      });

      const oldLiquidityUSD =
        Number(oldHumanAmount0) * token0inUSD + Number(oldHumanAmount1) * token1inUSD;

      logger.info(`🔍 [ProcessPositionExhaustion] USD value calculation:`, {
        positionId: position.positionId,
        oldLiquidityUSD,
        calculation: `(${oldHumanAmount0} * ${token0inUSD}) + (${oldHumanAmount1} * ${token1inUSD})`,
      });

      const shouldCreateWindow =
        oldLiquidityUSD > 0 && position.lastUpdatedBlockTs < nextBoundaryTs;
      logger.info(`🔍 [ProcessPositionExhaustion] Balance window conditions:`, {
        positionId: position.positionId,
        oldLiquidityUSD,
        condition1: oldLiquidityUSD > 0,
        lastUpdatedBlockTs: position.lastUpdatedBlockTs,
        nextBoundaryTs,
        condition2: position.lastUpdatedBlockTs < nextBoundaryTs,
        shouldCreateWindow,
      });

      if (shouldCreateWindow) {
        const balanceWindow = {
          userAddress: position.owner,
          deltaAmount: 0,
          trigger: TimeWindowTrigger.EXHAUSTED,
          startTs: position.lastUpdatedBlockTs,
          endTs: nextBoundaryTs,
          windowDurationMs: this.refreshWindow * 1000, // Convert to milliseconds
          startBlockNumber: position.lastUpdatedBlockHeight,
          endBlockNumber: slot,
          txHash: null,
          currency: Currency.USD,
          valueUsd: Number(oldLiquidityUSD),
          balanceBefore: oldLiquidityUSD.toString(),
          balanceAfter: oldLiquidityUSD.toString(),
          tokenPrice: 0,
          tokenDecimals: 0,
          tokens: {
            isActive: {
              value: 'true',
              type: 'boolean',
            },
            currentTick: {
              value: pool.currentTick.toString(),
              type: 'number',
            },
            tickLower: {
              value: position.tickLower.toString(),
              type: 'number',
            },
            tickUpper: {
              value: position.tickUpper.toString(),
              type: 'number',
            },
            liquidity: {
              value: position.liquidity.toString(),
              type: 'number',
            },
            token0Id: {
              value: pool.token0Id,
              type: 'string',
            },
            token1Id: {
              value: pool.token1Id,
              type: 'string',
            },
          },
        };

        const poolState = protocolStates.get(position.poolId);

        if (poolState) {
          poolState.balanceWindows.push(balanceWindow);
          logger.info(
            `✅ [ProcessPositionExhaustion] Added balance window to existing pool state:`,
            {
              positionId: position.positionId,
              poolId: position.poolId,
              windowsCount: poolState.balanceWindows.length,
              balanceWindow,
            },
          );
        } else {
          protocolStates.set(position.poolId, {
            balanceWindows: [balanceWindow],
            transactions: [],
          });
          logger.info(
            `✅ [ProcessPositionExhaustion] Created new pool state with balance window:`,
            {
              positionId: position.positionId,
              poolId: position.poolId,
              balanceWindow,
            },
          );
        }
      } else {
        logger.info(`⏭️ [ProcessPositionExhaustion] Skipping balance window creation:`, {
          positionId: position.positionId,
          reason: oldLiquidityUSD <= 0 ? 'Zero liquidity USD' : 'Timestamp condition not met',
          oldLiquidityUSD,
          lastUpdatedBlockTs: position.lastUpdatedBlockTs,
          nextBoundaryTs,
        });
      }

      position.lastUpdatedBlockTs = nextBoundaryTs;
      position.lastUpdatedBlockHeight = slot;

      await this.positionStorageService.updatePosition(position);

      // Safety check to prevent infinite loops
    }

    logger.info(`🏁 [ProcessPositionExhaustion] Completed exhaustion processing:`, {
      positionId: position.positionId,
      windowsProcessed: windowCount,
      finalLastUpdatedBlockTs: position.lastUpdatedBlockTs,
    });
  }

  private async finalizeBatch(
    ctx: any,
    protocolStates: Map<string, ProtocolStateOrca>,
  ): Promise<void> {
    logger.info('Finalizing batch...');

    for (const pool of WHIRLPOOL_ADDRESSES) {
      const contractAddress = pool;
      const protocolState = protocolStates.get(contractAddress)!;

      const transactions = toTransaction(
        protocolState.transactions,
        //todo: we will remove this in revamp
        {
          contractAddress: pool,
          name: 'Orca',
          type: 'orca',
          fromBlock: 0,
          pricingStrategy: PriceFeed.COINGECKO,
          token0: {
            coingeckoId: 'token0',
            decimals: 18,
            address: 'token0',
            symbol: 'token0',
          },
          token1: {
            coingeckoId: 'token1',
            decimals: 18,
            address: 'token1',
            symbol: 'token1',
          },
          preferredTokenCoingeckoId: TokenPreference.FIRST,
        },
        this.env,
        this.chainConfig,
      );

      const balances = toTimeWeightedBalance(
        protocolState.balanceWindows,
        //todo: we will remove this in revamp
        {
          contractAddress: pool,
          name: 'Orca',
          type: 'orca',
          fromBlock: 0,
          pricingStrategy: PriceFeed.COINGECKO,
          token0: {
            coingeckoId: 'token0',
            decimals: 18,
            address: 'token0',
            symbol: 'token0',
          },
          token1: {
            coingeckoId: 'token1',
            decimals: 18,
            address: 'token1',
            symbol: 'token1',
          },
          preferredTokenCoingeckoId: TokenPreference.FIRST,
        },
        this.env,
        this.chainConfig,
      );

      logger.info(`🏊 [FinalizeBatch] Transactions:`, {
        transactions: JSON.stringify(transactions, null, 2),
      });

      logger.info(
        `🏊 [FinalizeBatch] Pool: ${pool}, Transactions: ${transactions.length}, Balances: ${balances.length}`,
      );

      await this.apiClient.send(transactions);
      await this.apiClient.send(balances);
    }
  }
}
