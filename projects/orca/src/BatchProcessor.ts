import { run } from '@subsquid/batch-processor';

import {
  AbsintheApiClient,
  Chain,
  Currency,
  MessageType,
  ValidatedEnvBase,
  ProtocolState,
  Transaction,
  toTransaction,
  logger,
  HOURS_TO_MS,
  PriceFeed,
  TokenPreference,
} from '@absinthe/common';
import * as whirlpoolProgram from './abi/whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
import * as tokenProgram from './abi/TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
import { processor } from './processor';
import { createHash } from 'crypto';
import { TypeormDatabase } from '@subsquid/typeorm-store';

import { OrcaProtocol, ProtocolStateOrca, OrcaInstructionData } from './utils/types';
import { augmentBlock } from '@subsquid/solana-objects';
import { TRACKED_TOKENS, WHIRLPOOL_ADDRESSES } from './utils/consts';
import { TokenBalance } from './utils/types';

// Import all the mapping handlers
import { processSwapInstructions } from './mappings/swapInstructions';
import { processLiquidityInstructions } from './mappings/liquidityInstructions';
import { processFeeInstructions } from './mappings/feeInstructions';
import { processPositionInstructions } from './mappings/positionInstructions';
import { processPoolInstructions } from './mappings/poolInstructions';
import { processTransferInstructions } from './mappings/transferInstruction';
import { LiquidityMathService } from './services/LiquidityMathService';
import { PositionStorageService } from './services/PositionStorageService';
export class OrcaProcessor {
  private readonly protocol: OrcaProtocol;
  private readonly schemaName: string;
  private readonly refreshWindow: number;
  private readonly apiClient: AbsintheApiClient;
  private readonly chainConfig: Chain;
  private readonly env: ValidatedEnvBase;
  private readonly liquidityMathService: LiquidityMathService;
  private readonly positionStorageService: PositionStorageService;
  constructor(
    dexProtocol: OrcaProtocol,
    refreshWindow: number,
    apiClient: AbsintheApiClient,
    env: ValidatedEnvBase,
    chainConfig: Chain,
  ) {
    this.protocol = dexProtocol;
    this.refreshWindow = refreshWindow;
    this.apiClient = apiClient;
    this.env = env;
    this.chainConfig = chainConfig;
    this.schemaName = this.generateSchemaName();
    this.refreshWindow = this.protocol.balanceFlushIntervalHours * HOURS_TO_MS;

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
          logger.info(`🏊 [ProcessBatch] Decoding instruction:`, {
            instruction: ins,
          });
          const instructionData = this.decodeInstruction(ins, block);
          if (instructionData) {
            logger.info(`🏊 [ProcessBatch] Instruction decoded:`, {
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
    }

    await this.finalizeBatch(ctx, protocolStates);
  }

  private async initializeProtocolStates(ctx: any): Promise<Map<string, ProtocolStateOrca>> {
    const protocolStates = new Map<string, ProtocolStateOrca>();

    for (const pool of WHIRLPOOL_ADDRESSES) {
      const contractAddress = pool.toLowerCase();
      protocolStates.set(contractAddress, {
        balanceWindows: [],
        transactions: [],
      });
    }

    logger.info(
      `🏊 [InitializeProtocolStates] Protocol states initialized for ${protocolStates.size} pools`,
    );
    for (const [pool, state] of protocolStates) {
      logger.info(`🏊 [InitializeProtocolStates] Pool: ${pool}, State: ${JSON.stringify(state)}`);
    }

    return protocolStates;
  }

  private isTargetPoolInstruction(whirlPoolAddress: string): boolean {
    return WHIRLPOOL_ADDRESSES.includes(whirlPoolAddress.toLowerCase());
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
          logger.info(`🏊 [ProcessBatch] Inner instructions swap:`, {
            inner: ins.inner,
          });
          const innerTransfers = ins.inner
            ? ins.inner
                .map((inner: any) => {
                  try {
                    return tokenProgram.instructions.transfer.decode({
                      accounts: inner.accounts,
                      data: inner.data,
                    });
                  } catch {
                    return null;
                  }
                })
                .filter((t: any) => t !== null)
            : [];

          logger.info(`🏊 [ProcessBatch] Inner transfers swap:`, {
            innerTransfers,
          });

          return {
            ...baseData,
            type: 'swap',
            transfers: innerTransfers,
            decodedInstruction: whirlpoolProgram.instructions.swap.decode(ins),
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.swapV2.d8:
          logger.info(`🏊 [ProcessBatch] Inner instructions swapV2:`, {
            inner: ins.inner,
          });
          const innerTransfersV2 = ins.inner
            ? ins.inner
                .map((inner: any) => {
                  try {
                    return tokenProgram.instructions.transfer.decode({
                      accounts: inner.accounts,
                      data: inner.data,
                    });
                  } catch {
                    return null;
                  }
                })
                .filter((t: any) => t !== null)
            : [];

          logger.info(`🏊 [ProcessBatch] Inner transfers swapV2:`, {
            innerTransfersV2,
          });

          return {
            ...baseData,
            type: 'swapV2',
            transfers: innerTransfersV2,
            decodedInstruction: whirlpoolProgram.instructions.swapV2.decode(ins),
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.increaseLiquidity.d8:
          return {
            ...baseData,
            type: 'increaseLiquidity',
            decodedInstruction: whirlpoolProgram.instructions.increaseLiquidity.decode(ins),
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.decreaseLiquidity.d8:
          return {
            ...baseData,
            type: 'decreaseLiquidity',
            decodedInstruction: whirlpoolProgram.instructions.decreaseLiquidity.decode(ins),
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.collectFees.d8:
          return {
            ...baseData,
            type: 'collectFees',
            decodedInstruction: whirlpoolProgram.instructions.collectFees.decode(ins),
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.collectProtocolFees.d8:
          return {
            ...baseData,
            type: 'collectProtocolFees',
            decodedInstruction: whirlpoolProgram.instructions.collectProtocolFees.decode(ins),
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.collectReward.d8:
          return {
            ...baseData,
            type: 'collectReward',
            decodedInstruction: whirlpoolProgram.instructions.collectReward.decode(ins),
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.collectFeesV2.d8:
          return {
            ...baseData,
            type: 'collectFeesV2',
            decodedInstruction: whirlpoolProgram.instructions.collectFeesV2.decode(ins),
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.collectProtocolFeesV2.d8:
          return {
            ...baseData,
            type: 'collectProtocolFeesV2',
            decodedInstruction: whirlpoolProgram.instructions.collectProtocolFeesV2.decode(ins),
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.collectRewardV2.d8:
          return {
            ...baseData,
            type: 'collectRewardV2',
            decodedInstruction: whirlpoolProgram.instructions.collectRewardV2.decode(ins),
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.decreaseLiquidityV2.d8:
          return {
            ...baseData,
            type: 'decreaseLiquidityV2',
            decodedInstruction: whirlpoolProgram.instructions.decreaseLiquidityV2.decode(ins),
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.increaseLiquidityV2.d8:
          return {
            ...baseData,
            type: 'increaseLiquidityV2',
            decodedInstruction: whirlpoolProgram.instructions.increaseLiquidityV2.decode(ins),
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.twoHopSwapV2.d8:
          const innerTransfersTwoHopSwapV2 = ins.inner
            ? ins.inner
                .map((inner: any) => {
                  try {
                    return tokenProgram.instructions.transfer.decode(inner);
                  } catch {
                    return null;
                  }
                })
                .filter((t: any) => t !== null)
            : [];
          return {
            ...baseData,
            type: 'twoHopSwapV2',
            transfers: innerTransfersTwoHopSwapV2,
            decodedInstruction: whirlpoolProgram.instructions.twoHopSwapV2.decode(ins),
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.twoHopSwap.d8:
          const twoHopTransfers = ins.inner
            ? ins.inner
                .map((inner: any) => {
                  try {
                    return tokenProgram.instructions.transfer.decode({
                      accounts: inner.accounts,
                      data: inner.data,
                    });
                  } catch {
                    return null;
                  }
                })
                .filter((t: any) => t !== null)
            : [];

          return {
            ...baseData,
            type: 'twoHopSwap',
            transfers: twoHopTransfers,
            decodedInstruction: whirlpoolProgram.instructions.twoHopSwap.decode(ins),
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.openPosition.d8:
          return {
            ...baseData,
            type: 'openPosition',
            decodedInstruction: whirlpoolProgram.instructions.openPosition.decode(ins),
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.closePosition.d8:
          return {
            ...baseData,
            type: 'closePosition',
            decodedInstruction: whirlpoolProgram.instructions.closePosition.decode(ins),
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.openPositionWithTokenExtensions.d8:
          return {
            ...baseData,
            type: 'openPositionWithTokenExtensions',
            decodedInstruction:
              whirlpoolProgram.instructions.openPositionWithTokenExtensions.decode(ins),
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.closePositionWithTokenExtensions.d8:
          return {
            ...baseData,
            type: 'closePositionWithTokenExtensions',
            decodedInstruction:
              whirlpoolProgram.instructions.closePositionWithTokenExtensions.decode(ins),
          } as OrcaInstructionData;
        case whirlpoolProgram.instructions.openPositionWithMetadata.d8:
          return {
            ...baseData,
            type: 'openPositionWithMetadata',
            decodedInstruction: whirlpoolProgram.instructions.openPositionWithMetadata.decode(ins),
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.initializePoolV2.d8:
          return {
            ...baseData,
            type: 'initializePoolV2',
            decodedInstruction: whirlpoolProgram.instructions.initializePoolV2.decode(ins),
          } as OrcaInstructionData;
        case whirlpoolProgram.instructions.initializePool.d8:
          return {
            ...baseData,
            type: 'initializePool',
            decodedInstruction: whirlpoolProgram.instructions.initializePool.decode(ins),
          } as OrcaInstructionData;

        case whirlpoolProgram.instructions.initializePoolWithAdaptiveFee.d8:
          return {
            ...baseData,
            type: 'initializePoolWithAdaptiveFee',
            decodedInstruction:
              whirlpoolProgram.instructions.initializePoolWithAdaptiveFee.decode(ins),
          } as OrcaInstructionData;

        case tokenProgram.instructions.transfer.d1:
          return {
            ...baseData,
            type: 'transfer',
            decodedInstruction: tokenProgram.instructions.transfer.decode(ins),
          } as OrcaInstructionData;
        case tokenProgram.instructions.transferChecked.d1:
          return {
            ...baseData,
            type: 'transferChecked',
            decodedInstruction: tokenProgram.instructions.transferChecked.decode(ins),
          } as OrcaInstructionData;

        default:
          return null;
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

  //todo:
  //   LockPosition (check if necessary to track, I+ai think no )

  // - If a position is locked, the owner cannot add/remove liquidity, close, or transfer the position (depending on lock config).
  // - If you are tracking time-weighted balances for rewards or analytics, you should be aware of lock status:
  // 	- If a position is locked, its liquidity is “frozen” in place.
  // 	- If your logic allows, you may want to pause accrual or flag locked positions, depending on your use case.

  // ResetPositionRange (necessary to track , just change tick ranges in a position)

  // - If a position’s tick range is reset, the in-range/out-of-range status can change immediately.
  // - You must update your tracking whenever this happens, as the position’s eligibility for rewards (or time-weighted accrual) depends on being in-range.

  // TransferLockedPosition - necessary to track (just change owner)

  // - If a locked position is transferred to a new owner, you must update your tracking to reflect the new owner.
  // - The time-weighted balance should be reset or transferred according to your business logic.

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

    const positionInstructions = blockInstructions.filter((data) =>
      [
        'openPosition',
        'closePosition',
        'openPositionWithTokenExtensions',
        'closePositionWithTokenExtensions',
        'openPositionWithMetadata',
      ].includes(data.type),
    );

    const poolInstructions = blockInstructions.filter((data) =>
      ['initializePoolV2', 'initializePool', 'initializePoolWithAdaptiveFee'].includes(data.type),
    );

    const transferInstructions = blockInstructions.filter((data) =>
      ['transfer', 'transferChecked'].includes(data.type),
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

    //todo: include transfer log position over here in future
    // if (transferInstructions.length > 0) {
    //   await processTransferInstructions(transferInstructions, protocolStates);
    // }

    if (positionInstructions.length > 0) {
      await processPositionInstructions(
        positionInstructions,
        protocolStates,
        this.positionStorageService,
      );
    }

    if (liquidityInstructions.length > 0) {
      await processLiquidityInstructions(
        liquidityInstructions,
        protocolStates,
        this.liquidityMathService,
      );
    }

    if (feeInstructions.length > 0) {
      await processFeeInstructions(feeInstructions, protocolStates);
    }
  }

  //todo: after each batch processing, add the logic for flush Interval

  private async finalizeBatch(
    ctx: any,
    protocolStates: Map<string, ProtocolStateOrca>,
  ): Promise<void> {
    logger.info('Finalizing batch...');

    for (const pool of WHIRLPOOL_ADDRESSES) {
      const contractAddress = pool.toLowerCase();
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
      await this.apiClient.send(transactions);
    }

    // const transactions = toTransaction(
    //   protocolState.transactions,
    //   { ...this.protocol },
    //   this.env,
    //   this.chainConfig,
    // );

    // logger.info(`🏊 [FinalizeBatch] Transactions:`, {
    //   transactions,
    // });
    // await this.apiClient.send(transactions);
  }
}
