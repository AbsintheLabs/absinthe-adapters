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
import * as erc20Abi from './abi/erc20';
import { fetchHistoricalUsd, toTransaction } from '@absinthe/common';
import { ZebuNewProtocolState } from './utils/types';

const currencies = [
  {
    name: 'USDC',
    symbol: 'usd',
    decimals: 6,
  },
  {
    name: 'USDT',
    symbol: 'USDT',
    decimals: 6,
  },
  {
    name: 'RUM',
    symbol: 'arrland-rum',
    decimals: 18,
  },
  {
    name: 'ETH',
    symbol: 'ethereum',
    decimals: 18,
  },
];

export class ZebuNewProcessor {
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
    return `voucher-${hash}`;
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

    // await this.finalizeBatch(ctx, protocolStates);
  }

  private async initializeProtocolStates(ctx: any): Promise<Map<string, ZebuNewProtocolState>> {
    const protocolStates = new Map<string, ZebuNewProtocolState>();

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
    protocolState: ZebuNewProtocolState,
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
    protocolState: ZebuNewProtocolState,
    contractAddress: string,
  ): Promise<void> {
    if (log.topics[0] === mainAbi.events.AuctionBid_Placed.topic) {
      await this.processAuctionBidPlacedEvent(ctx, block, log, protocolState, contractAddress);
    }

    if (log.topics[0] === mainAbi.events.Auction_Claimed.topic) {
      await this.processAuctionClaimedEvent(ctx, block, log, protocolState, contractAddress);
    }
  }

  private async processAuctionBidPlacedEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ZebuNewProtocolState,
    contractAddress: string,
  ): Promise<void> {
    const { bidder, bidamount, saleID, bidIndex } = mainAbi.events.AuctionBid_Placed.decode(log);
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

    const zebuNewContract = new mainAbi.Contract(ctx, block.header, contractAddress);
    const currencyId = await zebuNewContract.getSale_CurrencyID(saleID);
    const currencyAddress = await zebuNewContract.getSale_Currency_Address(currencyId);
    //todo: run the script and then try to find everything
    const erc20Contract = new erc20Abi.Contract(ctx, block.header, currencyAddress);
    const currencySymbol = await erc20Contract.symbol();
    const currencyDecimals = await erc20Contract.decimals();
    const currency = currencies.find((currency) => currency.name === currencySymbol);

    console.log(currencySymbol, currencyDecimals, 'currencySymbol, currencyDecimals');

    let usdToCurrencyValue = 0;
    if (!currency) {
      console.warn(`Currency ${currencySymbol} not found`);
    } else {
      usdToCurrencyValue = await fetchHistoricalUsd(
        currency.symbol,
        block.header.timestamp,
        this.env.coingeckoApiKey,
      );
      console.log(usdToCurrencyValue, 'usdToCurrencyValue');
    }

    const displayCost = Number(bidamount) / 10 ** 18;
    const usdValue = displayCost * usdToCurrencyValue;
    const transactionSchema = {
      eventType: MessageType.TRANSACTION,
      tokens: JSON.stringify([
        {
          clientDiamondContractAddress: contractAddress,
          saleId: saleID.toString(),
          bidIndex: bidIndex.toString(),
        },
      ]),
      rawAmount: bidamount.toString(),
      displayAmount: displayCost,
      unixTimestampMs: block.header.timestamp,
      txHash: log.transactionHash,
      logIndex: log.logIndex,
      blockNumber: block.header.height,
      blockHash: block.header.hash,
      userId: bidder,
      currency: Currency.USD,
      valueUsd: usdValue,
      gasUsed: Number(gasUsed),
      gasFeeUsd: gasFeeUsd,
    };

    protocolState.transactions.push(transactionSchema);
  }

  private async processAuctionClaimedEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ZebuNewProtocolState,
    contractAddress: string,
  ): Promise<void> {
    const { winner, saleID } = mainAbi.events.Auction_Claimed.decode(log);
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

    const transactionSchema = {
      eventType: MessageType.TRANSACTION,
      tokens: JSON.stringify([
        {
          clientDiamondContractAddress: contractAddress,
          saleId: saleID.toString(),
        },
      ]),
      rawAmount: '0',
      displayAmount: 0,
      unixTimestampMs: block.header.timestamp,
      txHash: log.transactionHash,
      logIndex: log.logIndex,
      blockNumber: block.header.height,
      blockHash: block.header.hash,
      userId: winner,
      currency: Currency.USD,
      valueUsd: 0,
      gasUsed: Number(gasUsed),
      gasFeeUsd: gasFeeUsd,
    };

    protocolState.transactions.push(transactionSchema);
  }
  private async finalizeBatch(
    ctx: any,
    protocolStates: Map<string, ZebuNewProtocolState>,
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
      console.log(transactions, 'transactions');
      await this.apiClient.send(transactions);
    }
  }
}
