// import { ChainId, ChainType, Currency, PriceFeed, SimpleTimeWeightedBalance, SimpleTransaction, TimeWeightedBalance, Transaction, UniswapV2SwapMetadata, UniswapV2TWBMetadata } from "@absinthe/common";
// import { PoolConfig } from "../model";
// import { ValidatedEnv } from "@absinthe/common";

// export function toTimeWeightedBalance(
//     simpleTimeWeightedBalances: SimpleTimeWeightedBalance[],
//     env: ValidatedEnv,
//     poolConfig: PoolConfig
// ): TimeWeightedBalance<UniswapV2TWBMetadata>[] {
//     return simpleTimeWeightedBalances.map((e) => {
//         return {
//             version: ChainId.MAINNET as const,
//             dataType: 'time_weighted_balance' as const,
//             user: e.user,
//             chain: { networkId: env.chainId, name: env.chainShortName, chainType: ChainType.EVM as const },
//             amount: e.amount,
//             amountType: {
//                 amountType: Currency.USD,
//                 priceFeed: PriceFeed.COINGECKO
//             },
//             timeWindow: e.timeWindow,
//             protocolMetadata: {
//                 poolAddress: poolConfig.lpToken.address,
//                 lpTokenAmount: e.protocolMetadata!.lpTokenAmount!
//             },
//         };
//     })
// }

// export function toTransaction(simpleTransactions: SimpleTransaction[], env: ValidatedEnv, poolConfig: PoolConfig): Transaction<UniswapV2SwapMetadata>[] {
//     return simpleTransactions.map((e) => {
//         return {
//             version: ChainId.MAINNET as const,
//             dataType: 'transaction' as const,
//             user: e.user,
//             amount: e.amount,
//             amountType: {
//                 amountType: Currency.USD,
//                 priceFeed: PriceFeed.COINGECKO
//             },
//             timestampMs: e.timestampMs,
//             blockNumber: e.blockNumber,
//             txHash: e.txHash,
//             logIndex: e.logIndex,
//             chain: { networkId: env.chainId, name: env.chainShortName, chainType: ChainType.EVM as const },
//             protocolMetadata: {
//                 token0Amount: e.protocolMetadata!.token0Amount!,
//                 token1Amount: e.protocolMetadata!.token1Amount!,
//                 token0: {
//                     decimals: poolConfig.token0.decimals,
//                     tokenAddress: poolConfig.token0.address,
//                     tokenName: poolConfig.token0.coingeckoId!,
//                     tokenSymbol: poolConfig.token0.coingeckoId!,
//                     tokenType: 'erc20' as const
//                 },
//                 token1: {
//                     decimals: poolConfig.token1.decimals,
//                     tokenAddress: poolConfig.token1.address,
//                     tokenSymbol: poolConfig.token1.coingeckoId!,
//                     tokenName: poolConfig.token1.coingeckoId!,
//                     tokenType: 'erc20' as const
//                 },
//                 poolAddress: poolConfig.lpToken.address,
//             }
//         }
//     })
// }