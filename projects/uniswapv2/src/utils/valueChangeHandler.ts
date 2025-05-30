import { EventType, SimpleTimeWeightedBalance, ZERO_ADDRESS } from "@absinthe/common";
import { ValueChangeArgs } from "@absinthe/common";

// todo: add txhash to storage somewhere here
//(resolved as we would send this to kafka) @andrew
export function processValueChange({
    assetAddress,
    from,
    to,
    amount,
    usdValue,
    blockTimestamp,
    txHash,
    blockHeight,
    windowDurationMs,
    activeBalances,
}: ValueChangeArgs): SimpleTimeWeightedBalance[] {
    const historyWindows: SimpleTimeWeightedBalance[] = []
    function snapshotAndUpdate(userAddress: string, updatedAmount: bigint) {
        const prev = activeBalances.get(userAddress) ?? { 
            balance: 0n, 
            updated_at_block_ts: blockTimestamp, 
            updated_at_block_height: blockHeight 
        }
      
        // record the holding window up to now
        if (prev.balance > 0n) {
            const windowId = Math.floor(prev.updated_at_block_ts / windowDurationMs)
            const currentWindowId = Math.floor(blockTimestamp / windowDurationMs)
            //todo: discuss with andrew
            const windowDuration = blockTimestamp - prev.updated_at_block_ts

            historyWindows.push({
                user: userAddress,
                amount: usdValue,
                timeWindow: {
                    trigger: EventType.TRANSFER,
                    startTs: prev.updated_at_block_ts,
                    endTs: blockTimestamp,
                    startBlocknumber: BigInt(prev.updated_at_block_height),
                    endBlocknumber: BigInt(blockHeight),
                    txHash: txHash,
                    windowDurationMs: windowDurationMs, // todo: discuss with andrew
                    windowId: windowId
                },
                protocolMetadata: {
                    poolAddress: assetAddress,
                    lpTokenAmount: prev.balance
                }
            })
        }
        
        activeBalances.set(userAddress, {
            balance: prev.balance + updatedAmount,
            updated_at_block_ts: blockTimestamp,
            updated_at_block_height: blockHeight,
        })
    }

    // if tokens left a user, subtract, but ignore zero address
    if (from && from !== ZERO_ADDRESS) {
        snapshotAndUpdate(from, -amount)
    }
    // if tokens reached a user, add, but ignore zero address
    if (to && to !== ZERO_ADDRESS) {
        snapshotAndUpdate(to, amount)
    }
    return historyWindows;
}