import {
  AbsintheApiClient,
  Chain,
  Currency,
  MessageType,
  ValidatedTxnTrackingProtocolConfig,
  ValidatedEnvBase,
} from '@absinthe/common';

import { createHash } from 'crypto';
import { TypeormDatabase } from '@subsquid/typeorm-store';
import { processor } from './processor';
import { BatchContext, ProtocolState } from '@absinthe/common';
import * as vusdMintAbi from './abi/mint';
import { fetchHistoricalUsd, toTransaction } from '@absinthe/common';

/**
 * VUSD Mint Protocol Processor
 *
 * This class handles the indexing and processing of VUSD minting events from the blockchain.
 * VUSD (Vesper USD) is a stablecoin that can be minted by depositing other tokens.
 *
 * Key Responsibilities:
 * - Listen to blockchain events for VUSD minting transactions
 * - Process and transform raw blockchain data into structured format
 * - Calculate USD values using historical price data
 * - Send processed data to the Absinthe API for storage and analytics
 *
 * Architecture Pattern:
 * - Uses Subsquid framework for blockchain indexing
 * - Follows batch processing pattern for efficiency
 * - Maintains protocol state across blocks within a batch
 */
export class VusdMintProcessor {
  // Configuration for the specific VUSD protocol instance being tracked
  private readonly bondingCurveProtocol: ValidatedTxnTrackingProtocolConfig;

  // Unique schema name for database isolation (prevents conflicts between different protocol instances)
  private readonly schemaName: string;

  // Client for sending processed data to the Absinthe API
  private readonly apiClient: AbsintheApiClient;

  // Environment configuration (API keys, URLs, etc.)
  private readonly env: ValidatedEnvBase;

  // Blockchain network configuration (chain ID, name, etc.)
  private readonly chainConfig: Chain;

