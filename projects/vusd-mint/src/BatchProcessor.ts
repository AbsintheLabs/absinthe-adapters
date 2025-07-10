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
import * as vusdMintAbi from './abi/mint';
import { fetchHistoricalUsd, toTransaction } from '@absinthe/common';

//todo: storage in database
export class VusdMintProcessor {
  private readonly bondingCurveProtocol: ValidatedBondingCurveProtocolConfig;
  private readonly schemaName: string;
  private readonly apiClient: AbsintheApiClient;
  private readonly env: ValidatedEnvBase;
  private readonly chainConfig: Chain;

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
  }

  private generateSchemaName(): string {
    const uniquePoolCombination = this.bondingCurveProtocol.contractAddress
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

    const contractAddress = this.bondingCurveProtocol.contractAddress.toLowerCase();
    //todo: move into a seperate function
    protocolStates.set(contractAddress, {
      balanceWindows: [],
      transactions: [],
    });

    return protocolStates;
  }

  private async processBlock(batchContext: BatchContext): Promise<void> {
    const { ctx, block, protocolStates } = batchContext;

    const contractAddress = this.bondingCurveProtocol.contractAddress.toLowerCase();
    const protocolState = protocolStates.get(contractAddress)!;

    await this.processLogsForProtocol(ctx, block, contractAddress, protocolState);
  }

  private async processLogsForProtocol(
    ctx: any,
    block: any,
    contractAddress: string,
    protocolState: ProtocolState,
  ): Promise<void> {
    const poolLogs = block.logs.filter((log: any) => log.address.toLowerCase() === contractAddress);

    for (const log of poolLogs) {
      await this.processLog(ctx, block, log, protocolState);
    }
  }

  private async processLog(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolState,
  ): Promise<void> {
    if (log.topics[0] === vusdMintAbi.events.Mint.topic) {
      await this.processMintEvent(ctx, block, log, protocolState);
    }
  }

  private async processMintEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolState,
  ): Promise<void> {
    const { tokenIn, amountIn, amountInAfterTransferFee, mintage, receiver } =
      vusdMintAbi.events.Mint.decode(log);
    const { gasPrice, gasUsed } = log.transaction;
    const gasFee = Number(gasUsed) * Number(gasPrice);
    const displayGasFee = gasFee / 10 ** 18;
    const ethPriceUsd = await fetchHistoricalUsd(
      'vesper-vdollar',
      block.header.timestamp,
      this.env.coingeckoApiKey,
    );

    const gasFeeUsd = displayGasFee * ethPriceUsd;

    const mintageDisplay = Number(mintage) / 10 ** 18;
    const mintageUsd = mintageDisplay * ethPriceUsd;

    const transactionSchema = {
      eventType: MessageType.TRANSACTION,
      eventName: 'Mint',
      tokens: {
        tokenIn: {
          value: tokenIn,
          type: 'string',
        },
        amountIn: {
          value: amountIn.toString(),
          type: 'number',
        },
        amountInAfterTransferFee: {
          value: amountInAfterTransferFee.toString(),
          type: 'number',
        },
      },
      rawAmount: mintage.toString(),
      displayAmount: mintageDisplay,
      unixTimestampMs: block.header.timestamp,
      txHash: log.transactionHash,
      logIndex: log.logIndex,
      blockNumber: block.header.height,
      blockHash: block.header.hash,
      userId: receiver,
      currency: Currency.USD,
      valueUsd: mintageUsd,
      gasUsed: Number(gasUsed),
      gasFeeUsd: gasFeeUsd,
    };
    protocolState.transactions.push(transactionSchema);
  }

  private async finalizeBatch(ctx: any, protocolStates: Map<string, ProtocolState>): Promise<void> {
    const contractAddress = this.bondingCurveProtocol.contractAddress.toLowerCase();
    const protocolState = protocolStates.get(contractAddress)!;
    const transactions = toTransaction(
      protocolState.transactions,
      this.bondingCurveProtocol,
      this.env,
      this.chainConfig,
    );
    console.log(transactions, 'transactions');
    await this.apiClient.send(transactions);
  }
}
