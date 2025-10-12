import { UnifiedEvmLog } from '../../src/types/unified-chain-events.ts';
import { EmitFunctions } from '../../src/types/adapter.ts';
import * as gbmAbi from './abi/main.ts';
import type { InstanceFrom } from '../../src/types/manifest.ts';
import type { manifest } from './index.ts';
import { md5Hash } from '../../src/utils/helper.ts';

const currencies = [
  {
    name: 'USDC',
    symbol: 'usd',
    address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    decimals: 6,
  },
  {
    name: 'GHST',
    symbol: 'aavegotchi',
    address: '0xcd2f22236dd9dfe2356d7c543161d4d260fd9bcb',
    decimals: 18,
  },
  {
    name: 'WETH',
    symbol: 'ethereum',
    address: '0x4200000000000000000000000000000000000006',
    decimals: 18,
  },
];

const nullCurrencyAddresses = [
  {
    name: 'xyz-7',
    contractAddress: '0xDD4d9ae148b7c821b8157828806c78BD0FeCE8C4',
    chainId: 137,
    fromBlock: 73490308,
  },
  {
    name: 'bify',
    contractAddress: '0xBEBE4BaF1f02FA150D42A1Be9eD1B4707c5BE49B',
    chainId: 8453,
    fromBlock: 33033160,
  },
];

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
  const configuredBidToken = (instance as any).assetSelectors?.bidTokenAddress?.toLowerCase();

  if (!configuredBidToken) {
    console.warn(`No bidTokenAddress specified in assetSelectors for ${contractAddress}`);
    return;
  }

  let currencyErc20Address: string | undefined;

  // Fetch currency information from contract
  const zebuContract = new gbmAbi.Contract(sqdRpcCtx, contractAddress);

  try {
    const currencyAddress = await zebuContract.getSale_Currency_Address(saleID);
    console.log(currencyAddress);
    console.log(currencies);
    currencyErc20Address = currencies.find(
      (currency) => currency.address.toLowerCase() === currencyAddress.toLowerCase(),
    )?.address;

    if (!currencyErc20Address) {
      // Check if this is a null currency that should be treated as WETH
      const nullCurrency = nullCurrencyAddresses.find(
        (nullCurr) =>
          nullCurr.contractAddress.toLowerCase() === contractAddress.toLowerCase() &&
          nullCurr.chainId === 8453, // Use the actual chainId from log if available
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
    console.log(bidder, bidamount, saleID, bidIndex, log);
    return;
  }

  // Emit the bid action
  await emitFns.action.action({
    key: md5Hash(`${log.txRef}${log.logIndex}`),
    activity: 'bid',
    user: bidder.toLowerCase(),
    asset: currencyErc20Address.toLowerCase(), // Now safe - we checked it's not null
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
