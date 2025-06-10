import { ActiveBalances, Token } from './model';
import {
  AbsintheApiClient,
  ActiveBalance,
  ChainId,
  Staking,
} from '@absinthe/common';
import { HemiStakingConfig, ValidatedEnv } from '@absinthe/common';
import { processor } from './processor';
import { createHash } from 'crypto';
import { TypeormDatabase } from '@subsquid/typeorm-store';
import * as hemiAbi from './abi/launchPool';
import { pricePosition, getHourlyPrice } from './utils/pricing';

// Define custom interfaces for Hemi staking
interface HemiStakingTransaction {
  user: string;
  amount: number;
  timestampMs: number;
  blockNumber: bigint;
  txHash: string;
  logIndex: number;
  tokenAddress: string;
  rawAmount: string;
}

interface HemiTimeWeightedBalance {
  user: string;
  amount: number;
  startTs: number;
  endTs: number;
  windowDurationMs: number;
  windowId: number;
  tokenAmount: string;
  tokenPrice: number;
}

interface StakingState {
  token: Token;
  activeBalances: Map<string, ActiveBalance>;
  balanceWindows: HemiTimeWeightedBalance[];
  transactions: HemiStakingTransaction[];
  lastProcessedTimestamp: bigint;
}

interface BatchContext {
  ctx: any;
  block: any;
  stakingStates: Map<string, StakingState>;
}

export class HemiStakingProcessor {
  private readonly protocols: HemiStakingConfig[];
  private readonly schemaName: string;
  private readonly refreshWindow: number;
  private readonly apiClient: AbsintheApiClient;

  constructor(env: ValidatedEnv, refreshWindow: number, apiClient: AbsintheApiClient) {
    this.protocols = (env.stakingProtocols as HemiStakingConfig[]).filter(
      (protocol) => protocol.type === Staking.HEMI,
    );

    this.schemaName = this.generateSchemaName();
    this.refreshWindow = refreshWindow;
    this.apiClient = apiClient;
  }

  private generateSchemaName(): string {
    const uniqueContractCombination = this.protocols
      .reduce((acc, protocol) => acc + protocol.contractAddress, '')
      .concat(ChainId.MAINNET.toString());

    const hash = createHash('md5').update(uniqueContractCombination).digest('hex').slice(0, 8);
    return `hemi-staking-${hash}`;
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
    const stakingStates = await this.initializeStakingStates(ctx);

    for (const block of ctx.blocks) {
      await this.processBlock({ ctx, block, stakingStates });
    }

    await this.finalizeBatch(ctx, stakingStates);
  }

  private async initializeStakingStates(ctx: any): Promise<Map<string, StakingState>> {
    const stakingStates = new Map<string, StakingState>();

    for (const protocol of this.protocols) {
      const contractAddress = protocol.contractAddress;
      
      // For Hemi staking, we'll use the contract address as the token identifier
      // since it's a single-token staking contract
      const tokenAddress = contractAddress;
      
      // Load or create token
      let token = await ctx.store.get(Token, { where: { address: tokenAddress } });
      if (!token) {
        token = new Token({
          id: tokenAddress,
          address: tokenAddress,
          decimals: protocol.token.decimals,
          coingeckoId: protocol.token.coingeckoId,
        });
      }

      // Load active balances
      const activeBalancesEntity = await ctx.store.get(ActiveBalances, `${contractAddress}-active-balances`);
      const activeBalances = activeBalancesEntity 
        ? new Map(Object.entries(JSON.parse(activeBalancesEntity.activeBalancesMap)).map(([k, v]: [string, any]) => [
            k, 
            { 
              balance: BigInt(v.balance), 
              updated_at_block_ts: v.updated_at_block_ts, 
              updated_at_block_height: v.updated_at_block_height 
            }
          ]))
        : new Map<string, ActiveBalance>();

      stakingStates.set(contractAddress, {
        token,
        activeBalances,
        balanceWindows: [],
        transactions: [],
        lastProcessedTimestamp: 0n,
      });
    }

    return stakingStates;
  }

  private async processBlock(batchContext: BatchContext): Promise<void> {
    const { ctx, block, stakingStates } = batchContext;

    console.log(`🔍 Processing block ${block.header.height} (timestamp: ${new Date(block.header.timestamp).toISOString()})`);

    for (const protocol of this.protocols) {
      const contractAddress = protocol.contractAddress;
      const stakingState = stakingStates.get(contractAddress)!;

      await this.processLogsForContract(ctx, block, contractAddress, protocol, stakingState);
      await this.processPeriodicBalanceFlush(ctx, block, contractAddress, stakingState);
    }
  }

