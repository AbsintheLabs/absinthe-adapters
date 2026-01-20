import { run } from '@subsquid/batch-processor';
import {
  AbsintheApiClient,
  Chain,
  ValidatedEnvBase,
  logger,
  PriceFeed,
  TokenPreference,
  HOURS_TO_SECONDS,
  MessageType,
  Currency,
} from '@absinthe/common';
import { toTransaction } from './utils/helper';
import * as printrAbi from './abi/T8HsGYv7sMk3kTnyaRqZrbRPuntYzdh12evXBkprint';
import { processor } from './processor';
import { createHash } from 'crypto';
import { TypeormDatabase } from '@subsquid/typeorm-store';

import { PrintrMeteoraProtocol, ProtocolStateOrca, PrintrInstructionData } from './utils/types';
import { augmentBlock } from '@subsquid/solana-objects';

import { processSwapInstructions } from './mappings/swapInstructions';
import { Connection } from '@solana/web3.js';
import { DAMM_PROGRAM_ID, DBC_PROGRAM_ID } from './utils/consts';
import { Src } from '@subsquid/borsh';
import { decodeDammV2SelfCpiLog } from './utils/decoder/damm';
import { decodeDbcSwapEvent } from './utils/decoder/dbc';
import { decodePrintrInit } from './utils/decoder/createDbc';
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
      `🔄 Processing batch of ${blocks.length} blocks, from ${blocks[0].header.number} to ${blocks[blocks.length - 1].header.number}`,
    );

    const protocolStates = await this.initializeProtocolStates(ctx);

    // Process blocks individually for all instructions AND logs
    for (const block of blocks) {
      logger.info(
        `🔄 Processing block ${block.header.number} with ${block.instructions.length} instructions and ${block.logs.length} logs, timestamp: ${new Date(block.header.timestamp * 1000).toISOString()}, slot: ${block.header.number}`,
      );

      const blockInstructions: PrintrInstructionData[] = [];
      // const blockEvents: any[] = [];

      for (let ins of block.instructions) {
        if (ins.programId === printrAbi.programId) {
          const instructionData = this.decodeInstruction(ins, block);
          if (instructionData) {
            blockInstructions.push(instructionData);
          }
        }
      }

      // for (let log of block.logs) {
      //   if (
      //     (log.programId === printrAbi.programId && log.kind === 'data') ||
      //     log.kind === 'other'
      //   ) {
      //     const eventData = this.decodeLog(log, block);
      //     logger.info(`🔄 [ProcessBlockEvents] Event data:`, {
      //       eventData,
      //     });
      //     if (eventData) {
      //       blockEvents.push(eventData);
      //     }
      //   }
      // }

      if (blockInstructions.length > 0) {
        await this.processBlockInstructions(blockInstructions, protocolStates);
      }

      // if (blockEvents.length > 0) {
      //   await this.processBlockEvents(blockEvents, protocolStates);
      // }
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
        logIndex: null,
        blockHash: '',
        timestamp: block.header.timestamp,
        tokenBalances,
      };

      switch (ins.d8) {
        case printrAbi.instructions.swap.d8: {
          const decodedInstruction = printrAbi.instructions.swap.decode(ins);
          const innerSwap = ins.inner || [];

          // Process ALL inner instructions, not just the first one
          for (const innerIns of innerSwap) {
            if (innerIns.programId === DBC_PROGRAM_ID) {
              try {
                const hexData = '0x' + Buffer.from(innerIns.data, 'base64').toString('hex');
                const discriminator = hexData.substring(0, 18);

                logger.info(` [DecodeInstructionDbc] Raw data:`, {
                  discriminator,
                  dataLength: innerIns.data.length,
                });

                if (discriminator === '0xda2a17a3d9e402dd') {
                  const event = decodeDbcSwapEvent(innerIns.data);

                  logger.info(` [DecodeInstructionDbc] Decoded event:`, { event });

                  return {
                    ...baseData,
                    type: 'SwapMeteoraDbc',
                    decodedInstruction,
                    event,
                  } as any;
                }
              } catch (e) {
                logger.warn(`⚠️ [DecodeInstruction] DBC decode failed:`, { error: e as Error });
              }
            } else if (innerIns.programId === DAMM_PROGRAM_ID) {
              try {
                const hexData = '0x' + Buffer.from(innerIns.data, 'base64').toString('hex');
                const discriminator = hexData.substring(0, 18);

                logger.info(`�� [DecodeInstructionDamm] Discriminator:`, { discriminator });

                if (discriminator === '0xea7c70e30c9e25d9') {
                  const event = decodeDammV2SelfCpiLog(innerIns.data);

                  logger.info(` [DecodeInstructionDamm] Decoded event:`, { event });

                  return {
                    ...baseData,
                    type: 'SwapMeteoraDamm',
                    decodedInstruction,
                    event,
                  } as any;
                }
              } catch (e) {
                logger.warn(`⚠️ [DecodeInstruction] DAMM decode failed:`, { error: e as Error });
              }
            }
          }
        }

        case printrAbi.instructions.printTelecoin.d8: {
          const decodedCreateInstruction = printrAbi.instructions.printTelecoin.decode(ins);
          const inner = ins.inner || [];

          for (const innerIns of inner) {
            if (innerIns.programId === printrAbi.programId) {
              try {
                const hexData = '0x' + Buffer.from(innerIns.data, 'base64').toString('hex');
                const discriminator = hexData.substring(0, 18);

                logger.info(`�� [DecodeInstruction] Discriminator:`, { discriminator });

                if (discriminator === '0xe06021507f14dbcb') {
                  const event = decodePrintrInit(innerIns.data);

                  logger.info(` [DecodeInstruction] Decoded CreatePrintrDbcEvent:`, { event });

                  return {
                    ...baseData,
                    type: 'CreatePrintrDbcEvent',
                    decodedInstruction: decodedCreateInstruction,
                    event,
                  } as any;
                }
              } catch (e) {
                logger.warn(`⚠️ [DecodeInstruction] CreatePrintrDbc decode failed:`, {
                  error: e as Error,
                });
              }
            }
          }
        }

        default:
          return null;
      }
    } catch (error) {
      logger.warn(`⚠️ [DecodeInstruction] Failed to decode instruction:`, {
        error: error as Error,
        discriminator: ins.d8,
        programId: ins.programId,
      });
      return null;
    }
  }

  private async processBlockInstructions(
    blockInstructions: PrintrInstructionData[],
    protocolStates: Map<string, ProtocolStateOrca>,
  ): Promise<void> {
    const swapInstructions = blockInstructions.filter((data) =>
      ['SwapMeteoraDbc', 'SwapMeteoraDamm'].includes(data.type),
    );

    const createPrintrDbcEvent = blockInstructions.filter((data) =>
      ['CreatePrintrDbcEvent'].includes(data.type),
    );

    if (swapInstructions.length > 0) {
      await processSwapInstructions(swapInstructions, protocolStates, this.env, this.connection);
    }

    if (createPrintrDbcEvent.length > 0) {
      await this.processCreatePrintrDbcEvents(createPrintrDbcEvent, protocolStates);
    }
  }

  private async processCreatePrintrDbcEvents(
    events: any[],
    protocolStates: Map<string, ProtocolStateOrca>,
  ): Promise<void> {
    for (const eventData of events) {
      const transactionSchema = {
        eventType: MessageType.TRANSACTION,
        eventName: eventData.type,
        tokens: {},
        rawAmount: '0',
        displayAmount: 0,
        unixTimestampMs: eventData.timestamp * 1000,
        txHash: eventData.txHash,
        logIndex: eventData.logIndex,
        blockNumber: eventData.slot,
        blockHash: eventData.blockHash,
        userId: eventData.event.devOnSolana,
        currency: Currency.USD,
        valueUsd: 0,
        gasUsed: 0, //todo: fix
        gasFeeUsd: 0, //todo: fix
      };

      logger.info(`🔄 [ProcessCreatePrintrDbcEvents] Transaction schema:`, {
        transactionSchema,
      });

      const protocolState = protocolStates.get(this.protocol.contractAddress);

      if (protocolState) {
        protocolState.transactions.push(transactionSchema);
      } else {
        protocolStates.set(this.protocol.contractAddress, {
          balanceWindows: [],
          transactions: [transactionSchema],
        });
      }
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

      logger.info('transactions', JSON.stringify(transactions, null, 2));

      await this.apiClient.send(transactions);
    }
  }
}
