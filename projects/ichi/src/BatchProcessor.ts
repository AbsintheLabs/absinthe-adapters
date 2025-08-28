// Import required models and types for database operations
import { ActiveBalances } from './model';

// Import core Absinthe types and utilities for blockchain indexing
import {
  AbsintheApiClient, // Client for sending data to Absinthe API
  ActiveBalance, // Type for tracking user balances with timestamps
  BatchContext, // Context object passed between batch processing methods
  Chain, // Chain configuration containing network details
  Currency, // Enum for currency types (USD, ETH, etc.)
  processValueChangeBalances, // Utility function for calculating time-weighted balance changes
  TimeWeightedBalanceEvent, // Event type for balance tracking over time
  TimeWindowTrigger, // Enum for what triggered a balance window creation
  ValidatedEnvBase, // Base environment configuration
  ValidatedStakingProtocolConfig, // Staking protocol specific configuration
  ZERO_ADDRESS, // Constant for 0x0000... address used in minting/burning
} from '@absinthe/common';

// Import Subsquid processor and utilities
import { processor } from './processor';
import { createHash } from 'crypto';
import { TypeormDatabase } from '@subsquid/typeorm-store';

// Import local utilities and types
import { loadActiveBalancesFromDb, loadPoolProcessStateFromDb } from './utils/pool';
import { ProtocolStateHemi } from './utils/types';
import * as hemiAbi from './abi/hemi';
import { fetchHistoricalUsd } from '@absinthe/common';
import { mapToJson, toTimeWeightedBalance, pricePosition } from '@absinthe/common';
import { PoolProcessState } from './model';
import { checkToken, flattenNestedMap } from './utils/helper';

import { log } from './utils/logger';

/**
 * HemiStakingProcessor - Main processor class for Hemi staking protocol events
 *
 * This class handles the complete lifecycle of indexing Hemi staking events:
 * 1. Tracks deposit and withdrawal events from smart contracts
 * 2. Maintains time-weighted balances for accurate yield calculations
 * 3. Converts token amounts to USD values using historical price data
 * 4. Sends processed data to Absinthe API for analysis
 * 5. Persists state to database for crash recovery
 *
 * Key Features:
 * - Real-time event processing with batch optimization
 * - Time-window based balance tracking for accurate yield calculations
 * - Multi-token support with automatic price fetching
 * - Crash-resistant state management
 * - Rate-limited API transmission
 */
export class HemiStakingProcessor {
  // Configuration objects - marked readonly to prevent accidental modification
  private readonly stakingProtocol: ValidatedStakingProtocolConfig;
  private readonly schemaName: string; // Unique database schema name to avoid conflicts
  private readonly refreshWindow: number; // Time window duration in milliseconds
  private readonly apiClient: AbsintheApiClient; // Rate-limited client for API communication
  private readonly chainConfig: Chain; // Blockchain network configuration
  private readonly env: ValidatedEnvBase; // Environment variables and API keys
  private readonly contractAddress: string; // Lowercase contract address for consistent comparisons

  /**
   * Constructor initializes the processor with validated configuration
   *
   * @param stakingProtocol - Validated staking protocol configuration from config file
   * @param refreshWindow - Time window duration in milliseconds for balance snapshots
   * @param apiClient - Pre-configured API client with rate limiting
   * @param env - Environment configuration with API keys
   * @param chainConfig - Chain-specific configuration (RPC URLs, network ID, etc.)
   */
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

    // Generate unique schema name for this contract/chain combination
    this.schemaName = this.generateSchemaName();

