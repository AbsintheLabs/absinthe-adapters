import { UnifiedEvmLog } from '../_shared/index.ts';
import { EmitFunctions } from '../../src/types/adapter.ts';
import * as gbmAbi from './abi/main.ts';
import type { InstanceFrom } from '../../src/types/manifest.ts';
import type { manifest } from './index.ts';
import { md5Hash } from '../../src/utils/helper.ts';
import {
  currenciesBase,
  currenciesArbitrum,
  currenciesPolygon,
  nullCurrencyAddresses,
} from './consts.ts';
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

  // Get the configured bidTokenAddress from this instance's assetSelectors

  const chainId = log.chainId;

  const configuredBidToken = (instance as any).assetSelectors?.bidTokenAddress?.toLowerCase();

  if (!configuredBidToken) {
    console.warn(`No bidTokenAddress specified in assetSelectors for ${contractAddress}`);
    return;
  }

  let currencyErc20Address: string | undefined;

  const currencies =
    chainId === 8453
      ? currenciesBase
      : chainId === 42161
        ? currenciesArbitrum
        : chainId === 137
          ? currenciesPolygon
          : [];

  // Fetch currency information from contract
  const zebuContract = new gbmAbi.Contract(sqdRpcCtx, contractAddress);

  try {
    const currencyAddress = await zebuContract.getSale_Currency_Address(saleID);
    currencyErc20Address = currencies.find(
      (currency) => currency.address.toLowerCase() === currencyAddress.toLowerCase(),
    )?.address;

    if (!currencyErc20Address) {
      // Check if this is a null currency that should be treated as WETH
      const nullCurrency = nullCurrencyAddresses.find(
        (nullCurr) => nullCurr.toLowerCase() === contractAddress.toLowerCase(),
      );

      if (nullCurrency) {
        currencyErc20Address = currencies.find((currency) => currency.name === 'WETH')?.address;
      }
    }
  } catch (error) {
    console.warn(`Failed to fetch currency for auction ${saleID}:`, error);
    return;
  }

  // KEY FILTER: Only emit if the dynamic currency matches this instance's configured token
  if (currencyErc20Address?.toLowerCase() !== configuredBidToken) {
    // This bid uses a different currency - skip it for this instance
    return;
  }

  // Additional safety check - don't emit if currencyErc20Address is null/undefined
  if (!currencyErc20Address) {
    console.warn(`No valid currency address for auction ${saleID}, skipping bid`);
    return;
  }

  // Emit the bid action
  await emitFns.action.action({
    key: md5Hash(`${log.txRef}${log.logIndex}`),
    activity: 'bid',
    user: bidder.toLowerCase(),
    asset: { type: 'erc20', address: currencyErc20Address.toLowerCase() }, // Now safe - we checked it's not null
    amount: bidamount,
    trackableInstance: instance,
    meta: {
      auctionId: saleID.toString(),
      bidIndex: bidIndex.toString(),
      winner: 'false',
      displayAmount: bidamount.toString(),
    },
  });
}
