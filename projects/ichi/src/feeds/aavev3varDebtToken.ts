import { HandlerFactory } from './interface';
import Big from 'big.js';
import { log } from '../utils/logger';

// ABIs
import * as aaveV3VarDebtAbi from '../abi/aavev3variabledebttoken';
import * as erc20Abi from '../abi/erc20';
import * as aaveV3PoolAbi from '../abi/aavev3pool';
import { CoreFeedSelector } from '../types/pricing';

// Handler name constant for AaveV3 variable debt token pricing
const AAVEV3_VAR_DEBT_HANDLER = 'aavev3vardebt';

// ---------- math helpers (RAY for AaveV3) ----------
const RAY = Big(10).pow(27);

// pool: 0x0F43731EB8d45A581f4a36DD74F5f358bc90C73A
// variable token address:

// ---------- Address/key helpers ----------
function parseAssetKey(assetKey: string) {
  // Asset key format: "erc20:variableDebtTokenAddress:userAddress"
  const parts = assetKey.split(':');
  if (parts.length !== 3 || parts[0] !== 'erc20') {
    throw new Error(
      `Invalid asset key format: ${assetKey}. Expected "erc20:variableDebtTokenAddress:userAddress"`,
    );
  }
  const [, debtTokenAddress, userAddress] = parts;
  return { debtTokenAddress, userAddress };
}

// ---------- Main handler ----------
export const aavev3varDebtFactory: HandlerFactory<typeof AAVEV3_VAR_DEBT_HANDLER> =
  (resolve) => async (args) => {
    const { assetConfig, ctx, recurse } = args;
    log.debug('🔍 AAV3VARDEBT: Starting handler for asset:', ctx.asset);

    const feedConfig = assetConfig.priceFeed as Extract<
      CoreFeedSelector,
      { kind: 'aavev3vardebt' }
    >;

    const { debtTokenAddress, kind, underlyingTokenAddress, underlyingTokenFeed, poolAddress } =
      feedConfig;

    // Step 1: call getReserveData on the pool proxy contract (pass in the underlying token address)
    // and cache this value so we can reference it later for other calls (using the metadata handler cache)
    const poolContract = new aaveV3PoolAbi.Contract(ctx.sqdRpcCtx, poolAddress);

    const varBorrowIdxKey = `${underlyingTokenAddress}:${ctx.block.header.height}`;
    const varBorrowIdx = await (async (): Promise<Big> => {
      if (await ctx.handlerMetadataCache.has(AAVEV3_VAR_DEBT_HANDLER, varBorrowIdxKey)) {
        const varBorrowIdx = await ctx.handlerMetadataCache.get(
          AAVEV3_VAR_DEBT_HANDLER,
          varBorrowIdxKey,
        );
        return Big(varBorrowIdx.toString());
      } else {
        const reserveData =
          await poolContract.getReserveNormalizedVariableDebt(underlyingTokenAddress);
        const varBorrowIdx = reserveData.toString();
        await ctx.handlerMetadataCache.set(
          AAVEV3_VAR_DEBT_HANDLER,
          varBorrowIdxKey,
          varBorrowIdx.toString(),
        );
        return Big(varBorrowIdx);
      }
    })();

    // Our price is really: idx * price * decimals. We then multiply by the user's amountScaled balance
    // formula = scaledAmt * borrowIdx / RAY * price_of_underlying  / (divided by underlying decimals) <-- but this step comes in later

    const priceOfUnderlying = await resolve(underlyingTokenFeed, underlyingTokenAddress, ctx);
    // hack: the varDebtToken will always have the same decimals as the underlying, so we can punt the decimals scaling for the enrichment step
    const indexedUnderlyingPrice = varBorrowIdx.div(RAY).mul(priceOfUnderlying.price);
    return indexedUnderlyingPrice.toNumber(); // BUG: this could be an issue with overflow for 1e18 decimal assets!
  };
