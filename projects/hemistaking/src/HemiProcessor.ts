import { ActiveBalances } from './model';

import {
  AbsintheApiClient,
  ActiveBalance,
  BatchContext,
  Chain,
  ChainId,
  ChainShortName,
  Currency,
  Dex,
  DexProtocolConfig,
  MessageType,
  ProtocolConfig,
  StakingProtocolConfig,
  TimeWeightedBalanceEvent,
  TimeWindowTrigger,
  ValidatedEnvBase,
  ZERO_ADDRESS,
} from '@absinthe/common';

import { processor } from './processor';
import { createHash } from 'crypto';
import { TypeormDatabase } from '@subsquid/typeorm-store';
import { loadActiveBalancesFromDb, loadPoolProcessStateFromDb } from './utils/pool';
import { ProtocolStateHemi } from './utils/types';
import * as hemiAbi from './abi/hemi';
import { fetchHistoricalUsd } from './utils/pricing';
import {
  mapToJson,
  processValueChange,
  toTimeWeightedBalance,
  pricePosition,
} from '@absinthe/common';
import { PoolProcessState } from './model';
import * as erc20Abi from './abi/erc20';

function flattenNestedMap(
  nestedMap: Map<string, Map<string, ActiveBalance>>,
): Map<string, ActiveBalance> {
  const flatMap = new Map<string, ActiveBalance>();
  for (const [tokenAddress, userBalances] of nestedMap.entries()) {
    for (const [userAddress, balance] of userBalances.entries()) {
      flatMap.set(`${tokenAddress}-${userAddress}`, balance);
    }
  }
  return flatMap;
}

const TOKEN_METADATA = [
  // {
  //   address: '0xb4818bb69478730ef4e33cc068dd94278e2766cb',
  //   symbol: 'USDT',
  //   decimals: 18,
  //   coingeckoId: 'tether',
  // },
  {
    address: '0xaa40c0c7644e0b2b224509571e10ad20d9c4ef28',
    symbol: 'hemiBTC',
    decimals: 8,
    coingeckoId: 'bitcoin',
  },
  {
    address: '0x93919784c523f39cacaa98ee0a9d96c3f32b593e',
    symbol: 'BTC',
    decimals: 8,
    coingeckoId: 'bitcoin',
  },
  {
    address: '0x93919784c523f39cacaa98ee0a9d96c3f32b593e',
    symbol: 'BTC',
    decimals: 8,
    coingeckoId: 'bitcoin',
  },
  {
    address: '0x93919784c523f39cacaa98ee0a9d96c3f32b593e',
    symbol: 'BTC',
    decimals: 8,
    coingeckoId: 'bitcoin',
  },
  // {
  //   address: '0x93919784c523f39cacaa98ee0a9d96c3f32b593e',
  //   symbol: 'BTC',
  //   decimals: 8,
  //   coingeckoId: 'bitcoin',
  // },
  // {
  //   address: '0xe85411c030fb32a9d8b14bbbc6cb19417391f711',
  //   symbol: 'BTC',
  //   decimals: 18,
  //   coingeckoId: 'bitcoin',
  // },
  // {
  //   address: '0xf9775085d726e782e83585033b58606f7731ab18',
  //   symbol: 'BTC',
  //   decimals: 8,
  //   coingeckoId: 'bitcoin',
  // },
];

interface TokenMetadata {
  address: string;
  symbol: string;
  decimals: number;
  coingeckoId: string;
}

function checkToken(token: string): TokenMetadata | null {
  let tokenMetadata = TOKEN_METADATA.find((t) => t.address.toLowerCase() === token.toLowerCase());
  if (!tokenMetadata) {
    console.warn(`Ignoring deposit for unsupported token: ${token}`);
    return null;
  }

  return tokenMetadata;
}

export class HemiStakingProcessor {
  private readonly stakingProtocol: StakingProtocolConfig;
  private readonly schemaName: string;
  private readonly refreshWindow: number;
  private readonly apiClient: AbsintheApiClient;
  private readonly chainConfig: Chain;
  private readonly env: ValidatedEnvBase;

  constructor(
    stakingProtocol: StakingProtocolConfig,
    refreshWindow: number,
    apiClient: AbsintheApiClient,
    env: ValidatedEnvBase,
    chainConfig: Chain,
  ) {
    this.stakingProtocol = stakingProtocol;
    this.refreshWindow = refreshWindow;
    this.apiClient = apiClient;
    this.env = env;
    this.chainConfig = chainConfig;
    this.schemaName = this.generateSchemaName();
  }

