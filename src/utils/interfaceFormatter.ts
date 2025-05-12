import { SimpleTimeWeightedBalance, SimpleTransaction, TimeWeightedBalance, TimeWindow, Transaction, UniswapV2SwapMetadata, UniswapV2TWBMetadata } from "../interfaces";
import { PoolConfig } from "../model";
import { ValidatedEnv } from "./validateEnv";
export function toTimeWeightedBalance(
    simpleTimeWeightedBalances: SimpleTimeWeightedBalance[],
    env: ValidatedEnv,
    poolConfig: PoolConfig
): TimeWeightedBalance<UniswapV2TWBMetadata>[] {
    return simpleTimeWeightedBalances.map((e) => {
        return {
            version: 1 as const,
            dataType: 'time_weighted_balance' as const,
            user: e.user,
            // todo: pass this in rather than hardcoding
            chain: { networkId: env.chainId, name: 'ethereum' as const, chainType: 'evm' as const },
            value: e.value,
            timeWindow: e.timeWindow,
            protocolMetadata: {
                poolAddress: poolConfig.lpToken.address,
                lpTokenAmount: e.protocolMetadata!.lpTokenAmount!
            },
        };
    })
}

export function toTransaction(simpleTransactions: SimpleTransaction[], env: ValidatedEnv, poolConfig: PoolConfig): Transaction<UniswapV2SwapMetadata>[] {
    return simpleTransactions.map((e) => {
        return {
            version: 1 as const,
            dataType: 'transaction' as const,
            user: e.user,
            value: e.value,
            timestampMs: e.timestampMs,
            blockNumber: e.blockNumber,
            txHash: e.txHash,
            logIndex: e.logIndex,
            // todo: pass this in rather than hardcoding
            chain: { networkId: env.chainId, name: 'ethereum' as const, chainType: 'evm' as const },
            protocolMetadata: {
                token0Amount: e.protocolMetadata!.token0Amount!,
                token1Amount: e.protocolMetadata!.token1Amount!,
                token0: {
                    decimals: poolConfig.token0.decimals,
                    tokenAddress: poolConfig.token0.address,
                    tokenName: env.token0CoingeckoId, // bug: this is currently not correct
                    tokenSymbol: env.token0CoingeckoId, // bug: this is currently not correct
                    tokenType: 'erc20' as const
                },
                token1: {
                    decimals: poolConfig.token1.decimals,
                    tokenAddress: poolConfig.token1.address,
                    tokenSymbol: env.token1CoingeckoId, // bug: this is currently not correct
                    tokenName: env.token1CoingeckoId, // bug: this is currently not correct
                    tokenType: 'erc20' as const
                },
                poolAddress: poolConfig.lpToken.address,
            }
        }
    })
}