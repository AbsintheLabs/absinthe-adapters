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
import { BatchContext } from '@absinthe/common';
import * as printrAbi from './abi/printr';
import * as erc20Abi from './abi/erc20';
import { fetchHistoricalUsd, toTransaction } from '@absinthe/common';
import { PrintrProtocolState } from './types';
import * as poolAbi from './abi/pool';

//todo: storage in database
export class PrintrProcessor {
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
    const uniquePoolCombination = this.bondingCurveProtocol.contractAddress.concat(
      this.bondingCurveProtocol.chainId.toString(),
    );

    const hash = createHash('md5').update(uniquePoolCombination).digest('hex').slice(0, 8);
    return `printr-${hash}`;
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

  private async initializeProtocolStates(ctx: any): Promise<Map<string, PrintrProtocolState>> {
    const protocolStates = new Map<string, PrintrProtocolState>();

    const contractAddress = this.bondingCurveProtocol.contractAddress.toLowerCase();
    protocolStates.set(contractAddress, {
      balanceWindows: [],
      transactions: [],
      activePools: [],
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
    protocolState: PrintrProtocolState,
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
    protocolState: PrintrProtocolState,
  ): Promise<void> {
    if (log.topics[0] === printrAbi.events.TokenTrade.topic) {
      await this.processTokenTradeEvent(ctx, block, log, protocolState);
    }

    if (log.topics[0] === printrAbi.events.CurveCreated.topic) {
      this.processCurveCreatedEvent(ctx, block, log, protocolState);
    }

    // if (log.topics[0] === printrAbi.events.GraduatedPoolCreated.topic) {
    //   await this.processGraduatedPoolCreatedEvent(ctx, block, log, protocolState);
    // }

    // if (log.topics[0] === poolAbi.events.Swap.topic) {
    //   if (protocolState.activePools.includes(log.address.toLowerCase())) {
    //     await this.processSwapEvent(ctx, block, log, protocolState);
    //   }
    // }
  }

  // private async processSwapEvent(
  //   ctx: any,
  //   block: any,
  //   log: any,
  //   protocolState: PrintrProtocolState,
  // ): Promise<void> {
  //   const { sender, recipient, amount0, amount1, sqrtPriceX96, liquidity, tick } =
  //     poolAbi.events.Swap.decode(log);
  //   const { gasPrice, gasUsed, hash, from, to } = log.transaction;

  //   const token0 = await positionStorageService.getToken(positionForReference.token0Id);
  //   const token1 = await positionStorageService.getToken(positionForReference.token1Id);

  //   const amount0Exact = BigDecimal(amount0, token0.decimals).toNumber();
  //   const amount1Exact = BigDecimal(amount1, token1.decimals).toNumber();

  //   // need absolute amounts for volume
  //   const amount0Abs = Math.abs(amount0Exact);
  //   const amount1Abs = Math.abs(amount1Exact);

  //   // Use optimized pricing strategy - returns USD prices directly
  //   const [token0inUSD, token1inUSD] = await getOptimizedTokenPrices(
  //     log.address,
  //     token0,
  //     token1,
  //     block,
  //     this.env.coingeckoApiKey,
  //     { ...ctx, block },
  //   );

  //   // Direct USD calculation - no need to convert through ETH
  //   const swappedAmountUSD = amount0Abs * token0inUSD + amount1Abs * token1inUSD;

  //   const transactionSchema = {
  //     eventType: MessageType.TRANSACTION,
  //     eventName: 'Swap',
  //     tokens: JSON.stringify([]),
  //     rawAmount: (amount0Abs + amount1Abs).toString(),
  //     displayAmount: swappedAmountUSD,
  //     unixTimestampMs: block.timestamp,
  //     txHash: hash,
  //     logIndex: log.logIndex,
  //     blockNumber: block.height,
  //     blockHash: block.hash,
  //     userId: sender,
  //     currency: Currency.USD,
  //     valueUsd: swappedAmountUSD,
  //     gasUsed: Number(gasUsed),
  //     gasFeeUsd: Number(gasPrice) * Number(gasUsed),
  //   };

  //   protocolState.transactions.push(transactionSchema);
  // }

  private async processTokenTradeEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: PrintrProtocolState,
  ): Promise<void> {
    const { token, trader, amount, isBuy, cost, effectivePrice, mintedSupply, reserve } =
      printrAbi.events.TokenTrade.decode(log);
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

    const printrContract = new printrAbi.Contract(
      ctx,
      block.header,
      this.bondingCurveProtocol.contractAddress,
    );
    const baseCurrencyAddress = await printrContract.wrappedNativeToken();

    // Get base currency details (WETH) - not the traded token
    const baseCurrencyContract = new erc20Abi.Contract(ctx, block.header, baseCurrencyAddress);
    // const baseCurrencySymbol = await baseCurrencyContract.symbol();
    const baseCurrencyDecimals = await baseCurrencyContract.decimals();
    //for now we assume the base currency is ETH
    const displayCost = Number(cost) / 10 ** baseCurrencyDecimals;

    const valueInUsd = displayCost * ethPriceUsd;

    const transactionSchema = {
      eventType: MessageType.TRANSACTION,
      eventName: 'TokenTrade',
      tokens: JSON.stringify([
        {
          token: token,
          amount: amount.toString(),
          effectivePrice: effectivePrice.toString(),
          mintedSupply: mintedSupply.toString(),
          reserve: reserve.toString(),
          isBuy: isBuy,
        },
      ]),
      rawAmount: cost.toString(), //todo: confirm on this - should be eth value
      displayAmount: displayCost,
      unixTimestampMs: block.header.timestamp,
      txHash: log.transactionHash,
      logIndex: log.logIndex,
      blockNumber: block.header.height,
      blockHash: block.header.hash,
      userId: trader,
      currency: Currency.USD,
      valueUsd: valueInUsd,
      gasUsed: Number(gasUsed),
      gasFeeUsd: gasFeeUsd,
    };

    protocolState.transactions.push(transactionSchema);
  }

  private async processCurveCreatedEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: PrintrProtocolState,
  ): Promise<void> {
    const { token, creator } = printrAbi.events.CurveCreated.decode(log);
    const { gasPrice, gasUsed } = log.transaction;
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
      eventName: 'CurveCreated',
      tokens: JSON.stringify([
        {
          token: token,
          amount: gasFee.toString(),
          effectivePrice: ethPriceUsd.toString(),
          mintedSupply: 0,
          reserve: 0,
          isBuy: false,
        },
      ]),
      rawAmount: '0',
      displayAmount: 0,
      valueUsd: gasFeeUsd,
      gasUsed: Number(gasUsed),
      gasFeeUsd: gasFeeUsd,
      unixTimestampMs: block.header.timestamp,
      txHash: log.transactionHash,
      logIndex: log.logIndex,
      blockNumber: block.header.height,
      blockHash: block.header.hash,
      userId: creator,
      currency: Currency.USD,
    };

    protocolState.transactions.push(transactionSchema);
  }

  // private async processGraduatedPoolCreatedEvent(
  //   ctx: any,
  //   block: any,
  //   log: any,
  //   protocolState: PrintrProtocolState,
  // ): Promise<void> {
  //   const { pool } = printrAbi.events.GraduatedPoolCreated.decode(log);
  // todo: initialize the respective tokens over here
  //   protocolState.activePools.push(pool.toLocaleLowerCase());
  // }

  private async finalizeBatch(
    ctx: any,
    protocolStates: Map<string, PrintrProtocolState>,
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
    // // Save to database
    // await ctx.store.upsert(protocolState.config.token0); //saves to Token table
    // await ctx.store.upsert(protocolState.config.token1);
    // await ctx.store.upsert(protocolState.config.lpToken);
    // await ctx.store.upsert(protocolState.config);
    // await ctx.store.upsert(protocolState.state);
    // await ctx.store.upsert(protocolState.processState);
  }
}
