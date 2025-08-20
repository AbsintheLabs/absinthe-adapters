// Import core types from the Absinthe common package
import { ActiveBalance, ProtocolState } from '@absinthe/common';
// Import project-specific database model
import { PoolProcessState } from '../model';

/**
 * ActiveBalancesHemi - Type alias for nested balance mapping structure
 *
 * This represents a two-level mapping for efficient balance lookups:
 * Level 1: tokenAddress -> Map of users for that token
 * Level 2: userAddress -> ActiveBalance data for that user/token combination
 *
 * Structure: Map<tokenAddress, Map<userAddress, ActiveBalance>>
 *
 * Why nested maps instead of flat structure:
 * 1. **Performance**: O(1) lookup for any user's balance in any token
 * 2. **Memory efficiency**: Groups related data together for better cache locality
 * 3. **Iteration efficiency**: Can easily iterate over all users of a specific token
 * 4. **Type safety**: TypeScript can validate the nested structure
 *
 * Example usage:
 * ```typescript
 * const balances: ActiveBalancesHemi = new Map();
 *
 * // Get user's balance for a specific token
 * const userBalance = balances.get(tokenAddress)?.get(userAddress);
 *
 * // Add/update balance
 * if (!balances.has(tokenAddress)) {
 *   balances.set(tokenAddress, new Map());
 * }
 * balances.get(tokenAddress)!.set(userAddress, newBalance);
 * ```
 *
 * Edge cases handled:
 * - Token not found: get() returns undefined, handled with optional chaining
 * - User not found: get() returns undefined, handled gracefully
 * - First user for token: Map auto-creates new nested Map
 */
type ActiveBalancesHemi = Map<string, Map<string, ActiveBalance>>;

/**
 * ProtocolStateHemi - Extended protocol state specific to Hemi staking protocol
 *
 * Extends the base ProtocolState interface with Hemi-specific fields:
 * - processState: Database entity tracking processing progress and metadata
 * - activeBalances: Override base type with Hemi-specific nested map structure
 *
 * This interface ensures type safety while allowing protocol-specific customizations.
 *
 * Why extend instead of replace:
 * 1. **Compatibility**: Maintains compatibility with base Absinthe interfaces
 * 2. **Shared functionality**: Inherits common fields like balanceWindows, transactions
 * 3. **Type safety**: Ensures all required fields are present
 * 4. **Future-proofing**: Easy to add more Hemi-specific fields later
 *
 * Base ProtocolState includes:
 * - balanceWindows: Array of time-weighted balance events to send to API
 * - transactions: Array of transaction events (protocol-dependent usage)
 * - activeBalances: Overridden here with Hemi-specific type
 *
 * Hemi-specific additions:
 * - processState: Tracks last interpolated timestamp for time-window processing
 * - activeBalances: Uses nested map structure for efficient balance operations
 */
interface ProtocolStateHemi extends ProtocolState {
  /**
   * processState - Database entity for tracking processing progress
   *
   * Critical for crash recovery and time-window management:
   * - lastInterpolatedTs: Last timestamp where time-window processing completed
   * - Allows processor to resume from correct position after restart
   * - Prevents duplicate time-window calculations
   * - Ensures accurate yield calculations across restarts
   */
  processState: PoolProcessState;

  /**
   * activeBalances - Nested map structure for efficient balance tracking
   *
   * Overrides the base activeBalances type with Hemi-specific nested structure.
   * This provides:
   * - Fast lookups by token and user
   * - Efficient iteration over users per token
   * - Memory-efficient grouping of related data
   * - Type-safe operations with compile-time validation
   */
  activeBalances: ActiveBalancesHemi;
}

/**
 * TokenMetadata - Configuration data for supported tokens
 *
 * Contains all necessary information to process a token properly:
 * - address: Contract address for event filtering and identification
 * - decimals: Number of decimal places for proper amount calculations
 * - coingeckoId: Identifier for fetching historical price data
 *
 * Why this structure:
 * 1. **Price accuracy**: Decimals ensure proper amount-to-USD conversions
 * 2. **Event filtering**: Address used to validate supported tokens
 * 3. **Price fetching**: CoinGecko ID maps to price API endpoints
 * 4. **Security**: Whitelist approach prevents processing unknown tokens
 *
 * Example token metadata:
 * ```typescript
 * const bitcoinMetadata: TokenMetadata = {
 *   address: '0xaa40c0c7644e0b2b224509571e10ad20d9c4ef28',
 *   decimals: 8,  // Bitcoin uses 8 decimal places
 *   coingeckoId: 'bitcoin'
 * };
 * ```
 *
 * Critical considerations:
 * - **Decimal accuracy**: Wrong decimals = wrong USD calculations
 * - **Address validation**: Must match exactly (case-insensitive)
 * - **CoinGecko ID**: Must be valid for price API calls
 * - **Immutability**: These values should not change after deployment
 */
interface TokenMetadata {
  /**
   * address - Token contract address
   *
   * Used for:
   * - Event filtering: Only process events for supported tokens
   * - Validation: Ensure token is in whitelist before processing
   * - Case-insensitive comparison: Normalized to lowercase for consistency
   *
   * Edge cases:
   * - Mixed case addresses: Handled by toLowerCase() normalization
   * - Invalid addresses: Filtered out by not being in whitelist
   * - Zero address: Handled as special case in transfer logic
   */
  address: string;

  /**
   * decimals - Number of decimal places for the token
   *
   * Critical for accurate calculations:
   * - Amount conversion: Raw amount / (10 ** decimals) = actual amount
   * - USD value calculation: (price * amount) / (10 ** decimals)
   * - Balance display: Proper formatting for user interfaces
   *
   * Common decimal values:
   * - Bitcoin variants: 8 decimals
   * - Ethereum/ERC20: 18 decimals
   * - USDC/USDT: 6 decimals
   *
   * Edge cases:
   * - Zero decimals: Some tokens have no fractional parts
   * - High decimals: JavaScript number precision limits
   * - Mismatch: Wrong decimals cause incorrect USD calculations
   */
  decimals: number;

  /**
   * coingeckoId - CoinGecko API identifier for price data
   *
   * Used for fetching historical USD prices:
   * - Historical accuracy: Prices at specific timestamps
   * - Yield calculations: Accurate USD values over time
   * - API mapping: Must match CoinGecko's token identifiers
   *
   * Examples:
   * - 'bitcoin' for BTC
   * - 'ethereum' for ETH
   * - 'usd-coin' for USDC
   *
   * Edge cases:
   * - Invalid ID: API calls will fail, breaking price fetching
   * - Delisted tokens: CoinGecko may remove price data
   * - New tokens: May not have historical data
   * - Rate limits: API has usage limits requiring careful management
   */
  coingeckoId: string;
}

// Export all types for use throughout the application
// These types provide the foundation for type-safe protocol processing
export { ProtocolStateHemi, ActiveBalancesHemi, TokenMetadata };
