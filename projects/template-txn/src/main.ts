/**
 * VUSD Mint Adapter - Entry Point
 *
 * This file serves as the main entry point for the VUSD Mint protocol adapter.
 * It handles the initialization and startup sequence for indexing VUSD minting events.
 *
 * Startup Flow:
 * 1. Load and validate environment configuration
 * 2. Initialize API client for communication with Absinthe backend
 * 3. Find and validate the VUSD Mint protocol configuration
 * 4. Set up blockchain network configuration
 * 5. Create and start the processor
 *
 * This adapter tracks VUSD (Vesper USD) minting transactions where users
 * deposit tokens and receive newly minted VUSD stablecoins in return.
 */

import { AbsintheApiClient, TxnTrackingProtocol, validateEnv } from '@absinthe/common';
import { VusdMintProcessor } from './BatchProcessor';

// Step 1: Load and validate environment configuration
// This ensures all required environment variables are present and valid
// Including API keys, URLs, database connections, etc.
const env = validateEnv();

// Step 2: Initialize the Absinthe API client
// This client handles communication with the Absinthe backend API
// where processed blockchain data will be sent for storage and analytics
const apiClient = new AbsintheApiClient({
  baseUrl: env.baseConfig.absintheApiUrl, // Base URL for the Absinthe API
  apiKey: env.baseConfig.absintheApiKey, // Authentication key for API access
});

// Step 3: Find the VUSD Mint protocol configuration
// The environment contains configurations for multiple protocols
// We need to find the specific configuration for VUSD Mint
const vusdMintBondingCurveProtocol = env.txnTrackingProtocols.find((txnTrackingProtocol) => {
  return txnTrackingProtocol.type === TxnTrackingProtocol.VUSD_MINT;
});

// Step 4: Validate that the protocol configuration was found
// If the configuration is missing, the adapter cannot function
// This early validation prevents runtime errors later
if (!vusdMintBondingCurveProtocol) {
  throw new Error('VUSDMint protocol not found');
}

// Step 5: Extract and structure chain configuration
// This creates a standardized chain configuration object
// that the processor can use for blockchain-specific operations
const chainConfig = {
  chainArch: vusdMintBondingCurveProtocol.chainArch, // Architecture (e.g., "evm")
  networkId: vusdMintBondingCurveProtocol.chainId, // Numeric chain ID (e.g., 1 for Ethereum)
  chainShortName: vusdMintBondingCurveProtocol.chainShortName, // Short name (e.g., "eth")
  chainName: vusdMintBondingCurveProtocol.chainName, // Full name (e.g., "Ethereum")
};

// Step 6: Create the VUSD Mint processor instance
// This processor will handle the actual blockchain indexing and event processing
const vusdMintProcessor = new VusdMintProcessor(
  vusdMintBondingCurveProtocol, // Protocol-specific configuration (contract address, start block, etc.)
  apiClient, // API client for sending processed data
  env.baseConfig, // General environment configuration
  chainConfig, // Blockchain network configuration
);

// Step 7: Start the processor
// This begins the blockchain indexing process
// The processor will:
// - Connect to the blockchain network
// - Start processing blocks from the configured starting point
// - Decode and process VUSD mint events
// - Send processed data to the Absinthe API
// - Continue running indefinitely, processing new blocks as they arrive
vusdMintProcessor.run();

/**
 * Configuration Notes:
 *
 * Protocol Configuration (from abs_config.json):
 * - type: "vusd-mint" - Identifies this as a VUSD minting protocol
 * - contractAddress: The smart contract address for VUSD minting
 * - chainId: The blockchain network ID
 * - fromBlock: Starting block number for indexing
 * - toBlock: Ending block (0 means continue indefinitely)
 *
 * Environment Variables Required:
 * - ABSINTHE_API_URL: Base URL for the Absinthe API
 * - ABSINTHE_API_KEY: Authentication key for API access
 * - COINGECKO_API_KEY: For fetching historical token prices
 * - Database connection strings for storing processed data
 *
 * Error Handling:
 * - If any required configuration is missing, the process will exit
 * - The processor includes retry logic for temporary failures
 * - Critical errors will stop the process to prevent data corruption
 */
