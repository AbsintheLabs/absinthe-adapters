// Swap handler for Uniswap V2
import Big from 'big.js';
import { UnifiedEvmLog } from '../../src/types/unified-chain-events.ts';
import { EmitFunctions } from '../../src/types/adapter.ts';
import * as univ2Abi from './abi/uniswap-v2.ts';
import { md5Hash } from '../_shared/index.ts';
import type { InstanceFrom } from '../../src/types/manifest.ts';
import type { manifest } from './index.ts';

/*
// | Selector State    | shouldEmitFromSide | shouldEmitToSide | Result             |
// |-------------------|-------------------|------------------|---------------------|
// | None              | ✅                | ✅               | Both sides emitted  |
// | Matches from      | ✅                | ❌               | From side only      |
// | Matches to        | ❌                | ✅               | To side only        |
// | Matches neither   | ❌                | ❌               | Nothing emitted     |
*/
export async function handleSwap(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  instance: InstanceFrom<typeof manifest.trackables.swap>,
  tk0Addr: string,
  tk1Addr: string,
): Promise<void> {
  // Decode the log
  const decoded = univ2Abi.events.Swap.decode({
    topics: log.topics,
    data: log.data,
  });

  const isToken0ToToken1 = decoded.amount0In > 0n;

  // Get the amounts
  const fromAmount = isToken0ToToken1 ? decoded.amount0In : decoded.amount1In;
  const toAmount = isToken0ToToken1 ? decoded.amount1Out : decoded.amount0Out;

  // Get token addresses
  const fromTokenAddress = isToken0ToToken1 ? tk0Addr : tk1Addr;
  const toTokenAddress = isToken0ToToken1 ? tk1Addr : tk0Addr;

  // Get the user from the unified log
  const user = log.transactionFrom;

  // Format the swap metadata
  const swapMeta = {
    fromTkAddress: fromTokenAddress,
    toTkAddress: toTokenAddress,
    fromTkAmount: fromAmount.toString(),
    toTkAmount: toAmount.toString(),
  };

  // Determine which sides to emit based on selector
  const swapLegAddress = instance.selectors?.swapLegAddress;
  const shouldEmitFromSide = !swapLegAddress || swapLegAddress === fromTokenAddress;
  const shouldEmitToSide = !swapLegAddress || swapLegAddress === toTokenAddress;

  // Helper to emit a single swap side
  const emitSwapSide = async (asset: string, amount: bigint) => {
    await emitFns.action.swap({
      key: md5Hash(`${log.transactionHash}${log.logIndex}`),
      priceable: true,
      activity: 'swap',
      user,
      amount: {
        asset,
        amount: new Big(amount.toString()),
      },
      meta: swapMeta,
    });
  };

  // Emit the appropriate sides
  if (shouldEmitFromSide) {
    await emitSwapSide(fromTokenAddress, fromAmount);
  }

  if (shouldEmitToSide) {
    await emitSwapSide(toTokenAddress, toAmount);
  }
}
