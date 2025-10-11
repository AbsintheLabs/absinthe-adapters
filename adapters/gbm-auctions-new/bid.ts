// LP (Liquidity Position) handler for Uniswap V2
import Big from 'big.js';
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
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
  },
  {
    name: 'MANA',
    symbol: 'decentraland',
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
  },
  {
    name: 'SAND',
    symbol: 'the-sandbox',
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
  },
  {
    name: 'GHST',
    symbol: 'aavegotchi',
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
  },
  {
    name: 'RUM',
    symbol: 'arrland-rum',
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
  },
  {
    name: 'WETH',
    symbol: 'ethereum',
    address: '0x0000000000000000000000000000000000000000',
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

  let currencyErc20Address: undefined | string;

  // Fetch currency information from contract
  const zebuContract = new gbmAbi.Contract(sqdRpcCtx, contractAddress);

  try {
    const currencyAddress = await zebuContract.getSale_Currency_Address(saleID);

    try {
      currencyErc20Address = currencies.find(
        (currency) => currency.address.toLowerCase() === currencyAddress.toLowerCase(),
      )?.address;
    } catch (error) {
      console.warn(`Failed to get currency info for ${currencyAddress}:`, error);
    }

    if (currencyErc20Address == undefined) {
      const nullCurrency = nullCurrencyAddresses.find(
        (nullCurr) =>
          nullCurr.contractAddress.toLowerCase() === currencyAddress.toLowerCase() &&
          nullCurr.chainId === this.chainId,
      );

      if (nullCurrency) {
        try {
          currencyErc20Address = currencies.find((currency) => currency.name === 'WETH')?.address;
        } catch (error) {
          console.warn(`Failed to fetch ETH price for null currency, using 0`, error);
        }
      } else {
        console.warn(`Currency not found in supported list, using 0 USD value`);
      }
    }
  } catch (error) {
    console.warn(`Failed to fetch currency for auction ${saleID}:`, error);
  }

  // Emit the bid action
  await emitFns.action.action({
    key: md5Hash(`${log.txRef}${log.logIndex}`),
    activity: 'bid',
    user: bidder.toLowerCase(),
    asset: currencyErc20Address?.toLowerCase(),
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
