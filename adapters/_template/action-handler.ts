import type { UnifiedEvmLog as Log } from '../_shared/index.ts';
import type { InstanceFrom, EmitFunctions } from '../_shared/index.ts';
import type { manifest } from './index.ts';

// Import your ABI for decoding events
// import * as protocolAbi from './abi/protocol.ts';

/**
 * EXAMPLE: Action Handler
 *
 * Handles instantaneous events like swaps, claims, bridges, etc.
 * These are one-time occurrences that generate Action events.
 *
 * For token-based actions, you typically emit:
 * - emitAction(): The action itself with quantity and asset info
 */

// type ActionConfig = (typeof manifest.trackables.actionExample)['_config'];
type ActionConfig = InstanceFrom<typeof manifest.trackables.actionExample>;

export async function handleActionEvent(
  log: Log,
  emitFns: EmitFunctions,
  instance: ActionConfig,
  // Add any additional context params you need (e.g., cached contract data)
) {
  // Decode the event
  // const decoded = protocolAbi.events.EventA.decode(log);
  // Extract relevant data
  // const user = decoded.user.toLowerCase();
  // const amount = decoded.amount;
  // const tokenAddress = decoded.token.toLowerCase();
  /**
   * Emit the action event
   *
   * Fields:
   * - timestamp: When the action occurred
   * - user: Who performed the action
   * - actionKind: Type of action (swap, mint, burn, claim, bridge, or custom string)
   * - trackingId: Unique ID combining trackable + params + selectors
   * - asset: The asset involved (address + metadata)
   * - quantity: Amount of the asset (as string to avoid precision loss)
   * - quantityUsd: (optional) USD value if you can calculate it
   */
  // Example structure:
  // emitFns.emitAction({
  //   timestamp: log.block.timestamp,
  //   user,
  //   actionKind: 'custom_action_name',
  //   trackingId: instance.trackingId,
  //   asset: {
  //     address: tokenAddress,
  //     chainId: log.block.chainId,
  //   },
  //   quantity: amount.toString(),
  //   // quantityUsd: calculatedUsdValue.toString(), // if available
  // });
}