  private generateSchemaName(): string {
    const uniquePoolCombination = this.stakingProtocol.contractAddress.concat(
      this.chainConfig.networkId.toString(),
    );

    const hash = createHash('md5').update(uniquePoolCombination).digest('hex').slice(0, 8);
    return `hemi-${hash}`;
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
      // console.log('processing block', block.header.height);
      await this.processBlock({ ctx, block, protocolStates });
    }

    await this.finalizeBatch(ctx, protocolStates);
  }

  private async initializeProtocolStates(ctx: any): Promise<Map<string, ProtocolStateHemi>> {
    const protocolStates = new Map<string, ProtocolStateHemi>();

    const contractAddress = this.stakingProtocol.contractAddress;

    protocolStates.set(contractAddress, {
      activeBalances:
        (await loadActiveBalancesFromDb(ctx, contractAddress)) ||
        new Map<string, Map<string, ActiveBalance>>(),
      balanceWindows: [],
      transactions: [],
      processState:
        (await loadPoolProcessStateFromDb(ctx, contractAddress)) || new PoolProcessState({}),
    });

    return protocolStates;
  }

  private async processBlock(batchContext: BatchContext): Promise<void> {
    const { ctx, block, protocolStates } = batchContext;

    const contractAddress = this.stakingProtocol.contractAddress;
    const protocolState = protocolStates.get(contractAddress)!;

    await this.processLogsForProtocol(ctx, block, contractAddress, protocolState);
    await this.processPeriodicBalanceFlush(ctx, block, protocolState);
  }

  private async processLogsForProtocol(
    ctx: any,
    block: any,
    contractAddress: string,
    protocolState: ProtocolStateHemi,
  ): Promise<void> {
    const poolLogs = block.logs.filter(
      (log: any) => log.address.toLowerCase() === contractAddress.toLowerCase(),
    );

    for (const log of poolLogs) {
      await this.processLog(ctx, block, log, protocolState);
    }
  }

  private async processLog(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateHemi,
  ): Promise<void> {
    if (log.topics[0] === hemiAbi.events.Deposit.topic) {
      await this.processDepositEvent(ctx, block, log, protocolState);
    }

    if (log.topics[0] === hemiAbi.events.Withdraw.topic) {
      await this.processWithdrawEvent(ctx, block, log, protocolState);
    }
  }

  private async processDepositEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateHemi,
  ): Promise<void> {
    const { depositor, token, amount } = hemiAbi.events.Deposit.decode(log);

    // const tokenMetadata = checkToken(token);
    // if (!tokenMetadata) {
    //   console.warn(`Ignoring deposit for unsupported token: ${token}`);
    //   return;
    // }

    const baseCurrencyContract = new erc20Abi.Contract(ctx, block.header, token);
    const baseCurrencySymbol = await baseCurrencyContract.symbol();
    const baseCurrencyDecimals = await baseCurrencyContract.decimals();

    console.log('baseCurrencySymbol', baseCurrencySymbol, baseCurrencyDecimals, token);
    const tokenPrice = await fetchHistoricalUsd(baseCurrencySymbol, block.header.timestamp);
    const usdValue = pricePosition(tokenPrice, amount, baseCurrencyDecimals);

    const newHistoryWindows = processValueChange({
      from: depositor,
      to: ZERO_ADDRESS,
      amount: amount,
      usdValue,
      blockTimestamp: block.header.timestamp,
      blockHeight: block.header.height,
      txHash: log.transactionHash,
      activeBalances: protocolState.activeBalances,
      windowDurationMs: this.refreshWindow,
      tokenPrice,
      tokenDecimals: baseCurrencyDecimals,
      tokenAddress: token,
    });

    console.log('newHistoryWindows', newHistoryWindows);

    protocolState.balanceWindows.push(...newHistoryWindows);
  }

  private async processWithdrawEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateHemi,
  ): Promise<void> {
    const { withdrawer, token, amount } = hemiAbi.events.Withdraw.decode(log);

    const tokenMetadata = checkToken(token);
    if (!tokenMetadata) {
      console.warn(`Ignoring withdraw for unsupported token: ${token}`);
      return;
    }
    const baseCurrencyContract = new erc20Abi.Contract(ctx, block.header, token);
    const baseCurrencySymbol = await baseCurrencyContract.symbol();
    const baseCurrencyDecimals = await baseCurrencyContract.decimals();

    console.log('baseCurrencySymbol', baseCurrencySymbol, baseCurrencyDecimals, token);

    const tokenPrice = await fetchHistoricalUsd(baseCurrencySymbol, block.header.timestamp);
    const usdValue = pricePosition(tokenPrice, amount, baseCurrencyDecimals);

    const newHistoryWindows = processValueChange({
      from: ZERO_ADDRESS,
      to: withdrawer,
      amount: BigInt(-amount),
      usdValue,
      blockTimestamp: block.header.timestamp,
      blockHeight: block.header.height,
      txHash: log.transactionHash,
      activeBalances: protocolState.activeBalances,
      windowDurationMs: this.refreshWindow,
      tokenPrice,
      tokenDecimals: baseCurrencyDecimals,
      tokenAddress: token,
    });

    protocolState.balanceWindows.push(...newHistoryWindows);
  }

  private async processPeriodicBalanceFlush(
    ctx: any,
    block: any,
    protocolState: ProtocolStateHemi,
  ): Promise<void> {
    const currentTs = block.header.timestamp;

    if (!protocolState.processState?.lastInterpolatedTs) {
      protocolState.processState.lastInterpolatedTs = currentTs;
    }

    while (
      protocolState.processState.lastInterpolatedTs &&
      protocolState.processState.lastInterpolatedTs + this.refreshWindow < currentTs
    ) {
      const windowsSinceEpoch = Math.floor(
        Number(protocolState.processState.lastInterpolatedTs) / this.refreshWindow, //todo: check if this is correct
      );
      const nextBoundaryTs: number = (windowsSinceEpoch + 1) * this.refreshWindow;

      for (const [tokenAddress, userBalances] of protocolState.activeBalances.entries()) {
        for (const [userAddress, data] of userBalances.entries()) {
          const oldStart = data.updatedBlockTs;
          if (data.balance > 0n && oldStart < nextBoundaryTs) {
            const tokenMetadata = checkToken(tokenAddress);
            if (!tokenMetadata) {
              console.warn(`Ignoring withdraw for unsupported token: ${tokenAddress}`);
              return;
            }
            const tokenPrice = await fetchHistoricalUsd(tokenMetadata.coingeckoId, currentTs);
            const balanceUsd = pricePosition(tokenPrice, data.balance, tokenMetadata.decimals);

            // calculate the usd value of the lp token before and after the transfer
            protocolState.balanceWindows.push({
              userAddress: userAddress,
              deltaAmount: 0,
              trigger: TimeWindowTrigger.EXHAUSTED,
              startTs: oldStart,
              endTs: nextBoundaryTs,
              windowDurationMs: this.refreshWindow,
              startBlockNumber: data.updatedBlockHeight,
              endBlockNumber: block.header.height,
              tokenPrice: tokenPrice,
              tokenDecimals: tokenMetadata.decimals,
              balanceBefore: data.balance.toString(),
              balanceAfter: data.balance.toString(),
              txHash: null,
              currency: Currency.USD,
              valueUsd: balanceUsd, //balanceBeforeUsd
            });

            protocolState.activeBalances.get(tokenAddress)!.set(userAddress, {
              balance: data.balance,
              updatedBlockTs: nextBoundaryTs,
              updatedBlockHeight: block.header.height,
            });
          }
        }
        protocolState.processState.lastInterpolatedTs = nextBoundaryTs;
      }
    }
  }

  private async finalizeBatch(
    ctx: any,
    protocolStates: Map<string, ProtocolStateHemi>,
  ): Promise<void> {
    const contractAddress = this.stakingProtocol.contractAddress;
    const protocolState = protocolStates.get(contractAddress)!;
    // Send data to Absinthe API
    const balances = toTimeWeightedBalance(
      protocolState.balanceWindows,
      this.stakingProtocol,
      this.env,
      this.chainConfig,
    ).filter((e: TimeWeightedBalanceEvent) => e.startUnixTimestampMs !== e.endUnixTimestampMs);
    await this.apiClient.send(balances);

    // Save to database
    await ctx.store.upsert(
      new PoolProcessState({
        id: `${this.stakingProtocol.contractAddress}-process-state`,
        lastInterpolatedTs: protocolState.processState.lastInterpolatedTs,
      }),
    );
    await ctx.store.upsert(
      new ActiveBalances({
        id: `${this.stakingProtocol.contractAddress}-active-balances`,
        activeBalancesMap: mapToJson(flattenNestedMap(protocolState.activeBalances)),
      }),
    );
  }
}
