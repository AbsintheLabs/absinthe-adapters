import {
  AbsintheApiClient,
  ActiveBalance,
  BatchContext,
  Chain,
  Currency,
  processValueChange,
  TimeWeightedBalanceEvent,
  TimeWindowTrigger,
  ValidatedEnvBase,
  ValidatedStakingProtocolConfig,
} from '@absinthe/common';

import { processor } from './processor';
import { createHash } from 'crypto';
import { TypeormDatabase } from '@subsquid/typeorm-store';
import { loadActiveBalancesFromDb, loadPoolProcessStateFromDb } from './utils/pool';
import { ProtocolStateHemi } from './utils/types';
import * as vusdAbi from './abi/vusd';
import { fetchHistoricalUsd } from './utils/pricing';
import { mapToJson, toTimeWeightedBalance, pricePosition } from '@absinthe/common';
import { ActiveBalances, PoolProcessState } from './model/index';
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
  {
    address: '0x677ddbd918637e5f2c79e164d402454de7da8619',
    symbol: 'VUSD',
    decimals: 18,
    coingeckoId: 'vesper-vdollar',
  },
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

export class VUSDBridgeProcessor {
  private readonly stakingProtocol: ValidatedStakingProtocolConfig;
  private readonly schemaName: string;
  private readonly refreshWindow: number;
  private readonly apiClient: AbsintheApiClient;
  private readonly chainConfig: Chain;
  private readonly env: ValidatedEnvBase;

  constructor(
    stakingProtocol: ValidatedStakingProtocolConfig,
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
    return `vusd-bridge-${hash}`;
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
    const poolLogs = block.logs.filter((log: any) => {
      return log.address.toLowerCase() === contractAddress.toLowerCase();
    });

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
    if (log.topics[0] === vusdAbi.events.ERC20BridgeFinalized.topic) {
      await this.processBridgeEvent(ctx, block, log, protocolState);
    }
  }

  private async processBridgeEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateHemi,
  ): Promise<void> {
    const { localToken, remoteToken, from, to, amount, extraData } =
      vusdAbi.events.ERC20BridgeFinalized.decode(log);

    const tokenMetadata = checkToken(localToken);
    if (!tokenMetadata) {
      console.warn(`Ignoring deposit for unsupported token: ${localToken}`);
      return;
    }
    // todo: just add the token correctly - rest working fine

    const baseCurrencyContract = new erc20Abi.Contract(ctx, block.header, localToken);
    const baseCurrencySymbol = await baseCurrencyContract.symbol();
    const baseCurrencyDecimals = await baseCurrencyContract.decimals();

    const remoteTokenContract = new erc20Abi.Contract(ctx, block.header, remoteToken);
    const remoteTokenSymbol = await remoteTokenContract.symbol();
    const remoteTokenDecimals = await remoteTokenContract.decimals();

    const tokenPrice = await fetchHistoricalUsd(tokenMetadata.coingeckoId, block.header.timestamp);
    const usdValue = pricePosition(tokenPrice, amount, tokenMetadata.decimals);

    const newHistoryWindows = processValueChange({
      from: from,
      to: to,
      amount: amount,
      usdValue,
      blockTimestamp: block.header.timestamp,
      blockHeight: block.header.height,
      txHash: log.transactionHash,
      activeBalances: protocolState.activeBalances,
      windowDurationMs: this.refreshWindow,
      tokenPrice,
      tokenDecimals: tokenMetadata.decimals,
      tokenAddress: localToken,
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
      protocolState.processState.lastInterpolatedTs = BigInt(currentTs);
    }

    while (
      protocolState.processState.lastInterpolatedTs &&
      Number(protocolState.processState.lastInterpolatedTs) + this.refreshWindow < currentTs
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
        protocolState.processState.lastInterpolatedTs = BigInt(nextBoundaryTs);
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
