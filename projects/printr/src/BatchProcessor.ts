import {
  AbsintheApiClient,
  Chain,
  Currency,
  MessageType,
  ProtocolState,
  ValidatedTxnTrackingProtocolConfig,
  ValidatedEnvBase,
  ZERO_ADDRESS,
  ChainId,
  logger,
} from '@absinthe/common';
import { BigDecimal } from '@subsquid/big-decimal';
import { createHash } from 'crypto';
import { TypeormDatabase } from '@subsquid/typeorm-store';
import { processor } from './processor';
import * as printrAbi from './abi/printr';
import * as erc20Abi from './abi/erc20';
import { fetchHistoricalUsd, toTransaction } from '@absinthe/common';
import { PoolInfo, TokenInfo } from './utils/types';
import * as factoryAbi from './abi/factory';
import * as printr2Abi from './abi/printr2';
import * as poolAbi from './abi/pool';
import { LIQUIDITY_FEE_BSC, CHAIN_BASE_TOKENS, LIQUIDITY_FEE } from './utils/consts';
import { loadTokensFromDb, loadPoolsFromDb, saveTokensToDb, savePoolsToDb } from './utils/database';
import * as pool2Abi from './abi/pool2';
export class PrintrProcessor {
  private readonly bondingCurveProtocol: ValidatedTxnTrackingProtocolConfig;
  private readonly schemaName: string;
  private readonly apiClient: AbsintheApiClient;
  private readonly env: ValidatedEnvBase;
  private readonly chainConfig: Chain;
  private tokenState: Map<string, TokenInfo>;
  private poolState: Map<string, PoolInfo>;

  constructor(
    bondingCurveProtocol: ValidatedTxnTrackingProtocolConfig,
    apiClient: AbsintheApiClient,
    env: ValidatedEnvBase,
    chainConfig: Chain,
  ) {
    this.bondingCurveProtocol = bondingCurveProtocol;
    this.schemaName = this.generateSchemaName();
    this.apiClient = apiClient;
    this.env = env;
    this.chainConfig = chainConfig;
    this.tokenState = new Map();
    this.poolState = new Map();

    // Add this after loading from DB, or in the constructor for testing
  }

  private generateSchemaName(): string {
    const uniquePoolCombination = this.bondingCurveProtocol.contractAddress.concat(
      this.bondingCurveProtocol.chainId.toString(),
    );
    console.log(this.bondingCurveProtocol.chainId);

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
    logger.info('Loading tokens and pools from database...');
    this.tokenState = await loadTokensFromDb(ctx);
    this.poolState = await loadPoolsFromDb(ctx);

    logger.info('Loaded tokens:', this.tokenState.size);
    logger.info('Loaded pools:', this.poolState.size);
    logger.info('Pool addresses:', Array.from(this.poolState.keys()));

    const protocolStates = await this.initializeProtocolStates(ctx);
    logger.info('Protocol states [PoolState]', { poolState: this.poolState });
    for (const block of ctx.blocks) {
      await this.processBlock({ ctx, block }, protocolStates);
    }

    await this.finalizeBatch(ctx, protocolStates);
  }

  private async initializeProtocolStates(ctx: any): Promise<Map<string, ProtocolState>> {
    const protocolState = new Map<string, ProtocolState>();
    const contractAddress = this.bondingCurveProtocol.contractAddress.toLowerCase();
    protocolState.set(contractAddress, {
      balanceWindows: [],
      transactions: [],
    });
    return protocolState;
  }

