import {
  AbsintheApiClient,
  Currency,
  MessageType,
  ProtocolType,
  ValidatedEnvBase,
  ZebuClientConfigWithChain,
} from '@absinthe/common';

import { createHash } from 'crypto';
import { TypeormDatabase } from '@subsquid/typeorm-store';
import { createProcessor } from './processor';
import { BatchContext } from '@absinthe/common';
import * as mainAbi from './abi/main';
import { fetchHistoricalUsd, toTransaction } from '@absinthe/common';
import { ProtocolStateZebuLegacy } from './utils/types';

//todo: storage in database
export class ZebuLegacyProcessor {
  private readonly zebuNewProtocol: ZebuClientConfigWithChain[];
  private readonly schemaName: string;
  private readonly apiClient: AbsintheApiClient;
  private readonly env: ValidatedEnvBase;

  constructor(
    zebuNewProtocol: ZebuClientConfigWithChain[],
    apiClient: AbsintheApiClient,
    env: ValidatedEnvBase,
  ) {
    this.zebuNewProtocol = zebuNewProtocol;
    this.schemaName = this.generateSchemaName();
    this.apiClient = apiClient;
    this.env = env;
  }

  //not needed hence its like this
  private generateSchemaName(): string {
    const uniquePoolCombination = this.zebuNewProtocol[0].contractAddress.concat(
      this.zebuNewProtocol[0].chainId.toString(),
    );

    const hash = createHash('md5').update(uniquePoolCombination).digest('hex').slice(0, 8);
    return `zebu-legacy-${hash}`;
  }

  async run(): Promise<void> {
    createProcessor(this.zebuNewProtocol).run(
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

  private async initializeProtocolStates(ctx: any): Promise<Map<string, ProtocolStateZebuLegacy>> {
    const protocolStates = new Map<string, ProtocolStateZebuLegacy>();

    for (const client of this.zebuNewProtocol) {
      const contractAddress = client.contractAddress.toLowerCase();
      protocolStates.set(contractAddress, {
        transactions: [],
      });
    }
    return protocolStates;
  }
  private async processBlock(batchContext: BatchContext): Promise<void> {
    const { ctx, block, protocolStates } = batchContext;

    for (const client of this.zebuNewProtocol) {
      const contractAddress = client.contractAddress.toLowerCase();
      const protocolState = protocolStates.get(contractAddress)!;

      await this.processLogsForProtocol(ctx, block, contractAddress, protocolState);
    }
  }

  private async processLogsForProtocol(
    ctx: any,
    block: any,
    contractAddress: string,
    protocolState: ProtocolStateZebuLegacy,
  ): Promise<void> {
    const poolLogs = block.logs.filter((log: any) => log.address === contractAddress);
    for (const log of poolLogs) {
      await this.processLog(ctx, block, log, protocolState, contractAddress);
    }
  }

  private async processLog(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateZebuLegacy,
    contractAddress: string,
  ): Promise<void> {
    if (log.topics[0] === mainAbi.events.Auction_BidPlaced.topic) {
      await this.processTransferEvent(ctx, block, log, protocolState, contractAddress);
    }
  }

  private async processTransferEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateZebuLegacy,
    contractAddress: string,
  ): Promise<void> {
    const { _bidder, _bidAmount, _auctionID } = mainAbi.events.Auction_BidPlaced.decode(log);
    const { gasPrice, gasUsed } = log.transaction;
    const gasFee = Number(gasUsed) * Number(gasPrice);
    const displayGasFee = gasFee / 10 ** 18;
    let ethPriceUsd = 0;
    try {
      ethPriceUsd = await fetchHistoricalUsd(
        'ethereum',
        block.header.timestamp,
        this.env.coingeckoApiKey,
      );
    } catch (error) {
      console.warn('Could not fetch historical USD price, using 0:', error);
    }
    const gasFeeUsd = displayGasFee * ethPriceUsd;

    // const voucherContract = new mainAbi.Contract(ctx, block.header, contractAddress);
    const displayCost = Number(_bidAmount) / 10 ** 18;
    //note: using eth price usd to get usd value
    const usdValue = displayCost * ethPriceUsd;
    const transactionSchema = {
      eventType: MessageType.TRANSACTION,
      eventName: 'Auction_BidPlaced',
      tokens: {
        saleId: {
          value: _auctionID.toString(),
          type: 'string',
        },
      },
      rawAmount: _bidAmount.toString(),
      displayAmount: displayCost,
      unixTimestampMs: block.header.timestamp,
      txHash: log.transactionHash,
      logIndex: log.logIndex,
      blockNumber: block.header.height,
      blockHash: block.header.hash,
      userId: _bidder,
      currency: Currency.USD,
      valueUsd: usdValue,
      gasUsed: Number(gasUsed),
      gasFeeUsd: gasFeeUsd,
    };

    protocolState.transactions.push(transactionSchema);
  }

  private async finalizeBatch(
    ctx: any,
    protocolStates: Map<string, ProtocolStateZebuLegacy>,
  ): Promise<void> {
    for (const client of this.zebuNewProtocol) {
      const contractAddress = client.contractAddress.toLowerCase();
      const protocolState = protocolStates.get(contractAddress)!;
      const chainConfig = {
        chainArch: client.chainArch,
        networkId: client.chainId,
        chainShortName: client.chainShortName,
        chainName: client.chainName,
      };
      const transactions = toTransaction(
        protocolState.transactions,
        { ...client, type: ProtocolType.ZEBU },
        this.env,
        chainConfig,
      );
      await this.apiClient.send(transactions);
    }
  }
}