  private async processLogsForContract(
    ctx: any,
    block: any,
    contractAddress: string,
    protocol: HemiStakingConfig,
    stakingState: StakingState,
  ): Promise<void> {
    const contractLogs = block.logs.filter((log: any) => log.address === contractAddress);

    if (contractLogs.length > 0) {
      console.log(`📋 Found ${contractLogs.length} logs for contract ${contractAddress} in block ${block.header.height}`);
    }

    for (const log of contractLogs) {
      await this.processLog(ctx, block, log, protocol, stakingState);
    }
  }

  private async processLog(
    ctx: any,
    block: any,
    log: any,
    protocol: HemiStakingConfig,
    stakingState: StakingState,
  ): Promise<void> {
    if (log.topics[0] === hemiAbi.events.Deposit.topic) {
      await this.processDepositEvent(ctx, block, log, protocol, stakingState);
    }

    if (log.topics[0] === hemiAbi.events.Withdraw.topic) {
      await this.processWithdrawEvent(ctx, block, log, protocol, stakingState);
    }
  }

  private async processDepositEvent(
    ctx: any,
    block: any,
    log: any,
    protocol: HemiStakingConfig,
    stakingState: StakingState,
  ): Promise<void> {
    const { depositor, token, amount } = hemiAbi.events.Deposit.decode(log);

    const formattedAmount = Number(amount) / 10 ** stakingState.token.decimals;
    
    // Log the deposit transaction details
    console.log(`🔵 DEPOSIT | Depositor: ${depositor} | Amount: ${formattedAmount} | Token: ${token} | TxHash: ${log.transactionHash} | Block: ${block.header.height}`);

    // Create transaction record
    stakingState.transactions.push({
      user: depositor,
      amount: formattedAmount,
      timestampMs: block.header.timestamp,
      blockNumber: BigInt(block.header.height),
      txHash: log.transactionHash,
      logIndex: log.logIndex,
      tokenAddress: token,
      rawAmount: amount.toString(),
    });

    // Update user's active balance
    const currentBalance = stakingState.activeBalances.get(depositor)?.balance || 0n;
    const newBalance = currentBalance + amount;

    console.log(`💰 BALANCE UPDATE | User: ${depositor} | Previous: ${Number(currentBalance) / 10 ** stakingState.token.decimals} | New: ${Number(newBalance) / 10 ** stakingState.token.decimals}`);

    stakingState.activeBalances.set(depositor, {
      balance: newBalance,
      updated_at_block_ts: block.header.timestamp,
      updated_at_block_height: block.header.height,
    });
  }

  private async processWithdrawEvent(
    ctx: any,
    block: any,
    log: any,
    protocol: HemiStakingConfig,
    stakingState: StakingState,
  ): Promise<void> {
    const { withdrawer, token, amount } = hemiAbi.events.Withdraw.decode(log);

    const formattedAmount = Number(amount) / 10 ** stakingState.token.decimals;
    
    // Log the withdrawal transaction details
    console.log(`🔴 WITHDRAW | Withdrawer: ${withdrawer} | Amount: ${formattedAmount} | Token: ${token} | TxHash: ${log.transactionHash} | Block: ${block.header.height}`);

    // Create transaction record
    stakingState.transactions.push({
      user: withdrawer,
      amount: formattedAmount,
      timestampMs: block.header.timestamp,
      blockNumber: BigInt(block.header.height),
      txHash: log.transactionHash,
      logIndex: log.logIndex,
      tokenAddress: token,
      rawAmount: amount.toString(),
    });

    // Update user's active balance
    const currentBalance = stakingState.activeBalances.get(withdrawer)?.balance || 0n;
    const newBalance = currentBalance >= amount ? currentBalance - amount : 0n;

    console.log(`💰 BALANCE UPDATE | User: ${withdrawer} | Previous: ${Number(currentBalance) / 10 ** stakingState.token.decimals} | New: ${Number(newBalance) / 10 ** stakingState.token.decimals}`);

    if (newBalance < currentBalance - amount) {
      console.log(`⚠️  WARNING | Insufficient balance for withdrawal | User: ${withdrawer} | Attempted: ${formattedAmount} | Available: ${Number(currentBalance) / 10 ** stakingState.token.decimals}`);
    }

    stakingState.activeBalances.set(withdrawer, {
      balance: newBalance,
      updated_at_block_ts: block.header.timestamp,
      updated_at_block_height: block.header.height,
    });
  }

