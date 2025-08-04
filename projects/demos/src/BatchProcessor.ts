import {
  AbsintheApiClient,
  Chain,
  Currency,
  MessageType,
  ValidatedBondingCurveProtocolConfig,
  ValidatedEnvBase,
} from '@absinthe/common';

import { createHash } from 'crypto';
import { TypeormDatabase } from '@subsquid/typeorm-store';
import { processor } from './processor';
import { BatchContext, ProtocolState } from '@absinthe/common';
import { fetchHistoricalUsd, toTransaction } from '@absinthe/common';
import { FUNCTION_SELECTOR } from './utils/consts';

export class DemosProcessor {
  private readonly bondingCurveProtocol: ValidatedBondingCurveProtocolConfig;
  private readonly schemaName: string;
  private readonly apiClient: AbsintheApiClient;
  private readonly env: ValidatedEnvBase;
  private readonly chainConfig: Chain;
  private readonly contractAddress: string;

  constructor(
    bondingCurveProtocol: ValidatedBondingCurveProtocolConfig,
    apiClient: AbsintheApiClient,
    env: ValidatedEnvBase,
    chainConfig: Chain,
  ) {
    this.bondingCurveProtocol = bondingCurveProtocol;
    this.schemaName = this.generateSchemaName();
    this.apiClient = apiClient;
    this.env = env;
    this.chainConfig = chainConfig;
    this.contractAddress = bondingCurveProtocol.contractAddress.toLowerCase();
  }

  private generateSchemaName(): string {
    const uniquePoolCombination = this.contractAddress
      .toLowerCase()
      .concat(this.bondingCurveProtocol.chainId.toString());

    const hash = createHash('md5').update(uniquePoolCombination).digest('hex').slice(0, 8);
    return `vusd-mint-${hash}`;
  }

  async run(): Promise<void> {
    processor.run(
      new TypeormDatabase({ supportHotBlocks: false, stateSchema: this.schemaName }),
      async (ctx) => {
        try {
          await this.processBatch(ctx);
        } catch (error) {
          console.error('Error processing batch:', error);
          throw error;
        }
      },
    );
  }

  private async processBatch(ctx: any): Promise<void> {
    const protocolStates = await this.initializeProtocolStates(ctx);

    for (const block of ctx.blocks) {
      await this.processBlock({ ctx, block, protocolStates });
    }

    await this.finalizeBatch(ctx, protocolStates);
  }

  private async initializeProtocolStates(ctx: any): Promise<Map<string, ProtocolState>> {
    const protocolStates = new Map<string, ProtocolState>();

    protocolStates.set(this.contractAddress, {
      balanceWindows: [],
      transactions: [],
    });

    return protocolStates;
  }

  private async processBlock(batchContext: BatchContext): Promise<void> {
    const { ctx, block, protocolStates } = batchContext;

    const protocolState = protocolStates.get(this.contractAddress)!;

    await this.processLogsForProtocol(ctx, block, protocolState);
  }

  private async processLogsForProtocol(
    ctx: any,
    block: any,
    protocolState: ProtocolState,
  ): Promise<void> {
    const transactions = block.transactions;
    for (const transaction of transactions) {
      await this.processLog(ctx, block, transaction, protocolState);
    }
  }

  private async processLog(
    ctx: any,
    block: any,
    transaction: any,
    protocolState: ProtocolState,
  ): Promise<void> {
    const { input, from, to, gasPrice, gasUsed, sighash } = transaction;
    if (input?.startsWith(FUNCTION_SELECTOR)) {
      const gasFee = Number(gasUsed) * Number(gasPrice);
      const displayGasFee = gasFee / 10 ** 18;
      const ethPriceUsd = await fetchHistoricalUsd(
        'ethereum',
        block.header.timestamp,
        this.env.coingeckoApiKey,
      );
      const gasFeeUsd = displayGasFee * ethPriceUsd;
      const transactionSchema = {
        eventType: MessageType.TRANSACTION,
        eventName: 'func_0xa4760a9e',
        tokens: {
          gasFee: {
            value: gasFee.toString(),
            type: 'string',
          },
          ethPriceUsd: {
            value: ethPriceUsd.toString(),
            type: 'number',
          },
        },
        rawAmount: '0',
        displayAmount: 0,
        valueUsd: gasFeeUsd,
        gasUsed: Number(gasUsed),
        gasFeeUsd: gasFeeUsd,
        unixTimestampMs: block.header.timestamp,
        txHash: transaction.hash,
        logIndex: 10000, // todo: make this null value in the schema too
        blockNumber: block.header.height,
        blockHash: block.header.hash,
        userId: from,
        currency: Currency.USD,
      };
      protocolState.transactions.push(transactionSchema);
    }
  }

  private async finalizeBatch(ctx: any, protocolStates: Map<string, ProtocolState>): Promise<void> {
    const protocolState = protocolStates.get(this.contractAddress)!;
    const transactions = toTransaction(
      protocolState.transactions,
      this.bondingCurveProtocol,
      this.env,
      this.chainConfig,
    );
    await this.apiClient.send(transactions);
  }
}
