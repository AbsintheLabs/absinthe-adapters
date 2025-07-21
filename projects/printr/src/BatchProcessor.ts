import {
  AbsintheApiClient,
  Chain,
  Currency,
  MessageType,
  ProtocolState,
  ValidatedBondingCurveProtocolConfig,
  ValidatedEnvBase,
  ZERO_ADDRESS,
  Multicall,
  MULTICALL_ADDRESS,
  MULTICALL_PAGE_SIZE,
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
import { LIQUIDITY_FEE_OLD, WETH_BASE_ADDRESS } from './utils/consts';
import { loadTokensFromDb, loadPoolsFromDb, saveTokensToDb, savePoolsToDb } from './utils/database';
import { sqrtPriceX96ToTokenPrices } from './utils/pricing';
//todo: storage in database
export class PrintrProcessor {
  private readonly bondingCurveProtocol: ValidatedBondingCurveProtocolConfig;
  private readonly schemaName: string;
  private readonly apiClient: AbsintheApiClient;
  private readonly env: ValidatedEnvBase;
  private readonly chainConfig: Chain;
  private tokenState: Map<string, TokenInfo>;
  private poolState: Map<string, PoolInfo>;
  private stateLoaded: boolean;

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
    this.tokenState = new Map();
    this.poolState = new Map();
    this.stateLoaded = false;

    // Add this after loading from DB, or in the constructor for testing
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
    if (!this.stateLoaded) {
      this.tokenState = await loadTokensFromDb(ctx);
      this.poolState = await loadPoolsFromDb(ctx);
      this.stateLoaded = true;
    }

    const protocolStates = await this.initializeProtocolStates(ctx);

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
    const relevantLogs = block.logs.filter((log: any) => {
      const logAddress = log.address.toLowerCase();
      return logAddress === contractAddress || this.poolState.has(logAddress);
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
      this.processCurveCreatedEvent(ctx, block, log, protocolState);
    }
    if (log.topics[0] === printrAbi.events.LiquidityDeployed.topic) {
      await this.processGraduatedPoolCreatedEvent(ctx, block, log, protocolState);
    }
    console.log(log.topics[0]);

    if (log.topics[0] === poolAbi.events.Swap.topic) {
      if (this.poolState.has(log.address.toLowerCase())) {
        await this.processSwapEvent(ctx, block, log, protocolState);
      }
    }
  }

  private async processSwapEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolState,
  ): Promise<void> {
    const { sender, amount0, amount1 } = poolAbi.events.Swap.decode(log);
    const { gasPrice, gasUsed, hash } = log.transaction;
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
    const wethAddressLower = WETH_BASE_ADDRESS.toLowerCase();

    // need absolute amounts for volume
    const amount0Abs = Math.abs(amount0Exact);
    const amount1Abs = Math.abs(amount1Exact);

    let totalWethEquivalent = 0;

    if (token0Address.toLowerCase() === wethAddressLower) {
      // token0 is WETH, token1 is the other token
      // WETH amount is already in WETH
      const wethFromToken0 = amount0Abs;

      // Convert token1 amount to WETH equivalent using pool price
      // We need the pool price to convert token1 to WETH
      try {
        const multicall = new Multicall(ctx, MULTICALL_ADDRESS);
        const res = await multicall.tryAggregate(
          poolAbi.functions.slot0,
          poolAddress,
          [{}],
          MULTICALL_PAGE_SIZE,
        );

        if (res[0]?.success && res[0].value?.sqrtPriceX96) {
          const [price0, price1] = sqrtPriceX96ToTokenPrices(
            res[0].value.sqrtPriceX96,
            token0!.decimals,
            token1!.decimals,
          );
          // price1 = token0 per 1 token1 = WETH per 1 token1
          const wethFromToken1 = amount1Abs * price1;
          totalWethEquivalent = wethFromToken0 + wethFromToken1;
        } else {
          console.warn('Could not get pool price for token1 to WETH conversion');
          totalWethEquivalent = wethFromToken0; // fallback to just WETH amount
        }
      } catch (error) {
        console.warn('Error getting pool price:', error);
        totalWethEquivalent = wethFromToken0; // fallback to just WETH amount
      }
    } else if (token1Address.toLowerCase() === wethAddressLower) {
      // token1 is WETH, token0 is the other token
      // WETH amount is already in WETH
      const wethFromToken1 = amount1Abs;

      // Convert token0 amount to WETH equivalent using pool price
      try {
        const multicall = new Multicall(ctx, MULTICALL_ADDRESS);
        const res = await multicall.tryAggregate(
          poolAbi.functions.slot0,
          poolAddress,
          [{}],
          MULTICALL_PAGE_SIZE,
        );

        if (res[0]?.success && res[0].value?.sqrtPriceX96) {
          const [price0, price1] = sqrtPriceX96ToTokenPrices(
            res[0].value.sqrtPriceX96,
            token0!.decimals,
            token1!.decimals,
          );
          // price0 = token1 per 1 token0 = WETH per 1 token0
          const wethFromToken0 = amount0Abs * price0;
          totalWethEquivalent = wethFromToken1 + wethFromToken0;
        } else {
          console.warn('Could not get pool price for token0 to WETH conversion');
          totalWethEquivalent = wethFromToken1; // fallback to just WETH amount
        }
      } catch (error) {
        console.warn('Error getting pool price:', error);
        totalWethEquivalent = wethFromToken1; // fallback to just WETH amount
      }
    } else {
      console.warn('Neither token in the pool is WETH, cannot convert to WETH equivalent');
      return;
    }

    // Calculate USD value using WETH equivalent and ETH price
    const swappedAmountUSD = totalWethEquivalent * ethPriceUsd;

    console.log(
      `WETH equivalent: ${totalWethEquivalent}, ETH Price USD: ${ethPriceUsd}, Total USD: ${swappedAmountUSD}`,
    );

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
        wethEquivalent: {
          value: totalWethEquivalent.toString(),
          type: 'number',
        },
        ethPriceUsd: {
          value: ethPriceUsd.toString(),
          type: 'number',
        },
      },
      rawAmount: (amount0Abs + amount1Abs).toString(),
      displayAmount: swappedAmountUSD,
      unixTimestampMs: block.header.timestamp,
      txHash: hash,
      logIndex: log.logIndex,
      blockNumber: block.header.height,
      blockHash: block.header.hash,
      userId: sender,
      currency: Currency.USD,
      valueUsd: swappedAmountUSD,
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
    const ethPriceUsd = await fetchHistoricalUsd(
      'ethereum',
      block.header.timestamp,
      this.env.coingeckoApiKey,
    );
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

    const printr2Contract = new printr2Abi.Contract(
      ctx,
      block.header,
      this.bondingCurveProtocol.contractAddress,
    );

    const baseToken = await printr2Contract.getCurve(token);
    const univ3Factory = new factoryAbi.Contract(
      ctx,
      block.header,
      this.bondingCurveProtocol.factoryAddress as string,
    );
    console.log(token, baseToken.basePair);
    const token0Erc20 = new erc20Abi.Contract(ctx, block.header, token);
    const token1Erc20 = new erc20Abi.Contract(ctx, block.header, baseToken.basePair);
    const token0Decimals = await token0Erc20.decimals();
    const token1Decimals = await token1Erc20.decimals();

    let poolAddress = await univ3Factory.getPool(token, baseToken.basePair, LIQUIDITY_FEE_OLD);
    console.log(`Pool with fee ${LIQUIDITY_FEE_OLD}:`, poolAddress);

    if (poolAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
      // poolAddress = await univ3Factory.getPool(token, baseToken.basePair, LIQUIDITY_FEE);
      console.log(`Invalid pool with fee ${LIQUIDITY_FEE_OLD}:`, poolAddress);
      return;
    }

    if (!this.tokenState.has(token)) {
      this.tokenState.set(token, {
        id: token,
        decimals: token0Decimals,
      });
      console.log(`Added new token0: ${token} with decimals: ${token0Decimals}`);
    }

    if (!this.tokenState.has(baseToken.basePair)) {
      this.tokenState.set(baseToken.basePair, {
        id: baseToken.basePair,
        decimals: token1Decimals,
      });
      console.log(`Added new token1: ${baseToken.basePair} with decimals: ${token1Decimals}`);
    }

    const poolInfo: PoolInfo = {
      address: poolAddress.toLowerCase(),
      token0Address: token,
      token1Address: baseToken.basePair,
      fee: LIQUIDITY_FEE_OLD,
      isActive: true,
    };

    this.poolState.set(poolAddress.toLowerCase(), poolInfo);
    return;
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

    // console.log(Array.from(this.tokenState.keys()));
    // console.log(Array.from(this.poolState.keys()));
    await this.apiClient.send(transactions);
    await saveTokensToDb(ctx, this.tokenState);
    await savePoolsToDb(ctx, this.poolState);
  }
}