  private async processPeriodicBalanceFlush(
    ctx: any,
    block: any,
    contractAddress: string,
    stakingState: StakingState,
  ): Promise<void> {
    const currentTs = block.header.timestamp;

    if (!stakingState.lastProcessedTimestamp) {
      stakingState.lastProcessedTimestamp = BigInt(currentTs);
    }

    while (
      Number(stakingState.lastProcessedTimestamp) + this.refreshWindow < currentTs
    ) {
      const windowsSinceEpoch = Math.floor(
        Number(stakingState.lastProcessedTimestamp) / this.refreshWindow,
      );
      const nextBoundaryTs: number = (windowsSinceEpoch + 1) * this.refreshWindow;

      for (const [userAddress, data] of stakingState.activeBalances.entries()) {
        const oldStart = data.updated_at_block_ts;
        if (data.balance > 0n && oldStart < nextBoundaryTs) {
          // Get token price from CoinGecko
          const tokenPrice = await getHourlyPrice(
            stakingState.token.coingeckoId as string,
            nextBoundaryTs
          );

          // Calculate the USD value of the token balance
          const balanceUsd = pricePosition(
            tokenPrice,
            data.balance,
            stakingState.token.decimals,
          );

          // Create time-weighted balance record
          stakingState.balanceWindows.push({
            user: userAddress,
            amount: balanceUsd,
            startTs: oldStart,
            endTs: nextBoundaryTs,
            windowDurationMs: this.refreshWindow,
            windowId: Math.floor(oldStart / this.refreshWindow),
            tokenAmount: data.balance.toString(),
            tokenPrice: tokenPrice,
          });

          stakingState.activeBalances.set(userAddress, {
            balance: data.balance,
            updated_at_block_ts: nextBoundaryTs,
            updated_at_block_height: block.header.height,
          });
        }
      }
      stakingState.lastProcessedTimestamp = BigInt(nextBoundaryTs);
    }
  }

  private async finalizeBatch(ctx: any, stakingStates: Map<string, StakingState>): Promise<void> {
    for (const protocol of this.protocols) {
      const stakingState = stakingStates.get(protocol.contractAddress)!;

      // Log transaction summary
      if (stakingState.transactions.length > 0) {
        console.log(`\n📊 TRANSACTION SUMMARY for ${protocol.name || protocol.contractAddress}:`);
        console.log(`Total transactions: ${stakingState.transactions.length}`);
        
        const deposits = stakingState.transactions.filter(tx => tx.amount > 0);
        const withdrawals = stakingState.transactions.filter(tx => tx.amount < 0);
        
        console.log(`- Deposits: ${deposits.length}`);
        console.log(`- Withdrawals: ${withdrawals.length}`);
        
        // Log each transaction with details
        stakingState.transactions.forEach((tx, index) => {
          const type = tx.amount > 0 ? 'DEPOSIT' : 'WITHDRAW';
          console.log(`  ${index + 1}. ${type} | User: ${tx.user.slice(0, 8)}...${tx.user.slice(-6)} | Amount: ${Math.abs(tx.amount)} | Token: ${tx.tokenAddress.slice(0, 8)}...${tx.tokenAddress.slice(-6)} | TxHash: ${tx.txHash}`);
        });
      }

      // Send data to Absinthe API (simplified for now)
      if (stakingState.balanceWindows.length > 0) {
        console.log(`\n📈 BALANCE WINDOWS: Sending ${stakingState.balanceWindows.length} balance windows for ${protocol.contractAddress}`);
        // TODO: Convert to proper Absinthe format when needed
      }

      if (stakingState.transactions.length > 0) {
        console.log(`📤 TRANSACTIONS: Sending ${stakingState.transactions.length} transactions for ${protocol.contractAddress}`);
        // TODO: Convert to proper Absinthe format when needed
      }

      // Log active balances summary
      if (stakingState.activeBalances.size > 0) {
        console.log(`\n👥 ACTIVE BALANCES SUMMARY:`);
        console.log(`Total users with active balances: ${stakingState.activeBalances.size}`);
        
        let totalStaked = 0n;
        for (const [user, balance] of stakingState.activeBalances.entries()) {
          totalStaked += balance.balance;
          if (balance.balance > 0n) {
            const formattedBalance = Number(balance.balance) / 10 ** stakingState.token.decimals;
            console.log(`  User: ${user.slice(0, 8)}...${user.slice(-6)} | Balance: ${formattedBalance} tokens`);
          }
        }
        
        const totalStakedFormatted = Number(totalStaked) / 10 ** stakingState.token.decimals;
        console.log(`💎 Total Staked: ${totalStakedFormatted} tokens\n`);
      }

      // Save to database
      await ctx.store.upsert(stakingState.token);
      await ctx.store.upsert(
        new ActiveBalances({
          id: `${protocol.contractAddress}-active-balances`,
          activeBalancesMap: JSON.stringify(
            Object.fromEntries(
              Array.from(stakingState.activeBalances.entries()).map(([k, v]) => [
                k,
                {
                  balance: v.balance.toString(),
                  updated_at_block_ts: v.updated_at_block_ts,
                  updated_at_block_height: v.updated_at_block_height,
                }
              ])
            )
          ),
        }),
      );
    }
  }
}
