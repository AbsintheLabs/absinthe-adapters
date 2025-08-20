import {
  AbsintheApiClient,
  Currency,
  MessageType,
  ProtocolType,
  ValidatedEnvBase,
  ZebuClientConfigWithChain,
  ZERO_ADDRESS,
  logger,
} from '@absinthe/common';

import { createHash } from 'crypto';
import { TypeormDatabase } from '@subsquid/typeorm-store';
import { createProcessor } from './processor';
import { BatchContext } from '@absinthe/common';
import * as mainAbi from './abi/main';
import * as erc20Abi from './abi/erc20';
import { fetchHistoricalUsd, toTransaction } from '@absinthe/common';
import { ZebuNewProtocolState } from './utils/types';
import { currencies, nullCurrencyAddresses } from './utils/consts';

export class ZebuNewProcessor {
  private readonly zebuNewProtocol: ZebuClientConfigWithChain[];
  private readonly schemaName: string;
  private readonly apiClient: AbsintheApiClient;
  private readonly env: ValidatedEnvBase;
  private readonly chainId: number;

  constructor(
    zebuNewProtocol: ZebuClientConfigWithChain[],
    apiClient: AbsintheApiClient,
    env: ValidatedEnvBase,
    chainId: number,
  ) {
    this.zebuNewProtocol = zebuNewProtocol;
    this.apiClient = apiClient;
    this.env = env;
    this.chainId = chainId;
    this.schemaName = this.generateSchemaName();

    logger.info('ZebuNewProcessor initialized', {
      chainId: this.chainId,
      schemaName: this.schemaName,
      contractCount: zebuNewProtocol.length,
      contracts: zebuNewProtocol.map((c) => ({
        name: c.name,
        address: c.contractAddress,
      })),
    });
  }

  private generateSchemaName(): string {
    const uniquePoolCombination = this.zebuNewProtocol[0].contractAddress
      .concat(this.chainId.toString())
      .concat(this.zebuNewProtocol[0].name);

    const hash = createHash('md5').update(uniquePoolCombination).digest('hex').slice(0, 8);
    const schemaName = `zebu-new-${this.chainId}-${hash}`;

    logger.info('Generated schema name', {
      schemaName,
      hash,
      uniquePoolCombination,
    });

    return schemaName;
  }

  async run(): Promise<void> {
    logger.info('Starting ZebuNewProcessor', {
      schemaName: this.schemaName,
      chainId: this.chainId,
    });

    createProcessor(this.zebuNewProtocol).run(
      new TypeormDatabase({ supportHotBlocks: false, stateSchema: this.schemaName }),
      async (ctx) => {
        try {
          await this.processBatch(ctx);
        } catch (error) {
          logger.error('Error processing batch', {
            error: error,
            stack: error,
            chainId: this.chainId,
            schemaName: this.schemaName,
          });
          throw error;
        }
      },
    );
  }

  private async processBatch(ctx: any): Promise<void> {
    const batchInfo = {
      blockCount: ctx.blocks.length,
      firstBlock: ctx.blocks[0]?.header.height,
      lastBlock: ctx.blocks[ctx.blocks.length - 1]?.header.height,
      chainId: this.chainId,
    };

    logger.info('Starting batch processing', batchInfo);

    const protocolStates = await this.initializeProtocolStates(ctx);

    for (const block of ctx.blocks) {
      await this.processBlock({ ctx, block, protocolStates });
    }

    await this.finalizeBatch(ctx, protocolStates);

    logger.info('Completed batch processing', {
      ...batchInfo,
      totalTransactions: Array.from(protocolStates.values()).reduce(
        (sum, state) => sum + state.transactions.length,
        0,
      ),
    });
  }

