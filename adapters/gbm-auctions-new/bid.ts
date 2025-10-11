// LP (Liquidity Position) handler for Uniswap V2
import Big from 'big.js';
import { UnifiedEvmLog } from '../../src/types/unified-chain-events.ts';
import { EmitFunctions } from '../../src/types/adapter.ts';
import * as gbmAbi from './abi/main.ts';
import * as erc20Abi from './abi/erc20.ts';
import type { InstanceFrom } from '../../src/types/manifest.ts';
import type { manifest } from './index.ts';
import { md5Hash } from '../../src/utils/helper.ts';

export async function handleBid(
  log: UnifiedEvmLog,
  emitFns: EmitFunctions,
  instance: InstanceFrom<typeof manifest.trackables.bid>,
  contractAddress: string,
  sqdRpcCtx: any,
  redis: any,
): Promise<void> {
  const { bidder, bidamount, saleID, bidIndex } = gbmAbi.events.AuctionBid_Placed.decode({
    topics: log.topics,
    data: log.data,
  });

  // Fetch currency information from contract
  const zebuContract = new gbmAbi.Contract(sqdRpcCtx, contractAddress);

  let currencySymbol = 'UNKNOWN';
  let currencyDecimals = 18;

  try {
    const currencyId = await zebuContract.getSale_CurrencyID(saleID);
    const currencyAddress = await zebuContract.getSale_Currency_Address(currencyId);

    // Cache the currency info
    const currencyKey = `gbm-new:${currencyAddress}:info`;
    const cachedInfo = await redis.get(currencyKey);

    if (cachedInfo) {
      const parsed = JSON.parse(cachedInfo);
      currencySymbol = parsed.symbol;
      currencyDecimals = parsed.decimals;
    } else {
      const erc20Contract = new erc20Abi.Contract(sqdRpcCtx, currencyAddress);

      try {
        currencySymbol = await erc20Contract.symbol();
        currencyDecimals = await erc20Contract.decimals();

        await redis.set(
          currencyKey,
          JSON.stringify({
            symbol: currencySymbol,
            decimals: currencyDecimals,
          }),
        );
      } catch (error) {
        console.warn(`Failed to get currency info for ${currencyAddress}:`, error);
      }
    }
  } catch (error) {
    console.warn(`Failed to fetch currency for auction ${saleID}:`, error);
  }

  // Calculate display amount
  const displayAmount = Number(bidamount) / 10 ** currencyDecimals;

  // Emit the bid action
  await emitFns.action.action({
    key: md5Hash(`${log.txRef}${log.logIndex}`),
    activity: 'bid',
    user: bidder.toLowerCase(),
    asset: contractAddress.toLowerCase(),
    amount: bidamount,
    trackableInstance: instance,
    meta: {
      auctionId: saleID.toString(),
      bidIndex: bidIndex.toString(),
      winner: 'false',
      currencySymbol,
      displayAmount: displayAmount.toString(),
    },
  });
}
