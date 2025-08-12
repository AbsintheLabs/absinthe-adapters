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
} from '@absinthe/common';
import * as tokenProgram from './abi/TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
import { processor } from './processor';
import { createHash } from 'crypto';
import { TypeormDatabase } from '@subsquid/typeorm-store';

import { SplTransfersProtocol } from './utils/types';
import { augmentBlock } from '@subsquid/solana-objects';
import { TRACKED_TOKENS } from './utils/consts';
import { TokenBalance } from './utils/types';

export class SplTransfersProcessor {
  private readonly protocol: SplTransfersProtocol;
  private readonly schemaName: string;
  private readonly refreshWindow: number;
  private readonly apiClient: AbsintheApiClient;
  private readonly chainConfig: Chain;
  private readonly env: ValidatedEnvBase;

  constructor(
    dexProtocol: SplTransfersProtocol,
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
  }

  private generateSchemaName(): string {
    const hash = createHash('md5').update(this.chainConfig.networkId.toString()).digest('hex');
    return `spl-transfers-${hash}`;
  }

  async run(): Promise<void> {
    run(processor, new TypeormDatabase(), async (ctx) => {
      try {
        await this.processBatch(ctx);
      } catch (error) {
        console.error('Error processing batch:', (error as Error).message);
        throw error;
      }
    });
  }

  private async processBatch(ctx: any): Promise<void> {
    const blocks = ctx.blocks.map(augmentBlock);

    const protocolStates = await this.initializeProtocolStates(ctx);

    for (const block of blocks) {
      await this.processBlock(block, protocolStates);
    }
    await this.finalizeBatch(ctx, protocolStates);
  }

  private async initializeProtocolStates(ctx: any): Promise<Map<string, ProtocolState>> {
    const protocolStates = new Map<string, ProtocolState>();

    const contractAddress = this.protocol.contractAddress.toLowerCase();
    protocolStates.set(contractAddress, {
      balanceWindows: [],
      transactions: [],
    });

    return protocolStates;
  }

  private async processBlock(
    block: any,
    protocolStates: Map<string, ProtocolState>,
  ): Promise<void> {
    for (let ins of block.instructions) {
      if (
        ins.programId === tokenProgram.programId &&
        ins.d1 === tokenProgram.instructions.transfer.d1
      ) {
        const cid = ins.id;
        const slot = block.header.slot;
        const tx = ins.getTransaction().signatures[0];

        let transfer = tokenProgram.instructions.transfer.decode(ins);
        let tokenBalances = ins.getTransaction().tokenBalances;
        logger.info('transfer', { transfer, slot, tokenBalances });

        const transactions = this.processTokenTransfers(
          tokenBalances,
          tx,
          null,
          '',
          block.header.slot,
          block.header.timestamp,
        );

        protocolStates
          .get(this.protocol.contractAddress.toLowerCase())!
          .transactions.push(...transactions);
      }
    }
  }

  private processTokenTransfers(
    tokenBalances: TokenBalance[],
    tx: string,
    logIndex: number | null,
    blockHash: string,
    blockNumber: number,
    timestamp: number,
  ): Transaction[] {
    const transactions = [];
    for (const tb of tokenBalances) {
      if (tb.preMint !== tb.postMint) continue;

      const mint = tb.preMint;
      const decimals = tb.preDecimals;
      const owner = tb.preOwner;

      if (!(mint in TRACKED_TOKENS)) continue;

      const netChange = Number(tb.postAmount) - Number(tb.preAmount);
      const displayAmount = netChange / Math.pow(10, decimals);

      const transactionSchema = {
        eventType: MessageType.TRANSACTION,
        eventName: 'Transfer',
        tokens: {},
        rawAmount: netChange.toString(),
        displayAmount: displayAmount,
        unixTimestampMs: timestamp,
        txHash: tx,
        logIndex: logIndex,
        blockNumber: blockNumber,
        blockHash: blockHash,
        userId: owner,
        currency: Currency.USD,
        valueUsd: displayAmount,
        gasUsed: 0,
        gasFeeUsd: 0,
      };
      transactions.push(transactionSchema);
    }
    return transactions;
  }

  private async finalizeBatch(ctx: any, protocolStates: Map<string, ProtocolState>): Promise<void> {
    logger.info('Finalizing batch...');

    const contractAddress = this.protocol.contractAddress.toLowerCase();
    const protocolState = protocolStates.get(contractAddress)!;

    const transactions = toTransaction(
      protocolState.transactions,
      { ...this.protocol },
      this.env,
      this.chainConfig,
    );
    await this.apiClient.send(transactions);
  }
}
