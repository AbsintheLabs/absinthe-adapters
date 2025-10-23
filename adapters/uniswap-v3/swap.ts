// Swap handler for Uniswap V3
import { UnifiedEvmLog } from '../_shared/index.ts';
import { EmitFunctions } from '../_shared/index.ts';
import { md5Hash } from '../_shared/index.ts';
import type { InstanceFrom } from '../_shared/index.ts';
import type { manifest } from './index.ts';

/*
Asset Selector Logic:
| Asset Selector State    | shouldEmitToken0 | shouldEmitToken1 | Result             |
|-------------------------|------------------|------------------|---------------------|
| None                    | ✅               | ✅               | Both sides emitted  |
| Matches token0          | ✅               | ❌               | Token0 only         |
| Matches token1          | ❌               | ✅               | Token1 only         |
| Matches neither         | ❌               | ❌               | Nothing emitted     |
*/

export async function handleSwap(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  instance: InstanceFrom<typeof manifest.trackables.swap>,
  token0Address: string,
  token1Address: string,
  decoded: any, // Already decoded Swap event
): Promise<void> {
  const { amount0, amount1, sender } = decoded;

  // Get the user from the unified log
  const user = log.transactionFrom;

  // Convert amounts to absolute values (they can be negative)
  const amount0Abs = amount0 < 0n ? -amount0 : amount0;
  const amount1Abs = amount1 < 0n ? -amount1 : amount1;

  // Format the swap metadata
  const swapMeta = {
    fromTkAddress: token0Address,
    toTkAddress: token1Address,
    fromTkAmount: amount0.toString(),
    toTkAmount: amount1.toString(),
  };

  // Determine which sides to emit based on asset selector
  const swapLegAddress = instance.assetSelectors?.swapLegAddress;
  const shouldEmitToken0 = !swapLegAddress || swapLegAddress === token0Address;
  const shouldEmitToken1 = !swapLegAddress || swapLegAddress === token1Address;

  // Helper to emit a single swap side
  const emitSwapSide = async (asset: string, amount: bigint) => {
    await emitFns.action.swap({
      key: md5Hash(`${log.txRef}${log.logIndex}`),
      activity: 'swap',
      user,
      asset: { type: 'erc20', address: asset },
      amount: amount,
      trackableInstance: instance,
      meta: swapMeta,
    });
  };

  // Emit the appropriate sides
  if (shouldEmitToken0) {
    await emitSwapSide(token0Address, amount0Abs);
  }

  if (shouldEmitToken1) {
    await emitSwapSide(token1Address, amount1Abs);
  }
}