  private async processBlock(
    batchContext: { ctx: any; block: any },
    protocolStates: Map<string, ProtocolState>,
  ): Promise<void> {
    const { ctx, block } = batchContext;

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
    const poolAddresses = Array.from(this.poolState.keys());
    const relevantLogs = block.logs.filter((log: any) => {
      const logAddress = log.address.toLowerCase();

      return (
        logAddress === contractAddress ||
        poolAddresses.some((key) => key.toLowerCase() === logAddress)
      );
    });
    for (const log of relevantLogs) {
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
      await this.processCurveCreatedEvent(ctx, block, log, protocolState);
    }
    if (log.topics[0] === printrAbi.events.LiquidityDeployed.topic) {
      await this.processGraduatedPoolCreatedEvent(ctx, block, log, protocolState);
    }

    if (log.topics[0] === pool2Abi.events.Swap.topic) {
      logger.info('Swap event [ProcessLog]', {
        logAddress: log.address.toLowerCase(),
        poolState: this.poolState,
      });
      const poolAddresses = Array.from(this.poolState.keys());
      if (poolAddresses.some((key) => key.toLowerCase() === log.address.toLowerCase())) {
        await this.processSwapEvent(ctx, block, log, protocolState);
      } else {
        logger.warn('Pool not found:', log.address);
      }
    }

    if (log.topics[0] === poolAbi.events.Swap.topic) {
      logger.info('Swap event [ProcessLog]', {
        logAddress: log.address.toLowerCase(),
        poolState: this.poolState,
      });
      const poolAddresses = Array.from(this.poolState.keys());
      if (poolAddresses.some((key) => key.toLowerCase() === log.address.toLowerCase())) {
        await this.processSwapEvent(ctx, block, log, protocolState);
      } else {
        logger.warn('Pool not found:', log.address);
      }
    }
  }

