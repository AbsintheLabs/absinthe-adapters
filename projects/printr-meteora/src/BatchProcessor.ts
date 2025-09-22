import { run } from '@subsquid/batch-processor';

import {
  AbsintheApiClient,
  Chain,
  ValidatedEnvBase,
  toTransaction,
  logger,
  PriceFeed,
  TokenPreference,
  HOURS_TO_SECONDS,
} from '@absinthe/common';
import * as printrAbi from './abi/diRTqkRxqg9fvQXemGosY8hg91Q7DpFqGXLJwG3bEDA';
import { processor } from './processor';
import { createHash } from 'crypto';
import { TypeormDatabase } from '@subsquid/typeorm-store';

import { PrintrMeteoraProtocol, ProtocolStateOrca, PrintrInstructionData } from './utils/types';
import { augmentBlock } from '@subsquid/solana-objects';

import { processSwapInstructions } from './mappings/swapInstructions';
import { Connection } from '@solana/web3.js';
export class PrintrMeteoraProcessor {
  private readonly protocol: PrintrMeteoraProtocol;
  private readonly schemaName: string;
  private readonly apiClient: AbsintheApiClient;
  private readonly chainConfig: Chain;
  private readonly env: ValidatedEnvBase;
  private readonly connection: Connection;
  constructor(
    dexProtocol: PrintrMeteoraProtocol,
    apiClient: AbsintheApiClient,
    env: ValidatedEnvBase,
    chainConfig: Chain,
    rpcUrl: string,
  ) {
    this.protocol = dexProtocol;
    this.apiClient = apiClient;
    this.env = env;
    this.chainConfig = chainConfig;
    this.schemaName = this.generateSchemaName();
    this.connection = new Connection(rpcUrl, 'confirmed');
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
        `🔄 Processing block ${block.header.height} with ${block.instructions.length} instructions, timestamp: ${new Date(block.header.timestamp).toISOString()}, slot: ${block.header.number}, events: ${block.logs.length}`,
      );

      const blockInstructions: PrintrInstructionData[] = [];

      for (let ins of block.instructions) {
        if (ins.programId === printrAbi.programId) {
          const instructionData = this.decodeInstruction(ins, block);
          if (instructionData) {
            blockInstructions.push(instructionData);
          }
        }
      }

      if (blockInstructions.length > 0) {
        await this.processBlockInstructions(blockInstructions, protocolStates);
      }
    }
    await this.finalizeBatch(ctx, protocolStates);
  }

  private async initializeProtocolStates(ctx: any): Promise<Map<string, ProtocolStateOrca>> {
    const protocolStates = new Map<string, ProtocolStateOrca>();

    return protocolStates;
  }

  // Update your decodeInstruction method to use this filter
  private decodeInstruction(ins: any, block: any): PrintrInstructionData | null {
    try {
      const slot = block.header.number;
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
        case printrAbi.instructions.swap.d8:
          const decodedInstruction = printrAbi.instructions.swap.decode(ins);

          return {
            ...baseData,
            type: 'swap',
            decodedInstruction,
          } as PrintrInstructionData;

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

  private async processBlockInstructions(
    blockInstructions: PrintrInstructionData[],
    protocolStates: Map<string, ProtocolStateOrca>,
  ): Promise<void> {
    // Group non-pool instructions by category
    const swapInstructions = blockInstructions.filter((data) => ['swap'].includes(data.type));

    if (swapInstructions.length > 0) {
      await processSwapInstructions(swapInstructions, protocolStates, this.env, this.connection);
    }
  }

  private async finalizeBatch(
    ctx: any,
    protocolStates: Map<string, ProtocolStateOrca>,
  ): Promise<void> {
    logger.info('Finalizing batch...');

    for (const pool of protocolStates.keys()) {
      const protocolState = protocolStates.get(pool)!;

      const transactions = toTransaction(
        protocolState.transactions,
        //todo: we will remove this in revamp
        {
          contractAddress: pool,
          name: 'printr-meteora',
          type: 'printr-meteora',
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
  }
}