  private async initializeProtocolStates(ctx: any): Promise<Map<string, ZebuNewProtocolState>> {
    const protocolStates = new Map<string, ZebuNewProtocolState>();

    for (const client of this.zebuNewProtocol) {
      const contractAddress = client.contractAddress.toLowerCase();
      protocolStates.set(contractAddress, {
        transactions: [],
      });

      logger.info('Initialized protocol state', {
        contractName: client.name,
        contractAddress,
        chainId: this.chainId,
      });
    }

    logger.info('All protocol states initialized', {
      contractCount: protocolStates.size,
      chainId: this.chainId,
    });

    return protocolStates;
  }

  private async processBlock(batchContext: BatchContext): Promise<void> {
    const { ctx, block, protocolStates } = batchContext;

    logger.info('Processing block', {
      blockNumber: block.header.height,
      blockHash: block.header.hash,
      timestamp: block.header.timestamp,
      logCount: block.logs.length,
      chainId: this.chainId,
    });

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
    const poolLogs = block.logs.filter((log: any) => log.address.toLowerCase() === contractAddress);

    if (poolLogs.length > 0) {
      logger.info('Processing logs for contract', {
        contractAddress,
        logCount: poolLogs.length,
        blockNumber: block.header.height,
        chainId: this.chainId,
      });
    }

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
    logger.info('Processing log event', {
      contractAddress,
      eventTopic: log.topics[0],
      txHash: log.transactionHash,
      logIndex: log.logIndex,
      blockNumber: block.header.height,
      chainId: this.chainId,
    });

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

    logger.info('Processing AuctionBid_Placed event', {
      bidder,
      bidAmount: bidamount.toString(),
      saleID: saleID.toString(),
      bidIndex: bidIndex.toString(),
      txHash: log.transactionHash,
      blockNumber: block.header.height,
      contractAddress,
      chainId: this.chainId,
    });

    const { gasPrice, gasUsed } = log.transaction;
    const gasFee = Number(gasUsed) * Number(gasPrice);
    const gasUsedInEth = Number(gasUsed) / 10 ** 18;
    const displayGasFee = gasFee / 10 ** 18;

    let ethPriceUsd = 0;
    try {
      logger.info('Fetching ETH price for gas calculation', {
        timestamp: block.header.timestamp,
        blockNumber: block.header.height,
      });

      ethPriceUsd = await fetchHistoricalUsd(
        'ethereum',
        block.header.timestamp,
        this.env.coingeckoApiKey,
      );

      logger.info('ETH price fetched successfully', {
        ethPriceUsd,
        timestamp: block.header.timestamp,
      });
    } catch (error) {
      logger.warn('Could not fetch historical USD price for ETH, using 0', {
        error: error,
        timestamp: block.header.timestamp,
        blockNumber: block.header.height,
      });
    }
    const gasFeeUsd = displayGasFee * ethPriceUsd;

    const zebuNewContract = new mainAbi.Contract(ctx, block.header, contractAddress);

    logger.info('Fetching currency information', {
      saleID: saleID.toString(),
      contractAddress,
    });

    const currencyId = await zebuNewContract.getSale_CurrencyID(saleID);
    const currencyAddress = await zebuNewContract.getSale_Currency_Address(currencyId);
    const erc20Contract = new erc20Abi.Contract(ctx, block.header, currencyAddress);

    let currencySymbol = 'UNKNOWN';
    let currency = null;

    try {
      currencySymbol = await erc20Contract.symbol();
      currency = currencies.find((currency) => currency.name === currencySymbol);

      logger.info('Currency information fetched', {
        currencyId: currencyId.toString(),
        currencyAddress,
        currencySymbol,
        currencyFound: !!currency,
        saleID: saleID.toString(),
      });
    } catch (error) {
      logger.warn('Failed to get symbol for contract, using UNKNOWN', {
        currencyAddress,
        currencySymbol,
        error: error,
        saleID: saleID.toString(),
      });
    }

    let usdToCurrencyValue = 0;
    if (!currency) {
      const nullCurrency = nullCurrencyAddresses.find(
        (nullCurr) =>
          nullCurr.contractAddress.toLowerCase() === currencyAddress.toLowerCase() &&
          nullCurr.chainId === this.chainId,
      );

      if (nullCurrency) {
        logger.info('Null currency found, pricing as ETH', {
          currencySymbol,
          currencyAddress,
          nullCurrencyName: nullCurrency.name,
          saleID: saleID.toString(),
        });

        try {
          usdToCurrencyValue = await fetchHistoricalUsd(
            'ethereum',
            block.header.timestamp,
            this.env.coingeckoApiKey,
          );

          logger.info('Null currency priced as ETH successfully', {
            currencyAddress,
            ethPrice: usdToCurrencyValue,
            timestamp: block.header.timestamp,
          });
        } catch (error) {
          logger.warn('Failed to fetch ETH price for null currency, using 0', {
            currencyAddress,
            error: error,
            timestamp: block.header.timestamp,
          });
          usdToCurrencyValue = 0;
        }
      } else {
        logger.warn('Currency not found in supported list, using 0 USD value', {
          currencySymbol,
          currencyAddress,
          saleID: saleID.toString(),
        });
      }
    } else {
      try {
        logger.info('Fetching currency price', {
          currencySymbol: currency.symbol,
          timestamp: block.header.timestamp,
        });

        usdToCurrencyValue = await fetchHistoricalUsd(
          currency.symbol,
          block.header.timestamp,
          this.env.coingeckoApiKey,
        );

        logger.info('Currency price fetched successfully', {
          currencySymbol: currency.symbol,
          usdPrice: usdToCurrencyValue,
          timestamp: block.header.timestamp,
        });
      } catch (error) {
        logger.warn('Failed to fetch USD price for currency, using 0', {
          currencySymbol,
          error: error,
          timestamp: block.header.timestamp,
        });
        usdToCurrencyValue = 0;
      }
    }

    const displayCost = Number(bidamount) / 10 ** (currency?.decimals ?? 18);
    const usdValue = displayCost * usdToCurrencyValue;

    logger.info('Calculated bid values', {
      rawAmount: bidamount.toString(),
      displayCost,
      usdValue,
      currencyDecimals: currency?.decimals ?? 18,
      currencyPrice: usdToCurrencyValue,
      saleID: saleID.toString(),
      bidder,
    });

    const transactionSchema = {
      eventType: MessageType.TRANSACTION,
      eventName: 'AuctionBid_Placed',
      tokens: {
        saleId: {
          value: saleID.toString(),
          type: 'string',
        },
        bidIndex: {
          value: bidIndex.toString(),
          type: 'string',
        },
        winner: {
          value: 'false',
          type: 'boolean',
        },
        currency: {
          value: currencySymbol,
          type: 'string',
        },
        currencyAddress: {
          value: currencyAddress,
          type: 'string',
        },
        currencyDecimals: {
          value: (currency?.decimals ?? 18).toString(),
          type: 'string',
        },
        currencyPrice: {
          value: usdToCurrencyValue.toString(),
          type: 'string',
        },
        currencySymbol: {
          value: currencySymbol,
          type: 'string',
        },
        currencyName: {
          value: currency?.name ?? 'UNKNOWN',
          type: 'string',
        },
        currencyId: {
          value: currencyId.toString(),
          type: 'string',
        },
      },
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
      gasUsed: gasUsedInEth,
      gasFeeUsd: gasFeeUsd,
    };

    protocolState.transactions.push(transactionSchema);

    logger.info('AuctionBid_Placed transaction added to protocol state', {
      bidder,
      saleID: saleID.toString(),
      bidIndex: bidIndex.toString(),
      usdValue,
      gasFeeUsd,
      totalTransactions: protocolState.transactions.length,
    });
  }