  private async processSwapEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolState,
  ): Promise<void> {
    let swapData: any;
    if (log.topics[0] === poolAbi.events.Swap.topic) {
      swapData = poolAbi.events.Swap.decode(log);
    } else if (log.topics[0] === pool2Abi.events.Swap.topic) {
      swapData = pool2Abi.events.Swap.decode(log);
    } else {
      logger.warn('Unknown Swap event signature:', log.topics[0]);
      return;
    }
    const { recipient, amount0, amount1 } = swapData;
    const { gasPrice, gasUsed, hash } = log.transaction;
    logger.info('Gas used [Swap]', { blockNumber: block.header.height });
    const gasUsedInEth = Number(gasUsed) / 10 ** 18;
    const gasFee = Number(gasUsed) * Number(gasPrice);
    const displayGasFee = gasFee / 10 ** 18;

    // Get WETH price in USD
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

    const poolAddress = log.address.toLowerCase();
    const poolInfo = this.poolState.get(poolAddress);

    if (!poolInfo) {
      console.warn('Pool not found:', poolAddress);
      return;
    }

    const { token0Address, token1Address } = poolInfo;
    const token0 = this.tokenState.get(token0Address);
    const token1 = this.tokenState.get(token1Address);

    const amount0Exact = BigDecimal(amount0, token0!.decimals).toNumber();
    const amount1Exact = BigDecimal(amount1, token1!.decimals).toNumber();

    // need absolute amounts for volume
    const amount0Abs = Math.abs(amount0Exact);
    const amount1Abs = Math.abs(amount1Exact);

    let swapValueUsd = 0;
    let finalAmount = 0;
    let finalAmountDecAdjusted = 0;
    let coingeckoId = '';

    logger.info('Token addresses [Swap]', { token0Address, token1Address });

    const token0Match = CHAIN_BASE_TOKENS.find(
      (token) => token.address.toLowerCase() === token0Address.toLowerCase(),
    );
    const token1Match = CHAIN_BASE_TOKENS.find(
      (token) => token.address.toLowerCase() === token1Address.toLowerCase(),
    );

    logger.info('Token matches [Swap]', { token0Match, token1Match });
    if (token0Match) {
      const coingeckoId = token0Match.coingeckoId;
      if (coingeckoId === 'ethereum') {
        swapValueUsd = amount0Abs * ethPriceUsd;
      } else {
        try {
          swapValueUsd =
            amount0Abs *
            (await fetchHistoricalUsd(
              coingeckoId,
              block.header.timestamp,
              this.env.coingeckoApiKey,
            ));
        } catch (error) {
          console.warn(`Could not fetch price for ${coingeckoId}, using 0:`, error);
          swapValueUsd = 0;
        }
      }
      finalAmountDecAdjusted = amount0Abs;
      finalAmount = Math.abs(amount0Exact);
    } else if (token1Match) {
      const coingeckoId = token1Match.coingeckoId;
      if (coingeckoId === 'ethereum') {
        swapValueUsd = amount1Abs * ethPriceUsd;
      } else {
        try {
          swapValueUsd =
            amount1Abs *
            (await fetchHistoricalUsd(
              coingeckoId,
              block.header.timestamp,
              this.env.coingeckoApiKey,
            ));
        } catch (error) {
          console.warn(`Could not fetch price for ${coingeckoId}, using 0:`, error);
          swapValueUsd = 0;
        }
      }
      finalAmountDecAdjusted = amount1Abs;
      finalAmount = Math.abs(amount1Exact);
    } else {
      console.warn('Neither token in the pool is a base token, cannot convert to USD equivalent');
      return;
    }

    console.log(`Swap value USD: ${swapValueUsd}`, amount0Abs, amount1Abs, ethPriceUsd);

    const transactionSchema = {
      eventType: MessageType.TRANSACTION,
      eventName: 'Swap',
      tokens: {
        token0Decimals: {
          value: token0!.decimals.toString(),
          type: 'number',
        },
        token0Address: {
          value: token0!.id,
          type: 'string',
        },
        token1Decimals: {
          value: token1!.decimals.toString(),
          type: 'number',
        },
        token1Address: {
          value: token1!.id,
          type: 'string',
        },
        ethPriceUsd: {
          value: ethPriceUsd.toString(),
          type: 'number',
        },
        amount0Abs: {
          value: amount0Abs.toString(),
          type: 'number',
        },
        amount1Abs: {
          value: amount1Abs.toString(),
          type: 'number',
        },
        amount0: {
          value: amount0.toString(),
          type: 'number',
        },
        amount1: {
          value: amount1.toString(),
          type: 'number',
        },
      },
      rawAmount: finalAmount.toString(),
      displayAmount: finalAmountDecAdjusted,
      unixTimestampMs: block.header.timestamp,
      txHash: hash,
      logIndex: log.logIndex,
      blockNumber: block.header.height,
      blockHash: block.header.hash,
      userId: recipient,
      currency: Currency.USD,
      valueUsd: swapValueUsd,
      gasUsed: gasUsedInEth,
      gasFeeUsd: gasFeeUsd,
    };

    protocolState.transactions.push(transactionSchema);
  }

  private async processTokenTradeEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolState,
  ): Promise<void> {
    const { token, trader, amount, isBuy, cost, effectivePrice, mintedSupply, reserve } =
      printrAbi.events.TokenTrade.decode(log);
    const { gasPrice, gasUsed } = log.transaction;
    const gasFee = Number(gasUsed) * Number(gasPrice);
    const gasUsedInEth = Number(gasUsed) / 10 ** 18;
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
    logger.info('Base currency address [TokenTrade]', { baseCurrencyAddress });
    let valueInUsd = 0;

    // Get base currency details (WETH) - not the traded token
    const baseCurrencyContract = new erc20Abi.Contract(ctx, block.header, baseCurrencyAddress);
    // const baseCurrencySymbol = await baseCurrencyContract.symbol();
    const baseCurrencyDecimals = await baseCurrencyContract.decimals();
    //for now we assume the base currency is ETH
    const displayCost = Number(cost) / 10 ** baseCurrencyDecimals;
    const baseToken = CHAIN_BASE_TOKENS.find(
      (token) => token.address.toLowerCase() === baseCurrencyAddress.toLowerCase(),
    );

    if (!baseToken) {
      console.warn('Base currency not found in CHAIN_BASE_TOKENS:', baseCurrencyAddress);
      return;
    }

    const coingeckoId = baseToken.coingeckoId;
    if (coingeckoId === 'ethereum') {
      valueInUsd = displayCost * ethPriceUsd;
    } else if (coingeckoId === 'monad') {
      valueInUsd = displayCost * 2;
    } else {
      try {
        valueInUsd =
          displayCost *
          (await fetchHistoricalUsd(coingeckoId, block.header.timestamp, this.env.coingeckoApiKey));
      } catch (error) {
        console.warn(`Could not fetch price for ${coingeckoId}, using 0:`, error);
        valueInUsd = 0;
      }
    }
    const transactionSchema = {
      eventType: MessageType.TRANSACTION,
      eventName: 'TokenTrade',
      tokens: {
        token: {
          value: token,
          type: 'string',
        },
        amount: {
          value: amount.toString(),
          type: 'number',
        },
        effectivePrice: {
          value: effectivePrice.toString(),
          type: 'number',
        },
        mintedSupply: {
          value: mintedSupply.toString(),
          type: 'number',
        },
        reserve: {
          value: reserve.toString(),
          type: 'number',
        },
      },
      rawAmount: cost.toString(),
      displayAmount: displayCost,
      unixTimestampMs: block.header.timestamp,
      txHash: log.transactionHash,
      logIndex: log.logIndex,
      blockNumber: block.header.height,
      blockHash: block.header.hash,
      userId: trader,
      currency: Currency.USD,
      valueUsd: valueInUsd,
      gasUsed: gasUsedInEth,
      gasFeeUsd: gasFeeUsd,
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
    const { gasPrice, gasUsed } = log.transaction;
    const gasUsedInEth = Number(gasUsed) / 10 ** 18;
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
      eventName: 'CurveCreated',
      tokens: {
        token: {
          value: token,
          type: 'string',
        },
      },
      rawAmount: '0',
      displayAmount: 0,
      valueUsd: gasFeeUsd,
      gasUsed: gasUsedInEth,
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

  private async processGraduatedPoolCreatedEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolState,
  ): Promise<void> {
    const { token, tokenAmount, baseAmount } = printrAbi.events.LiquidityDeployed.decode(log);
    logger.info('Liquidity deployed [GraduatedPoolCreated]', { token, tokenAmount, baseAmount });
    const printr2Contract = new printr2Abi.Contract(
      ctx,
      block.header,
      this.bondingCurveProtocol.contractAddress,
    );

    const baseToken = await printr2Contract.getCurve(token);
    logger.info('Base token [GraduatedPoolCreated]', { baseToken });
    logger.info('BlockNumber [GraduatedPoolCreated]', { blockNumber: block.header.height });
    const univ3Factory = new factoryAbi.Contract(
      ctx,
      block.header,
      this.bondingCurveProtocol.factoryAddress as string,
    );
    logger.info('Token and base token [GraduatedPoolCreated]', {
      token,
      baseToken: baseToken.basePair,
    });

    const [token0, token1] =
      token.toLowerCase() < baseToken.basePair.toLowerCase()
        ? [token, baseToken.basePair]
        : [baseToken.basePair, token];

    console.log(token0, token1, 'Second stage');
    const token0Erc20 = new erc20Abi.Contract(ctx, block.header, token0);
    const token1Erc20 = new erc20Abi.Contract(ctx, block.header, token1);
    const token0Decimals = await token0Erc20.decimals();
    const token1Decimals = await token1Erc20.decimals();

    let liquidityFee = LIQUIDITY_FEE;
    logger.info('Liquidity fee [GraduatedPoolCreated]', { liquidityFee });
    if (
      this.chainConfig.networkId === ChainId.BSC ||
      this.chainConfig.networkId === ChainId.MONAD
    ) {
      liquidityFee = LIQUIDITY_FEE_BSC;
      logger.info('Liquidity fee BSC [GraduatedPoolCreated]', { liquidityFee });
    }

    let poolAddress = await univ3Factory.getPool(token, baseToken.basePair, liquidityFee);
    logger.info('Pool with fee [GraduatedPoolCreated]', { poolAddress });

    if (poolAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
      // poolAddress = await univ3Factory.getPool(token, baseToken.basePair, LIQUIDITY_FEE);
      console.log(`Invalid pool with fee ${liquidityFee}:`, poolAddress);
      return;
    }

    if (!this.tokenState.has(token0)) {
      this.tokenState.set(token0, {
        id: token0,
        decimals: token0Decimals,
      });
      console.log(`Added new token0: ${token0} with decimals: ${token0Decimals}`);
    }

    if (!this.tokenState.has(token1)) {
      this.tokenState.set(token1, {
        id: token1,
        decimals: token1Decimals,
      });
      console.log(`Added new token1: ${token1} with decimals: ${token1Decimals}`);
    }

    const poolInfo: PoolInfo = {
      address: poolAddress.toLowerCase(),
      token0Address: token0,
      token1Address: token1,
      fee: liquidityFee,
      isActive: true,
    };

    this.poolState.set(poolAddress.toLowerCase(), poolInfo);
    console.log('Pool info [GraduatedPoolCreated]', { poolInfo });
    return;
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

    logger.info('Transactions [FinalizeBatch]', {
      transactions: JSON.stringify(transactions, null, 2),
    });

    await this.apiClient.send(transactions);
    await saveTokensToDb(ctx, this.tokenState);
    await savePoolsToDb(ctx, this.poolState);
  }
}
