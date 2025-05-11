import { SimpleHistoryWindow, SimpleTransaction, TimeWeightedBalance, TimeWindow, Transaction, UniswapV2SwapMetadata, UniswapV2TWBMetadata } from "../interfaces";

export function toTimeWeightedBalance(
    simpleHistoryWindows: SimpleHistoryWindow[],
    WINDOW_DURATION_MS: number,
    poolAddress?: string
): TimeWeightedBalance<UniswapV2TWBMetadata>[] {
    return simpleHistoryWindows.map((e) => {
        const trigger = e.trigger === 'exhausted' ? 'exhausted' as const : 'transfer' as const;
        const windowId = Math.floor(e.ts_start / WINDOW_DURATION_MS);

        // Create appropriate timeWindow based on trigger type
        const baseTimeWindow = {
            startTs: e.ts_start,
            endTs: e.ts_end,
            windowDurationMs: WINDOW_DURATION_MS,
            windowId,
        };

        // Add block numbers for transfer triggers
        const timeWindow: TimeWindow = trigger === 'transfer'
            ? {
                ...baseTimeWindow,
                trigger,
                startBlocknumber: BigInt(e.block_start || 0),
                endBlocknumber: BigInt(e.block_end || 0),
                txHash: e.txHash || ''
            }
            : {
                ...baseTimeWindow,
                trigger
            };

        return {
            version: 1 as const,
            dataType: 'time_weighted_balance' as const,
            user: e.userAddress,
            // todo: pass this in rather than hardcoding
            chain: { networkId: 1, name: 'mainnet', chainType: 'evm' as const },
            value: Number(e.usdValue),
            timeWindow,
            protocolMetadata: {
                poolAddress: poolAddress || e.assetAddress,
                lpTokenAmount: e.balance,
            },
        };
    })
}

export function toTransaction(simpleTransactions: SimpleTransaction[]): Transaction<UniswapV2SwapMetadata>[] {
    // return simpleTransactions.map((e) => {
    // return {
    //     version: 1 as const,
    //     dataType: 'transaction' as const,
    //     user: e.userAddress,
    //     chain: { networkId: 1, name: 'mainnet', chainType: 'evm' as const },
    //     value: e.usdValue,
    //     timestampMs: e.timestampMs,
    //     blockNumber: e.blockNumber,
    //     txHash: e.txHash,
    //     logIndex: e.logIndex,
    //     source: {
    //         sourceId: `${e.txHash}-${e.logIndex}`,
    //         chainId: 1,
    //         protocolName: 'uniswap',
    //         poolAddress: e.assetAddress,
    //     },
    //     protocolMetadata: {
    //         poolAddress: e.assetAddress,
    //         token0: e.token0,
    //         token1: e.token1,
    //         token0Amount: e.token0Amount,
    //         token1Amount: e.token1Amount,
    //     }
    // }
    // })
    return [];
}