  private async processAuctionClaimedEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ZebuNewProtocolState,
    contractAddress: string,
  ): Promise<void> {
    const { winner, saleID } = mainAbi.events.Auction_Claimed.decode(log);

    logger.info('Processing Auction_Claimed event', {
      winner,
      saleID: saleID.toString(),
      txHash: log.transactionHash,
      blockNumber: block.header.height,
      contractAddress,
      chainId: this.chainId,
    });

    if (winner.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
      logger.warn('Auction_Claimed event with winner ZERO_ADDRESS', {
        saleID: saleID.toString(),
        txHash: log.transactionHash,
        blockNumber: block.header.height,
      });
      return;
    }

    const { gasPrice, gasUsed } = log.transaction;
    const gasFee = Number(gasUsed) * Number(gasPrice);
    const gasUsedInEth = Number(gasUsed) / 10 ** 18;
    const displayGasFee = gasFee / 10 ** 18;

    let ethPriceUsd = 0;
    try {
      logger.info('Fetching ETH price for gas calculation (Auction_Claimed)', {
        timestamp: block.header.timestamp,
        blockNumber: block.header.height,
      });

      ethPriceUsd = await fetchHistoricalUsd(
        'ethereum',
        block.header.timestamp,
        this.env.coingeckoApiKey,
      );

      logger.info('ETH price fetched successfully (Auction_Claimed)', {
        ethPriceUsd,
        timestamp: block.header.timestamp,
      });
    } catch (error) {
      logger.warn('Could not fetch historical USD price for ETH (Auction_Claimed), using 0', {
        error: error,
        timestamp: block.header.timestamp,
        blockNumber: block.header.height,
      });
    }
    const gasFeeUsd = displayGasFee * ethPriceUsd;

    const transactionSchema = {
      eventType: MessageType.TRANSACTION,
      eventName: 'Auction_Claimed',
      tokens: {
        saleId: {
          value: saleID.toString(),
          type: 'string',
        },
        bidIndex: {
          value: 'null',
          type: 'string',
        },
        winner: {
          value: 'true',
          type: 'boolean',
        },
      },
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
      gasUsed: gasUsedInEth,
      gasFeeUsd: gasFeeUsd,
    };

    protocolState.transactions.push(transactionSchema);

    logger.info('Auction_Claimed transaction added to protocol state', {
      winner,
      saleID: saleID.toString(),
      gasFeeUsd,
      totalTransactions: protocolState.transactions.length,
    });
  }

  private async finalizeBatch(
    ctx: any,
    protocolStates: Map<string, ZebuNewProtocolState>,
  ): Promise<void> {
    logger.info('Starting batch finalization', {
      contractCount: this.zebuNewProtocol.length,
      chainId: this.chainId,
    });

    for (const client of this.zebuNewProtocol) {
      const contractAddress = client.contractAddress.toLowerCase();
      const protocolState = protocolStates.get(contractAddress)!;

      logger.info('Finalizing contract transactions', {
        contractName: client.name,
        contractAddress,
        transactionCount: protocolState.transactions.length,
        chainId: this.chainId,
      });

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

      logger.info('Sending transactions to API', {
        contractName: client.name,
        contractAddress,
        transactionCount: transactions.length,
        chainId: this.chainId,
      });

      try {
        await this.apiClient.send(transactions);

        logger.info('Successfully sent transactions to API', {
          contractName: client.name,
          contractAddress,
          transactionCount: transactions.length,
          chainId: this.chainId,
        });
      } catch (error) {
        logger.error('Failed to send transactions to API', {
          contractName: client.name,
          contractAddress,
          transactionCount: transactions.length,
          error: error,
          chainId: this.chainId,
        });
        throw error;
      }
    }

    const totalTransactions = Array.from(protocolStates.values()).reduce(
      (sum, state) => sum + state.transactions.length,
      0,
    );

    logger.info('Batch finalization completed', {
      totalTransactions,
      contractCount: this.zebuNewProtocol.length,
      chainId: this.chainId,
    });
  }
}
