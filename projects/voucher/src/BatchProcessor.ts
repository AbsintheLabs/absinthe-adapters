import {
  AbsintheApiClient,
  BondingCurveProtocolConfig,
  Chain,
  Currency,
  MessageType,
  ValidatedEnvBase,
} from '@absinthe/common';

import { createHash } from 'crypto';
import { TypeormDatabase } from '@subsquid/typeorm-store';
import { processor } from './processor';
import { BatchContext } from '@absinthe/common';
import * as erc20Abi from './abi/erc20';
import { fetchHistoricalUsd, toTransaction } from '@absinthe/common';
import { ProtocolStateVoucher } from './utils/types';

//todo: storage in database
export class VoucherProcessor {
  private readonly bondingCurveProtocol: BondingCurveProtocolConfig;
  private readonly schemaName: string;
  private readonly apiClient: AbsintheApiClient;
  private readonly env: ValidatedEnvBase;
  private readonly chainConfig: Chain;

  constructor(
    bondingCurveProtocol: BondingCurveProtocolConfig,
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
    const uniquePoolCombination = this.bondingCurveProtocol.contractAddress.concat(
      this.bondingCurveProtocol.chainId.toString(),
    );

    const hash = createHash('md5').update(uniquePoolCombination).digest('hex').slice(0, 8);
    return `voucher-${hash}`;
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

  private async initializeProtocolStates(ctx: any): Promise<Map<string, ProtocolStateVoucher>> {
    const protocolStates = new Map<string, ProtocolStateVoucher>();

    const contractAddress = this.bondingCurveProtocol.contractAddress;
    //todo: move into a seperate function
    protocolStates.set(contractAddress, {
      transactions: [],
    });

    return protocolStates;
  }

  private async processBlock(batchContext: BatchContext): Promise<void> {
    const { ctx, block, protocolStates } = batchContext;

    const contractAddress = this.bondingCurveProtocol.contractAddress;
    const protocolState = protocolStates.get(contractAddress)!;

    await this.processLogsForProtocol(ctx, block, contractAddress, protocolState);
  }

  private async processLogsForProtocol(
    ctx: any,
    block: any,
    contractAddress: string,
    protocolState: ProtocolStateVoucher,
  ): Promise<void> {
    const poolLogs = block.logs.filter((log: any) => log.address === contractAddress);
    for (const log of poolLogs) {
      await this.processLog(ctx, block, log, protocolState);
    }
  }

  private async processLog(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateVoucher,
  ): Promise<void> {
    if (log.topics[0] === erc20Abi.events.Transfer.topic) {
      await this.processTransferEvent(ctx, block, log, protocolState);
    }
  }

  private async processTransferEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateVoucher,
  ): Promise<void> {
    const { from, to, value } = erc20Abi.events.Transfer.decode(log);
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

    // const voucherContract = new erc20Abi.Contract(
    //   ctx,
    //   block.header,
    //   this.bondingCurveProtocol.contractAddress,
    // );
    // const baseCurrencyAddress = await voucherContract.symbol();

    // // Get base currency details (WETH) - not the traded token
    // const baseCurrencyContract = new erc20Abi.Contract(ctx, block.header, baseCurrencyAddress);
    // // const baseCurrencySymbol = await baseCurrencyContract.symbol();
    // const baseCurrencyDecimals = await baseCurrencyContract.decimals();
    // //for now we assume the base currency is ETH
    // const displayCost = Number(value) / 10 ** baseCurrencyDecimals;
    const displayCost = Number(value) / 10 ** 18;
    const valueInUsd = displayCost * ethPriceUsd;
    const transactionSchema = {
      eventType: MessageType.TRANSACTION,
      tokens: JSON.stringify([
        {
          token: this.bondingCurveProtocol.contractAddress,
        },
      ]),
      rawAmount: value.toString(),
      displayAmount: displayCost,
      unixTimestampMs: block.header.timestamp,
      txHash: log.transactionHash,
      logIndex: log.logIndex,
      blockNumber: block.header.height,
      blockHash: block.header.hash,
      userId: from,
      currency: Currency.USD,
      valueUsd: valueInUsd,
      gasUsed: Number(gasUsed),
      gasFeeUsd: gasFeeUsd,
    };

    console.log('transactionSchema', transactionSchema);

    protocolState.transactions.push(transactionSchema);
  }

  private async finalizeBatch(
    ctx: any,
    protocolStates: Map<string, ProtocolStateVoucher>,
  ): Promise<void> {
    const contractAddress = this.bondingCurveProtocol.contractAddress;
    const protocolState = protocolStates.get(contractAddress)!;
    const transactions = toTransaction(
      protocolState.transactions,
      this.bondingCurveProtocol,
      this.env,
      this.chainConfig,
    );
    await this.apiClient.send(transactions);
  }
}
