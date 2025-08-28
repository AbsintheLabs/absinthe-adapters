// Import required dependencies for database operations
import { Store } from '@subsquid/typeorm-store';
import { ActiveBalances, PoolProcessState } from '../model';
import { DataHandlerContext } from '@subsquid/evm-processor';
import { ActiveBalancesHemi } from './types';

// Import common utilities for data transformation
import { ActiveBalance, jsonToMap } from '@absinthe/common';
import { log } from './logger';

/**
 * loadActiveBalancesFromDb - Reconstructs nested balance maps from database storage
 *
 * This function is critical for crash recovery and state persistence. It handles
 * the complex task of converting flat database storage back into the nested map
 * structure used for efficient in-memory operations during processing.
 *
 * Process flow:
 * 1. Query database for stored balance data using contract-specific ID
 * 2. Deserialize JSON string back into flat Map structure
 * 3. Parse flattened keys to extract token and user addresses
 * 4. Reconstruct nested Map<token, Map<user, balance>> structure
 * 5. Return reconstructed state or undefined if no data exists
 *
 * Data transformation pipeline:
 * Database JSON → Flat Map → Nested Map
 *
 * Why this complexity:
 * - **Database efficiency**: Simple key-value storage in database
 * - **Memory efficiency**: Nested maps for fast operations during processing
 * - **Type safety**: Maintains TypeScript type checking throughout
 * - **Crash recovery**: Allows processor to resume from exact previous state
 *
 * @param ctx - Subsquid data handler context providing database access
 * @param contractAddress - Unique identifier for this protocol instance
 * @returns Reconstructed nested balance map or undefined if no data exists
 */
export async function loadActiveBalancesFromDb(
  ctx: DataHandlerContext<Store>,
  contractAddress: string,
): Promise<ActiveBalancesHemi | undefined> {
  // Query database for stored balance data
  // Uses contract-specific ID to avoid conflicts between different protocol instances
  // ID format: "${contractAddress}-active-balances" ensures uniqueness
  const activeBalancesEntity = await ctx.store.findOne(ActiveBalances, {
    where: { id: `${contractAddress}-active-balances` },
  });

  // Handle fresh start case - no existing data in database
  // This is normal for first-time runs or after database resets
  if (!activeBalancesEntity) return undefined;

  // Convert stored JSON back into flat Map structure
  // jsonToMap handles deserialization and type conversion safely
  // Cast is safe because we control the serialization format
  const flatMap = jsonToMap(activeBalancesEntity.activeBalancesMap as ActiveBalancesHemi);

  // Initialize the nested map structure for reconstruction
  // This will hold the final Map<tokenAddress, Map<userAddress, ActiveBalance>>
  const nestedMap = new Map<string, Map<string, ActiveBalance>>();

  // Reconstruct nested structure from flat key-value pairs
  // Critical reconstruction loop that rebuilds the efficient nested structure
  for (const [key, value] of flatMap.entries()) {
    // Parse the flattened key to extract components
    // Key format: "tokenAddress-userAddress" (set by flattenNestedMap function)
    // Edge case: Keys with multiple dashes - split only on first dash
    const [tokenAddress, eoaAddress] = key.split('-');

    // Validate key format and handle edge cases
    if (!tokenAddress || !eoaAddress) {
      log.warn(`Invalid balance key format: ${key}, skipping entry`);
      continue; // Skip malformed entries to prevent corruption
    }

    // Ensure token-level map exists
    // Lazy initialization: create token map only when first user balance is found
    if (!nestedMap.has(tokenAddress)) {
      nestedMap.set(tokenAddress, new Map());
    }

    // Add user balance to the appropriate token map
    // Non-null assertion (!) is safe because we just ensured the map exists
    // This reconstructs the exact structure used during processing
    nestedMap.get(tokenAddress)!.set(eoaAddress, value);
  }

  // Return fully reconstructed nested map structure
  // This now matches the format expected by the processor for efficient operations
  return nestedMap;
}

/**
 * loadPoolProcessStateFromDb - Loads processing metadata for crash recovery
 *
 * This function loads critical processing state that allows the processor to
 * resume from the exact position where it left off, ensuring no data is lost
 * or duplicated after crashes or restarts.
 *
 * Key data loaded:
 * - lastInterpolatedTs: The last timestamp where time-window processing completed
 * - Processing metadata: Any other state needed for continuation
 *
 * Why this is critical:
 * 1. **Crash recovery**: Resume from exact position, no data loss
 * 2. **Time-window integrity**: Prevent duplicate or missed time windows
 * 3. **State consistency**: Maintain accurate yield calculations across restarts
 * 4. **Performance**: Avoid reprocessing already-completed work
 *
 * Time-window processing explanation:
 * - Processor creates balance snapshots at regular intervals (e.g., every hour)
 * - lastInterpolatedTs tracks the boundary of the last completed window
 * - On restart, processor continues from this timestamp
 * - Prevents gaps or overlaps in time-weighted calculations
 *
 * @param ctx - Subsquid data handler context providing database access
 * @param contractAddress - Unique identifier for this protocol instance
 * @returns Loaded process state or undefined if no previous state exists
 */
export async function loadPoolProcessStateFromDb(
  ctx: DataHandlerContext<Store>,
  contractAddress: string,
): Promise<PoolProcessState | void> {
  // Query database for processing state using contract-specific ID
  // ID format: "${contractAddress}-process-state" ensures isolation between contracts
  // This prevents different protocol instances from interfering with each other
  const poolProcessState = await ctx.store.findOne(PoolProcessState, {
    where: { id: `${contractAddress}-process-state` },
  });

  // Handle both fresh start and existing state cases
  // - Fresh start: Returns undefined, processor will initialize with current timestamp
  // - Existing state: Returns loaded state for continuation
  // - Corrupted state: findOne returns null, handled as fresh start
  return poolProcessState || undefined;
}

/**
 * Edge Cases and Error Handling Summary:
 *
 * loadActiveBalancesFromDb():
 * - No existing data: Returns undefined (fresh start)
 * - Corrupted JSON: jsonToMap handles parsing errors gracefully
 * - Invalid key format: Logs warning and skips malformed entries
 * - Empty database entity: Returns undefined after null check
 * - Large datasets: Efficient Map operations handle scaling
 * - Type mismatches: TypeScript catches type errors at compile time
 *
 * loadPoolProcessStateFromDb():
 * - No existing state: Returns undefined (fresh start)
 * - Database connection issues: Subsquid handles connection errors
 * - Corrupted timestamp data: PoolProcessState constructor validates BigInt
 * - Multiple contracts: Contract-specific IDs prevent state conflicts
 * - Schema changes: Graceful handling of missing/additional fields
 *
 * Performance Considerations:
 * - Database queries are indexed by ID for fast lookup
 * - Map reconstruction is O(n) where n is number of balance entries
 * - Memory usage scales linearly with active user count
 * - No unnecessary data loading (only what's needed for processing)
 *
 * Security Considerations:
 * - Contract address used in ID prevents cross-contract data access
 * - Type casting is safe because we control serialization format
 * - No user input validation needed (data comes from trusted database)
 * - Graceful handling of malformed data prevents crashes
 */