  /**
   * Initialize the VUSD Mint Processor
   *
   * @param bondingCurveProtocol - Configuration for the VUSD protocol contract
   * @param apiClient - Client for communicating with Absinthe API
   * @param env - Environment variables and configuration
   * @param chainConfig - Blockchain network details
   */
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
  }

  /**
   * Generate a unique schema name for database operations
   *
   * This prevents conflicts when multiple instances of the same protocol
   * are running on different chains or with different configurations.
   *
   * @returns A unique schema name based on contract address and chain ID
   */
  private generateSchemaName(): string {
    // Combine contract address and chain ID to create a unique identifier
    const uniquePoolCombination = this.bondingCurveProtocol.contractAddress
      .toLowerCase()
      .concat(this.bondingCurveProtocol.chainId.toString());

    // Create a short hash for the schema name (8 characters for readability)
    const hash = createHash('md5').update(uniquePoolCombination).digest('hex').slice(0, 8);
    return `vusd-mint-${hash}`;
  }

  /**
   * Main entry point - starts the blockchain indexing process
   *
   * This method sets up the Subsquid processor with database configuration
   * and begins processing blockchain blocks in batches.
   */
  async run(): Promise<void> {
    processor.run(
      // Configure TypeORM database with hot blocks disabled for stability
      // stateSchema isolates this processor's data from other processors
      new TypeormDatabase({ supportHotBlocks: false, stateSchema: this.schemaName }),
      async (ctx) => {
        try {
          await this.processBatch(ctx);
        } catch (error) {
          console.error('Error processing batch:', error);
          throw error; // Re-throw to ensure the processor stops on critical errors
        }
      },
    );
  }

  /**
   * Process a batch of blockchain blocks
   *
   * Subsquid processes blocks in batches for efficiency. This method:
   * 1. Initializes state tracking for the batch
   * 2. Processes each block sequentially
   * 3. Finalizes the batch by sending data to the API
   *
   * @param ctx - Subsquid processing context containing blocks and database access
   */
  private async processBatch(ctx: any): Promise<void> {
    // Initialize tracking state for all protocols in this batch
    const protocolStates = await this.initializeProtocolStates(ctx);

    // Process each block in the batch sequentially
    // Order matters for maintaining accurate state
    for (const block of ctx.blocks) {
      await this.processBlock({ ctx, block, protocolStates });
    }

    // Send all collected data to the Absinthe API
    await this.finalizeBatch(ctx, protocolStates);
  }

  /**
   * Initialize protocol state tracking for the batch
   *
   * Creates a clean state object to track:
   * - Balance changes over time
   * - Transaction events
   *
   * @param ctx - Processing context (unused but kept for consistency)
   * @returns Map of contract addresses to their protocol states
   */
  private async initializeProtocolStates(ctx: any): Promise<Map<string, ProtocolState>> {
    const protocolStates = new Map<string, ProtocolState>();

    // Normalize contract address to lowercase for consistent lookups
    const contractAddress = this.bondingCurveProtocol.contractAddress.toLowerCase();

    // Initialize empty state for this protocol instance
    protocolStates.set(contractAddress, {
      balanceWindows: [], // Time-weighted balance events (not used in VUSD minting)
      transactions: [], // Individual transaction events
    });

    return protocolStates;
  }

  /**
   * Process a single blockchain block
   *
   * Extracts and processes all relevant logs (events) from the block
   * that belong to our tracked protocol contract.
   *
   * @param batchContext - Contains processing context, current block, and protocol states
   */
  private async processBlock(batchContext: BatchContext): Promise<void> {
    const { ctx, block, protocolStates } = batchContext;

    // Get the contract address we're tracking
    const contractAddress = this.bondingCurveProtocol.contractAddress.toLowerCase();

    // Retrieve the state object for this contract
    const protocolState = protocolStates.get(contractAddress)!;

    // Process all logs from this contract in the current block
    await this.processLogsForProtocol(ctx, block, contractAddress, protocolState);
  }

  /**
   * Filter and process logs for a specific protocol contract
   *
   * Blockchain blocks contain many events from many contracts.
   * This method filters to only the events from our target contract.
   *
   * @param ctx - Processing context
   * @param block - Current blockchain block
   * @param contractAddress - The contract address we're interested in
   * @param protocolState - State tracking object for this protocol
   */
  private async processLogsForProtocol(
    ctx: any,
    block: any,
    contractAddress: string,
    protocolState: ProtocolState,
  ): Promise<void> {
    // Filter logs to only those from our target contract
    const poolLogs = block.logs.filter((log: any) => log.address.toLowerCase() === contractAddress);

    // Process each relevant log sequentially
    for (const log of poolLogs) {
      await this.processLog(ctx, block, log, protocolState);
    }
  }

  /**
   * Route individual log events to appropriate handlers
   *
   * This method examines the event signature (topic0) to determine
   * what type of event occurred and routes it to the correct handler.
   *
   * @param ctx - Processing context
   * @param block - Current blockchain block
   * @param log - Individual event log from the blockchain
   * @param protocolState - State tracking for this protocol
   */
  private async processLog(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolState,
  ): Promise<void> {
    // Check the event signature (topic0) to identify the event type
    if (log.topics[0] === vusdMintAbi.events.Mint.topic) {
      // This is a VUSD minting event - process it
      await this.processMintEvent(ctx, block, log, protocolState);
    }
    // Note: Additional event types can be added here as new handlers
    // Example: else if (log.topics[0] === vusdMintAbi.events.Burn.topic) { ... }
  }

  /**
   * Process a VUSD Mint event
   *
   * This is the core business logic that handles when someone mints VUSD tokens.
   * It extracts event data, calculates USD values, and creates transaction records.
   *
   * Event Flow:
   * 1. User deposits tokens (tokenIn, amountIn)
   * 2. Protocol takes transfer fees (amountInAfterTransferFee)
   * 3. Protocol mints VUSD tokens (mintage) to receiver
   * 4. We track this as a transaction with USD values
   *
   * @param ctx - Processing context
   * @param block - Current blockchain block
   * @param log - The mint event log
   * @param protocolState - State tracking for this protocol
   */
  private async processMintEvent(
    ctx: any,
    block: any,
    log: any,
    protocolState: ProtocolState,
  ): Promise<void> {
    // Decode the event data from the blockchain log
    const { tokenIn, amountIn, amountInAfterTransferFee, mintage, receiver } =
      vusdMintAbi.events.Mint.decode(log);

    // Extract gas usage information for fee calculations
    const { gasPrice, gasUsed } = log.transaction;

    // Calculate gas fee in native tokens (Wei for Ethereum)
    const gasFee = Number(gasUsed) * Number(gasPrice);

    // Convert gas fee to human-readable format (ETH)
    const displayGasFee = gasFee / 10 ** 18;

    // Fetch historical USD prices at the time of this transaction
    // This ensures accurate USD valuations for historical data
    const vusdPriceUsd = await fetchHistoricalUsd(
      'vesper-vdollar', // CoinGecko ID for VUSD
      block.header.timestamp, // Block timestamp for historical price
      this.env.coingeckoApiKey, // API key for CoinGecko
    );

    const ethPriceUsd = await fetchHistoricalUsd(
      'ethereum', // CoinGecko ID for ETH
      block.header.timestamp, // Block timestamp for historical price
      this.env.coingeckoApiKey, // API key for CoinGecko
    );

    // Calculate gas fee in USD
    const gasFeeUsd = displayGasFee * ethPriceUsd;

    // Convert mintage from Wei to human-readable format
    // VUSD uses 18 decimal places like most ERC-20 tokens
    const mintageDisplay = Number(mintage) / 10 ** 18;

    // Calculate the USD value of the minted VUSD
    const mintageUsd = mintageDisplay * vusdPriceUsd;

    // Create a structured transaction record following Absinthe's schema
    const transactionSchema = {
      eventType: MessageType.TRANSACTION, // Indicates this is a transaction event
      eventName: 'Mint', // Human-readable event name

      // Store additional event-specific data
      tokens: {
        tokenIn: {
          value: tokenIn, // Address of the input token
          type: 'string',
        },
        amountIn: {
          value: amountIn.toString(), // Amount deposited (before fees)
          type: 'number',
        },
        amountInAfterTransferFee: {
          value: amountInAfterTransferFee.toString(), // Amount after protocol fees
          type: 'number',
        },
      },

      // Core transaction data
      rawAmount: mintage.toString(), // Raw amount in Wei
      displayAmount: mintageDisplay, // Human-readable amount
      unixTimestampMs: block.header.timestamp, // When the transaction occurred
      txHash: log.transactionHash, // Blockchain transaction hash
      logIndex: log.logIndex, // Position of this event in the transaction
      blockNumber: block.header.height, // Block number
      blockHash: block.header.hash, // Block hash
      userId: receiver, // Who received the minted tokens
      currency: Currency.USD, // Currency for valueUsd calculation
      valueUsd: mintageUsd, // USD value of the minted tokens
      gasUsed: Number(gasUsed), // Gas consumed by the transaction
      gasFeeUsd: gasFeeUsd, // USD cost of the transaction fees
    };

    // Add this transaction to the protocol state for batch processing
    protocolState.transactions.push(transactionSchema);
  }

  /**
   * Finalize the batch processing
   *
   * After processing all blocks in the batch, this method:
   * 1. Converts internal transaction format to Absinthe API format
   * 2. Sends all collected data to the Absinthe API
   *
   * @param ctx - Processing context
   * @param protocolStates - All protocol states collected during batch processing
   */
  private async finalizeBatch(ctx: any, protocolStates: Map<string, ProtocolState>): Promise<void> {
    // Get the protocol state for our contract
    const contractAddress = this.bondingCurveProtocol.contractAddress.toLowerCase();
    const protocolState = protocolStates.get(contractAddress)!;

    // Convert internal transaction format to Absinthe API format
    // This adds additional metadata like protocol info, chain info, etc.
    const transactions = toTransaction(
      protocolState.transactions, // Raw transaction data
      this.bondingCurveProtocol, // Protocol configuration
      this.env, // Environment configuration
      this.chainConfig, // Chain configuration
    );

    // Send all processed transactions to the Absinthe API
    // The API will store them for analytics and provide them via REST endpoints
    await this.apiClient.send(transactions);
  }
}