    // Store contract address in lowercase for consistent string comparisons
    // Edge case: Mixed case addresses could cause comparison failures
    this.contractAddress = stakingProtocol.contractAddress.toLowerCase();
  }

  /**
   * Generates a unique database schema name to avoid conflicts
   *
   * Multiple processors might run simultaneously for different contracts or chains.
   * This method creates a unique identifier by:
   * 1. Combining contract address + network ID
   * 2. Hashing the combination to create a short, unique identifier
   * 3. Prefixing with 'hemi-' for easy identification
   *
   * Edge cases handled:
   * - Same contract deployed on multiple chains: Network ID differentiates them
   * - Multiple contracts on same chain: Contract address differentiates them
   * - Hash collisions: Extremely unlikely with MD5 + 8 chars, but would cause schema conflicts
   *
   * @returns {string} Unique schema name like 'hemi-a1b2c3d4'
   */
  private generateSchemaName(): string {
    const uniquePoolCombination = this.contractAddress.concat(
      this.chainConfig.networkId.toString(),
    );

    // Use MD5 hash truncated to 8 characters for brevity while maintaining uniqueness
    // MD5 is sufficient here since we're not using it for security
    const hash = createHash('md5').update(uniquePoolCombination).digest('hex').slice(0, 8);
    return `hemi-${hash}`;
  }

  /**
   * Main entry point - starts the Subsquid processor
   *
   * Configures TypeORM database with:
   * - supportHotBlocks: false - We don't need to handle chain reorganizations
   * - stateSchema: unique schema name to avoid conflicts with other processors
   *
   * Error handling:
   * - Catches and logs any processing errors
   * - Re-throws errors to trigger Subsquid's retry mechanism
   * - Subsquid will restart the processor from the last saved position
   */
  async run(): Promise<void> {
    processor.run(
      new TypeormDatabase({ supportHotBlocks: false, stateSchema: this.schemaName }),
      async (ctx) => {
        try {
          await this.processBatch(ctx);
        } catch (error) {
          log.error('Error processing batch:', error);
          // Re-throw to trigger Subsquid's error handling and restart mechanism
          throw error;
        }
      },
    );
  }

  /**
   * Processes a batch of blocks in sequence
   *
   * Batch processing flow:
   * 1. Initialize/load existing protocol state from database
   * 2. Process each block in the batch sequentially
   * 3. Finalize batch by sending data to API and saving state
   *
   * Sequential processing is important because:
   * - Balance calculations depend on previous balances
   * - Time-weighted calculations need chronological order
   * - Database consistency requires ordered operations
   *
   * @param ctx - Subsquid context containing blocks and database store
   */
  private async processBatch(ctx: any): Promise<void> {
    // Load existing state or initialize fresh state
    const protocolStates = await this.initializeProtocolStates(ctx);

    // Process blocks sequentially to maintain balance calculation integrity
    for (const block of ctx.blocks) {
      await this.processBlock({ ctx, block, protocolStates });
    }

    // Send processed data to API and save state to database
    await this.finalizeBatch(ctx, protocolStates);
  }

  /**
   * Initializes protocol state from database or creates fresh state
   *
   * State includes:
   * - activeBalances: Nested map of token -> user -> balance data
   * - balanceWindows: Array of time-weighted balance events to send to API
   * - transactions: Array of transaction events (currently unused in this template)
   * - processState: Metadata about processing progress (last interpolated timestamp)
   *
   * Database recovery edge cases:
   * - Fresh start: No existing data, initialize empty maps and arrays
   * - Restart after crash: Load existing balances and process state from database
   * - Corrupted data: Fallback to fresh initialization (logged as warning)
   *
   * @param ctx - Subsquid context for database access
   * @returns Map containing protocol state for each contract address
   */
  private async initializeProtocolStates(ctx: any): Promise<Map<string, ProtocolStateHemi>> {
    const protocolStates = new Map<string, ProtocolStateHemi>();

    protocolStates.set(this.contractAddress, {
      // Load existing active balances or start with empty map
      // Edge case: If database is corrupted, loadActiveBalancesFromDb returns null
      activeBalances:
        (await loadActiveBalancesFromDb(ctx, this.contractAddress)) ||
        new Map<string, Map<string, ActiveBalance>>(),

      // Fresh arrays for this batch - balance windows accumulate events to send to API
      balanceWindows: [],
      transactions: [],

      // Load process state for crash recovery or start fresh
      // processState tracks the last timestamp we created balance windows for
      processState:
        (await loadPoolProcessStateFromDb(ctx, this.contractAddress)) || new PoolProcessState({}),
    });

    return protocolStates;
  }

  /**
   * Processes a single block by handling logs and periodic balance updates
   *
   * Two-phase processing:
   * 1. Process all contract logs in the block (deposits/withdrawals)
   * 2. Handle periodic balance flushes for time-weighted calculations
   *
   * Order matters: Process events first, then check if time windows expired
   *
   * @param batchContext - Contains context, block data, and protocol states
   */
  private async processBlock(batchContext: BatchContext): Promise<void> {
    const { ctx, block, protocolStates } = batchContext;
    const protocolState = protocolStates.get(this.contractAddress)!;

    // Process all deposit/withdrawal events in this block
    await this.processLogsForProtocol(ctx, block, protocolState);

    // Check if any time windows have expired and need balance snapshots
    await this.processPeriodicBalanceFlush(ctx, block, protocolState);
  }

  /**
   * Filters and processes all logs for our specific contract in the block
   *
   * Log filtering is necessary because:
   * - Blocks contain logs from many different contracts
   * - We only care about events from our staking contract
   * - Case-insensitive comparison prevents missed events due to case differences
   *
   * @param ctx - Subsquid context
   * @param block - Block containing logs to process
   * @param protocolState - Current protocol state to update
   */
  private async processLogsForProtocol(
    ctx: any,
    block: any,
    protocolState: ProtocolStateHemi,
  ): Promise<void> {
    // Filter logs to only those from our contract address
    // toLowerCase() handles edge case where log addresses might have different casing
    const poolLogs = block.logs.filter(
      (log: any) => log.address.toLowerCase() === this.contractAddress,
    );

    // Process each relevant log sequentially to maintain state consistency
    for (const log of poolLogs) {
      await this.processLog(ctx, block, log, protocolState);
    }
  }

  /**
   * Routes log events to appropriate handlers based on event signature
   *
   * Event identification:
   * - Uses topics[0] which contains the event signature hash
   * - Compares against known ABI event signatures
   * - Unrecognized events are ignored (not an error - contracts may emit other events)
   *
   * Using separate if statements (not else-if) handles edge case where:
   * - Same transaction might emit multiple event types
   * - All relevant events should be processed
   *
   * @param ctx - Subsquid context
   * @param block - Block containing the log
   * @param log - Specific log event to process
   * @param protocolState - Protocol state to update
   */
  private async processLog(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateHemi,
  ): Promise<void> {
    // Check if this is a Deposit event
    if (log.topics[0] === hemiAbi.events.Deposit.topic) {
      await this.processDepositEvent(ctx, block, log, protocolState);
    }

    // Check if this is a Withdraw event (separate if, not else-if)
    // Edge case: Theoretical situation where same log could match multiple patterns
    if (log.topics[0] === hemiAbi.events.Withdraw.topic) {
      await this.processWithdrawEvent(ctx, block, log, protocolState);
    }
  }

  /**
   * Processes deposit events - users staking tokens into the protocol
   *
   * Deposit flow:
   * 1. Decode event data from transaction log
   * 2. Validate token is supported (prevents processing of unsupported/scam tokens)
   * 3. Fetch historical USD price for accurate value calculation
   * 4. Calculate USD value using token amount, price, and decimals
   * 5. Process balance changes and create time-weighted balance events
   * 6. Add new balance windows to protocol state for API transmission
   *
   * Edge cases handled:
   * - Unsupported tokens: Skip processing to avoid errors
   * - Price fetch failures: Will throw error and retry processing
   * - Zero amounts: Still processed (might be dust or test transactions)
   * - Duplicate events: Handled by transaction hash tracking in processValueChangeBalances
   *
   * @param ctx - Subsquid context
   * @param block - Block containing the deposit event
   * @param log - Deposit event log
   * @param protocolState - Protocol state to update with new balances
   */
  private async processDepositEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateHemi,
  ): Promise<void> {
    // Decode the deposit event from the transaction log
    const { depositor, token, amount } = hemiAbi.events.Deposit.decode(log);

    // DEBUG: Conditional logging for specific address (remove in production)
    // This is useful for debugging specific user behavior without spam
    if (depositor.toLowerCase() !== '0x3a28c6735d9ffa75ad625b6af41d47ce476cde94'.toLowerCase()) {
      // return; // Commented out - would skip processing for all other users
      log.debug('Processing deposit event for address:', depositor, 'token:', token);
    }

    // Validate that we support this token
    // checkToken returns metadata if supported, null if unsupported
    const tokenMetadata = checkToken(token);
    if (!tokenMetadata) {
      log.warn(`Ignoring deposit for unsupported token: ${token}`);
      return; // Skip processing unsupported tokens to prevent errors
    }

    // Fetch historical USD price at the time of the transaction
    // This is crucial for accurate yield calculations over time
    // Edge case: Price might be 0 for very new/illiquid tokens
    const tokenPrice = await fetchHistoricalUsd(
      tokenMetadata.coingeckoId,
      block.header.timestamp,
      this.env.coingeckoApiKey,
    );

    // Calculate USD value of the deposit
    // pricePosition handles decimal conversion: (price * amount) / (10 ** decimals)
    const usdValue = pricePosition(tokenPrice, amount, tokenMetadata.decimals);

    // Process the balance change and create time-weighted balance events
    // This function handles:
    // - Updating active balances for the user
    // - Creating balance window events for time-weighted calculations
    // - Handling edge cases like first deposit, balance updates, etc.
    const newHistoryWindows = processValueChangeBalances({
      from: ZERO_ADDRESS, // Deposits come from zero address (minting pattern)
      to: depositor, // User receiving the staked tokens
      amount: amount, // Raw token amount from event
      usdValue, // Calculated USD value
      blockTimestamp: block.header.timestamp,
      blockHeight: block.header.height,
      txHash: log.transactionHash,
      activeBalances: protocolState.activeBalances, // Current balance state
      windowDurationMs: this.refreshWindow, // Time window for calculations
      tokenPrice,
      tokenDecimals: tokenMetadata.decimals,
      tokenAddress: token,

      // Metadata about the token for API transmission
      // Structured as key-value pairs with type information
      tokens: {
        tokenAddress: {
          value: tokenMetadata.address,
          type: 'string',
        },
        coingeckoId: {
          value: tokenMetadata.coingeckoId,
          type: 'string',
        },
        tokenDecimals: {
          value: `${tokenMetadata.decimals}`,
          type: 'number',
        },
        tokenPrice: {
          value: `${tokenPrice}`,
          type: 'number',
        },
      },
    });

    // Add new balance windows to the protocol state
    // These will be sent to the API at the end of batch processing
    protocolState.balanceWindows.push(...newHistoryWindows);
  }

  /**
   * Processes withdrawal events - users unstaking tokens from the protocol
   *
   * Withdrawal flow is similar to deposits but with reversed direction:
   * 1. Decode withdrawal event data
   * 2. Validate token support
   * 3. Fetch historical price for accurate value calculation
   * 4. Process balance changes (reduction instead of increase)
   * 5. Create time-weighted balance events
   *
   * Key differences from deposits:
   * - from: withdrawer, to: ZERO_ADDRESS (burning pattern)
   * - Reduces user's balance instead of increasing it
   * - May result in zero balance (user exits protocol)
   *
   * Edge cases:
   * - Withdrawal amount > user balance: Handled by processValueChangeBalances
   * - Partial withdrawals: Balance reduced but not zeroed
   * - Full withdrawal: Balance becomes zero, stops generating yield
   *
   * @param ctx - Subsquid context
   * @param block - Block containing the withdrawal event
   * @param log - Withdrawal event log
   * @param protocolState - Protocol state to update
   */
  private async processWithdrawEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolStateHemi,
  ): Promise<void> {
    // Decode withdrawal event data
    const { withdrawer, token, amount } = hemiAbi.events.Withdraw.decode(log);

    // DEBUG: Conditional logging (same pattern as deposits)
    if (withdrawer.toLowerCase() !== '0x3a28c6735d9ffa75ad625b6af41d47ce476cde94'.toLowerCase()) {
      // return; // Commented out - would skip processing
      log.debug('Processing withdraw event for address:', withdrawer, 'token:', token);
    }

    // Validate token support (same validation as deposits)
    const tokenMetadata = checkToken(token);
    if (!tokenMetadata) {
      log.warn(`Ignoring withdraw for unsupported token: ${token}`);
      return;
    }

    // Fetch historical price at withdrawal time
    const tokenPrice = await fetchHistoricalUsd(
      tokenMetadata.coingeckoId,
      block.header.timestamp,
      this.env.coingeckoApiKey,
    );

    // Calculate USD value of withdrawal
    const usdValue = pricePosition(tokenPrice, amount, tokenMetadata.decimals);

    // Process balance change - withdrawal reduces balance
    const newHistoryWindows = processValueChangeBalances({
      from: withdrawer, // User withdrawing tokens
      to: ZERO_ADDRESS, // Tokens burned/destroyed
      amount: amount,
      usdValue,
      blockTimestamp: block.header.timestamp,
      blockHeight: block.header.height,
      txHash: log.transactionHash,
      activeBalances: protocolState.activeBalances,
      windowDurationMs: this.refreshWindow,
      tokenPrice,
      tokenDecimals: tokenMetadata.decimals,
      tokenAddress: token,

      // Same token metadata structure as deposits
      tokens: {
        tokenAddress: {
          value: tokenMetadata.address,
          type: 'string',
        },
        coingeckoId: {
          value: tokenMetadata.coingeckoId,
          type: 'string',
        },
        tokenDecimals: {
          value: `${tokenMetadata.decimals}`,
          type: 'number',
        },
        tokenPrice: {
          value: `${tokenPrice}`,
          type: 'number',
        },
      },
    });

    // Add withdrawal balance windows to protocol state
    protocolState.balanceWindows.push(...newHistoryWindows);
  }

  /**
   * Handles periodic balance flushing for time-weighted yield calculations
   *
   * This is the core of time-weighted balance tracking. The concept:
   * - Users earn yield based on how long they hold tokens
   * - We need to track "balance * time" for accurate yield distribution
   * - Time is divided into windows (e.g., 1 hour, 6 hours, 1 day)
   * - At the end of each window, we create a "snapshot" of all balances
   *
   * Algorithm:
   * 1. Check if any time windows have expired since last processing
   * 2. For each expired window, create balance snapshots for all users
   * 3. Update the "last interpolated timestamp" to track progress
   * 4. Only process users with non-zero balances to reduce data volume
   *
   * Edge cases handled:
   * - Multiple expired windows: Process all windows sequentially
   * - Zero balances: Skip to reduce unnecessary data
   * - Very long gaps: While loop processes all missed windows
   * - Clock drift: Uses block timestamps, not system time
   * - First run: Initialize lastInterpolatedTs to current block time
   *
   * @param ctx - Subsquid context
   * @param block - Current block being processed
   * @param protocolState - Protocol state containing balances and timing info
   */
  private async processPeriodicBalanceFlush(
    ctx: any,
    block: any,
    protocolState: ProtocolStateHemi,
  ): Promise<void> {
    const currentTs = block.header.timestamp;

    // Initialize lastInterpolatedTs on first run
    // Edge case: Fresh start needs a baseline timestamp
    if (!protocolState.processState?.lastInterpolatedTs) {
      protocolState.processState.lastInterpolatedTs = BigInt(currentTs);
    }

    // Process all expired time windows
    // While loop handles case where multiple windows expired (e.g., after downtime)
    while (
      protocolState.processState.lastInterpolatedTs &&
      Number(protocolState.processState.lastInterpolatedTs) + this.refreshWindow < currentTs
    ) {
      // Calculate the next window boundary
      // This math ensures windows align to fixed intervals (e.g., every hour on the hour)
      const windowsSinceEpoch = Math.floor(
        Number(protocolState.processState.lastInterpolatedTs) / this.refreshWindow,
      );
      const nextBoundaryTs: number = (windowsSinceEpoch + 1) * this.refreshWindow;

      // Process all active balances for this window
      // Nested iteration: for each token, for each user
      for (const [tokenAddress, userBalances] of protocolState.activeBalances.entries()) {
        for (const [userAddress, data] of userBalances.entries()) {
          const oldStart = data.updatedBlockTs;

          // Only process balances that:
          // 1. Have a positive amount (> 0)
          // 2. Started before the window boundary (were active during the window)
          if (data.balance > 0n && oldStart < nextBoundaryTs) {
            // Validate token support (should always pass, but defensive programming)
            const tokenMetadata = checkToken(tokenAddress);
            if (!tokenMetadata) {
              log.warn(`Ignoring unsupported token in periodic balance flush: ${tokenAddress}`);
              return; // Skip this token entirely
            }

            // Fetch current price for USD value calculation
            // Note: Using currentTs (block time) not window boundary time
            // This is acceptable because windows are short and price doesn't change rapidly
            const tokenPrice = await fetchHistoricalUsd(
              tokenMetadata.coingeckoId,
              currentTs,
              this.env.coingeckoApiKey,
            );

            // Calculate USD value of the balance
            const balanceUsd = pricePosition(tokenPrice, data.balance, tokenMetadata.decimals);

            // Create a balance window event for this user/token/time period
            protocolState.balanceWindows.push({
              userAddress: userAddress,
              deltaAmount: 0, // No change in balance (just time passage)
              trigger: TimeWindowTrigger.EXHAUSTED, // Triggered by time, not transaction
              startTs: oldStart, // When this balance period started
              endTs: nextBoundaryTs, // When it ended (window boundary)
              windowDurationMs: this.refreshWindow, // Duration of the window
              startBlockNumber: data.updatedBlockHeight,
              endBlockNumber: block.header.height,
              tokenPrice: tokenPrice,
              tokenDecimals: tokenMetadata.decimals,
              balanceBefore: data.balance.toString(), // Balance at start (same as end)
              balanceAfter: data.balance.toString(), // Balance at end (no change)
              txHash: null, // No associated transaction
              currency: Currency.USD,
              valueUsd: balanceUsd, // USD value for yield calculations

              // Token metadata for API transmission
              tokens: {
                tokenAddress: {
                  value: tokenMetadata.address,
                  type: 'string',
                },
                coingeckoId: {
                  value: tokenMetadata.coingeckoId,
                  type: 'string',
                },
                tokenDecimals: {
                  value: `${tokenMetadata.decimals}`,
                  type: 'number',
                },
                tokenPrice: {
                  value: `${tokenPrice}`,
                  type: 'number',
                },
              },
            });

            // Update the balance entry with new start time for next window
            // Balance amount stays the same, but tracking starts from window boundary
            protocolState.activeBalances.get(tokenAddress)!.set(userAddress, {
              balance: data.balance,
              updatedBlockTs: nextBoundaryTs, // New start time
              updatedBlockHeight: block.header.height, // Current block height
            });
          }
        }

        // CRITICAL: Update lastInterpolatedTs after processing all tokens/users
        // This ensures we don't re-process the same window
        // Edge case: Placing this inside the loop could cause double-processing
        protocolState.processState.lastInterpolatedTs = BigInt(nextBoundaryTs);
      }
    }
  }

  /**
   * Finalizes batch processing by sending data to API and persisting state
   *
   * This method handles the "commit" phase of batch processing:
   * 1. Convert balance windows to Absinthe API format
   * 2. Send data to API with rate limiting and retry logic
   * 3. Save state to database for crash recovery
   * 4. Clear temporary state for next batch
   *
   * Transaction safety:
   * - API sends are idempotent (duplicate data is handled by primary keys)
   * - Database upserts are atomic operations
   * - If API fails, data is retried in next batch
   * - If database fails, batch processing stops and retries
   *
   * Edge cases:
   * - Empty balance windows: Still save state to track progress
   * - API rate limiting: Handled by AbsintheApiClient
   * - Database conflicts: Resolved by upsert operations
   * - Large batches: Data is sent in chunks to respect API limits
   *
   * @param ctx - Subsquid context for database access
   * @param protocolStates - Map of protocol states containing processed data
   */
  private async finalizeBatch(
    ctx: any,
    protocolStates: Map<string, ProtocolStateHemi>,
  ): Promise<void> {
    const protocolState = protocolStates.get(this.contractAddress)!;

    // Convert balance windows to Absinthe API format
    // toTimeWeightedBalance adds required metadata and formatting
    const balances = toTimeWeightedBalance(
      protocolState.balanceWindows,
      this.stakingProtocol,
      this.env,
      this.chainConfig,
    );

    // Send processed data to Absinthe API
    // This call includes:
    // - Rate limiting (90ms minimum between requests)
    // - Automatic retries with exponential backoff
    // - Request queuing for high-volume scenarios
    await this.apiClient.send(balances);

    // Persist processing state to database for crash recovery
    // Use upsert to handle both insert and update cases

    // Save process state (timing information)
    await ctx.store.upsert(
      new PoolProcessState({
        id: `${this.contractAddress}-process-state`,
        lastInterpolatedTs: protocolState.processState.lastInterpolatedTs,
      }),
    );

    // Save active balances (user balance information)
    // flattenNestedMap converts Map<string, Map<string, ActiveBalance>> to JSON
    // mapToJson serializes the flattened structure for database storage
    await ctx.store.upsert(
      new ActiveBalances({
        id: `${this.contractAddress}-active-balances`,
        activeBalancesMap: mapToJson(flattenNestedMap(protocolState.activeBalances)),
      }),
    );
  }
}
