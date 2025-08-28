// Uniswap V2 protocol adapter implementation
//
// This adapter demonstrates how to create custom pricing feeds for your protocol.
//
// Example usage of the custom 'univ2lpnav' feed:
//
// const feedConfig: AssetFeedConfig = {
//   '0x1234...': { // LP token address (same as poolAddress)
//     assetType: 'erc20',
//     priceFeed: {
//       kind: 'univ2lpnav',
//       poolAddress: '0x1234...', // Uniswap V2 pair contract address
//       token0: {
//         assetType: 'erc20',
//         priceFeed: { kind: 'coingecko', id: 'ethereum' }
//       },
//       token1: {
//         assetType: 'erc20',
//         priceFeed: { kind: 'coingecko', id: 'usd-coin' }
//       }
//     }
//   }
// };

import Big from 'big.js';
import { Adapter, CustomFeedHandlers } from '../types/adapter';
import { AssetFeedConfig, TokenSelector } from '../types/pricing';
import { HandlerFactory } from '../feeds/interface';
import * as univ2Abi from '../abi/univ2';

// Custom feed selector for Uniswap V2 LP token pricing
type Univ2LpNavFeedSelector = {
  kind: 'univ2lpnav';
  token0: TokenSelector;
  token1: TokenSelector;
  poolAddress: string;
};

// Custom feed handler factory for Uniswap V2 LP tokens
const univ2LpNavFactory: HandlerFactory<'univ2lpnav'> =
  (recurse) =>
  async ({ assetConfig, ctx }) => {
    const feedConfig = assetConfig.priceFeed as Univ2LpNavFeedSelector;

    try {
      // Create contract instance for the LP token
      const lpContract = new univ2Abi.Contract(ctx.sqdRpcCtx, feedConfig.poolAddress);

      // Get token addresses from the pool
      // fixme: should be cached to prevent redundant rpc calls!
      const token0Address = (await lpContract.token0()).toLowerCase();
      const token1Address = (await lpContract.token1()).toLowerCase();

      // Get pool reserves and total supply using the contract methods
      const [reservesData, totalSupply] = await Promise.all([
        lpContract.getReserves(),
        lpContract.totalSupply(),
      ]);

      const { _reserve0: reserve0, _reserve1: reserve1 } = reservesData;

      // Get prices for both underlying tokens using recursion
      const [price0Result, price1Result] = await Promise.all([
        recurse(
          { assetType: feedConfig.token0.assetType, priceFeed: feedConfig.token0.priceFeed },
          token0Address, // Use actual token address as asset key
          ctx,
        ),
        recurse(
          { assetType: feedConfig.token1.assetType, priceFeed: feedConfig.token1.priceFeed },
          token1Address, // Use actual token address as asset key
          ctx,
        ),
      ]);

      // Calculate LP token price
      // LP Price = (reserve0 * price0 + reserve1 * price1) / totalSupply
      const token0Value = new Big(reserve0.toString())
        .div(Math.pow(10, price0Result.metadata.decimals))
        .mul(price0Result.price);
      const token1Value = new Big(reserve1.toString())
        .div(Math.pow(10, price1Result.metadata.decimals))
        .mul(price1Result.price);
      const totalPoolValue = token0Value.plus(token1Value);

      // Get LP token decimals (should be 18 for standard Uniswap V2, but let's be safe)
      const lpDecimals = await lpContract.decimals();
      const lpTokenPrice = totalPoolValue.div(
        new Big(totalSupply.toString()).div(Math.pow(10, lpDecimals)),
      );

      return Number(lpTokenPrice.toString());
    } catch (error) {
      console.warn(`Failed to price Uniswap V2 LP token ${ctx.asset}:`, error);
      return 0;
    }
  };

// Custom feed handlers for this adapter
const customFeeds: CustomFeedHandlers = {
  univ2lpnav: univ2LpNavFactory,
};

// Example function to create a Uniswap V2 adapter with LP token pricing
export function createUniv2Adapter(feedConfig: AssetFeedConfig): Adapter {
  return {
    onLog: async (block, log, emit) => {
      // Handle Transfer events (LP token transfers)
      if (log.topics[0] === univ2Abi.events.Transfer.topic) {
        const { from, to, value } = univ2Abi.events.Transfer.decode(log);
        if (from !== '0x0000000000000000000000000000000000000000') {
          await emit.balanceDelta({
            user: from,
            asset: log.address,
            amount: new Big(value.toString()).neg(),
          });
        }
        if (to !== '0x0000000000000000000000000000000000000000') {
          await emit.balanceDelta({
            user: to,
            asset: log.address,
            amount: new Big(value.toString()),
          });
        }
      }
      if (log.topics[0] === univ2Abi.events.Sync.topic) {
        // await emit.reprice();
      }
    },
    topic0s: [univ2Abi.events.Sync.topic, univ2Abi.events.Transfer.topic],
    feedConfig,
    // Register custom pricing feeds
    customFeeds,
  };
}
