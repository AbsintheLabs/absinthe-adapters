import {
  AbsintheApiClient,
  ActiveBalance,
  BondingCurveProtocol,
  BondingCurveProtocolConfig,
  Chain,
  ChainId,
  ChainShortName,
  Currency,
  Dex,
  MessageType,
  ProtocolConfig,
  ValidatedEnvBase,
} from '@absinthe/common';

import { ValidatedEnv } from '@absinthe/common';
import { createHash } from 'crypto';
import { TypeormDatabase } from '@subsquid/typeorm-store';
import { processor } from './processor';
// import { PoolProcessState, PoolState, PoolConfig } from './model';
// import {
//   initPoolConfigIfNeeded,
//   initPoolProcessStateIfNeeded,
//   initPoolStateIfNeeded,
//   loadActiveBalancesFromDb,
// } from './utils/pool';
// import { loadPoolProcessStateFromDb, loadPoolStateFromDb } from './utils/pool';
// import { loadPoolConfigFromDb } from './utils/pool';
import { BatchContext, ProtocolState } from './utils/types';
import * as printrAbi from './abi/printr';
import * as erc20Abi from './abi/erc20';
import { fetchHistoricalUsd, toTransaction } from './utils/helper';
// import { toTransaction } from './utils/helper';

//todo: storage in database
export class PrintrProcessor {
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
    return `univ2-${hash}`;
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

    const contractAddress = this.bondingCurveProtocol.contractAddress;

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
    protocolState: ProtocolState,
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
    protocolState: ProtocolState,
  ): Promise<void> {
    if (log.topics[0] === printrAbi.events.TokenTrade.topic) {
      await this.processTokenTradeEvent(ctx, block, log, protocolState);
    }

    if (log.topics[0] === printrAbi.events.CurveCreated.topic) {
      this.processCurveCreatedEvent(ctx, block, log, protocolState);
    }
  }

  /**
   * @notice Emitted when tokens are traded through the bonding curve
   * @param token Address of the token contract
   * @param trader Address that performed the trade
   * @param isBuy True if tokens were bought, false if sold
   * @param amount Number of tokens traded
   * @param cost Amount of base currency involved in the trade
   * @param effectivePrice Price per token achieved in the trade
   * @param mintedSupply New total supply after the trade
   * @param reserve New reserve balance after the trade
   */

  private async processTokenTradeEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolState,
  ): Promise<void> {
    const { token, trader, amount, isBuy, cost, effectivePrice, mintedSupply, reserve } =
      printrAbi.events.TokenTrade.decode(log);

    const printrContract = new printrAbi.Contract(
      ctx,
      block.header,
      this.bondingCurveProtocol.contractAddress,
    );
    const baseCurrencyAddress = await printrContract.wrappedNativeToken();

    // Get base currency details (WETH/ETH) - not the traded token
    const baseCurrencyContract = new erc20Abi.Contract(ctx, block.header, baseCurrencyAddress);
    const baseCurrencySymbol = await baseCurrencyContract.symbol();
    const baseCurrencyDecimals = await baseCurrencyContract.decimals();
    const ethPriceUsd = await fetchHistoricalUsd('ethereum', block.header.timestamp);
    const displayCost = Number(cost) / 10 ** baseCurrencyDecimals;

    const valueInUsd = displayCost * ethPriceUsd; // todo: add in the txn schema
    const transactionSchema = {
      eventType: MessageType.TRANSACTION,
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
      rawAmount: amount.toString(),
      displayAmount: displayCost,
      unixTimestampMs: block.header.timestamp,
      txHash: log.transactionHash,
      logIndex: log.logIndex,
      blockNumber: block.header.height,
      blockHash: block.header.hash,
      userId: trader,
      currency: Currency.USD,
    };

    protocolState.transactions.push(transactionSchema);
  }

  private async processCurveCreatedEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolState,
  ): Promise<void> {
    const { token, creator } = printrAbi.events.CurveCreated.decode(log);
    // todo: implement this
    const { gasPrice, gasUsed } = log.transaction;
    const gasFee = Number(gasUsed) * Number(gasPrice);
    const displayGasFee = gasFee / 10 ** 18;
    const ethPriceUsd = await fetchHistoricalUsd('ethereum', block.header.timestamp);

    const gasFeeUsd = displayGasFee * ethPriceUsd;
    //todo: discuss on the usd value = gasFee (confirm @andrew)
    const transactionSchema = {
      eventType: MessageType.TRANSACTION,
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
      rawAmount: gasUsed.toString(),
      displayAmount: gasFeeUsd,
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

  private async finalizeBatch(ctx: any, protocolStates: Map<string, ProtocolState>): Promise<void> {
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
