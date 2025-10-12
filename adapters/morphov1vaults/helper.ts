import { SqdRpcCtx } from '../../src/types/adapter.ts';
import { logger } from '../../src/utils/logger.ts';
import * as morphoVaultsAbi from './abi/morphov1vaults.ts';

export async function getMarketIndexes(
  sqdRpcCtx: SqdRpcCtx,
  height: number,
  marketId: string,
): Promise<bigint | null> {
  try {
    // Create the function call data for the market function
    const marketFunctionTotalAssets = morphoVaultsAbi.functions.totalAssets;
    const marketFunctionTotalSupply = morphoVaultsAbi.functions.totalSupply;

    const assetsResult = await sqdRpcCtx._chain.client.call('eth_call', [
      { to: marketId, data: marketFunctionTotalAssets.encode({}) },
      '0x' + height.toString(16), // Historical call at specific block
    ]);

    const supplyResult = await sqdRpcCtx._chain.client.call('eth_call', [
      { to: marketId, data: marketFunctionTotalSupply.encode({}) },
      '0x' + height.toString(16), // Historical call at specific block
    ]);

    // Decode the result
    const market = marketFunctionTotalAssets.decodeResult(assetsResult);
    const supply = marketFunctionTotalSupply.decodeResult(supplyResult);

    const tsAssets = BigInt(market ?? 0);
    const tsSupply = BigInt(supply ?? 0);

    const SCALE = 10n ** 18n;
    const index = tsSupply === 0n ? SCALE : (tsAssets * SCALE) / tsSupply;

    logger.info(`Supply index: ${index}`);

    return index;
  } catch (error) {
    logger.warn(`Failed to fetch market indexes for ${marketId}:`, error);
    return null;
  }
}
