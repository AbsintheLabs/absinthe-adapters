import type { UnifiedEvmLog as Log } from '../_shared/index.ts';
import type { InstanceFrom, EmitFunctions } from '../_shared/index.ts';
import type { manifest } from './index.ts';

// Import your ABI for decoding events
// import * as protocolAbi from './abi/protocol.ts';

/**
 * EXAMPLE: Position Handler
 *
 * Handles ongoing positions like LP tokens, staking positions, etc.
 * These track balances over time using Time-Weighted Balances (TWB).
 *
 * For token-based positions, you typically emit:
 * - emitBalanceDelta(): When a user's balance changes
 * - emitReprice(): (optional) When the position's value changes
 * - emitPositionStatusChange(): (optional) Mark position as active/inactive
 */

// type PositionConfig = (typeof manifest.trackables.positionExample)['_config'];
type PositionConfig = InstanceFrom<typeof manifest.trackables.positionExample>;

export async function handlePositionTransfer(
  log: Log,
  emitFns: EmitFunctions,
  instance: PositionConfig,
  // Add any additional context params you need
) {
  // Decode the transfer event
  // Typically Transfer(address indexed from, address indexed to, uint256 amount)
  // const decoded = protocolAbi.events.Transfer.decode(log);
  // const from = decoded.from.toLowerCase();
  // const to = decoded.to.toLowerCase();
  // const amount = decoded.amount;
  // const positionTokenAddress = log.address.toLowerCase();
  /**
   * Emit balance deltas for sender and receiver
   *
   * A transfer creates two balance changes:
   * - Sender loses balance (negative delta)
   * - Receiver gains balance (positive delta)
   *
   * Skip zero addresses (mints/burns may need special handling)
   */
  // const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  // // Handle sender (balance decrease)
  // if (from !== ZERO_ADDRESS) {
  //   emitFns.emitBalanceDelta({
  //     timestamp: log.block.timestamp,
  //     user: from,
  //     trackingId: instance.trackingId,
  //     asset: {
  //       address: positionTokenAddress,
  //       chainId: log.block.chainId,
  //     },
  //     delta: `-${amount.toString()}`, // Negative for decrease
  //   });
  // }
  // // Handle receiver (balance increase)
  // if (to !== ZERO_ADDRESS) {
  //   emitFns.emitBalanceDelta({
  //     timestamp: log.block.timestamp,
  //     user: to,
  //     trackingId: instance.trackingId,
  //     asset: {
  //       address: positionTokenAddress,
  //       chainId: log.block.chainId,
  //     },
  //     delta: amount.toString(), // Positive for increase
  //   });
  // }
  /**
   * Optional: Emit position status changes
   *
   * Mark a position as active when user receives their first tokens,
   * or inactive when they exit entirely (balance goes to 0)
   */
  // if (from === ZERO_ADDRESS) {
  //   // This is a mint - mark position as active for receiver
  //   emitFns.emitPositionStatusChange({
  //     timestamp: log.block.timestamp,
  //     user: to,
  //     trackingId: instance.trackingId,
  //     asset: {
  //       address: positionTokenAddress,
  //       chainId: log.block.chainId,
  //     },
  //     status: 'active',
  //   });
  // }
}
