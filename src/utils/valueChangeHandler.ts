import { ActiveBalance, HistoryWindow } from "../main";

interface ValueChangeArgs {
    assetAddress: string      // token / contract address or identifier
    from?: string             // user sending tokens (omit or undefined for “mint”)
    to?: string               // user receiving tokens (omit or undefined for “burn”)
    amount: bigint            // positive amount moved
    usdValue: number          // value of the amount in USD
    blockTimestamp: number       // for windowing
    txHash?: string
    blockHeight: number
    // activeBalances: Map<string, Map<string, ActiveBalance>>
    activeBalances: Map<string, ActiveBalance>
    historyWindows: HistoryWindow[]
}

// todo: add txhash to storage somewhere here
export function processValueChange({
    assetAddress,
    from,
    to,
    amount,
    usdValue,
    blockTimestamp,
    txHash,
    blockHeight,
    activeBalances,
    historyWindows,
}: ValueChangeArgs) {
    // ensure we have a per-asset map
    // let userMap = activeBalances.get(assetAddress)
    // if (!userMap) {
    //     userMap = new Map<string, ActiveBalance>()
    //     activeBalances.set(assetAddress, userMap)
    // }

    // helper to snapshot & update one side (either “from” or “to”)
    function snapshotAndUpdate(user: string, delta: bigint) {
        // const prev = userMap!.get(user) ?? { balance: 0n, updated_at_block_ts: blockTimestamp, updated_at_block_height: blockHeight }
        const prev = activeBalances.get(user) ?? { balance: 0n, updated_at_block_ts: blockTimestamp, updated_at_block_height: blockHeight }
        // record the holding window up to now
        if (prev.balance > 0n) {
            historyWindows.push({
                userAddress: user,
                assetAddress,
                balance: prev.balance,
                usdValue,
                ts_start: prev.updated_at_block_ts,
                ts_end: blockTimestamp,
                block_start: prev.updated_at_block_height,
                block_end: blockHeight,
                trigger: 'transfer'
            })
        }
        // apply the change
        // userMap!.set(user, {
        activeBalances.set(user, {
            balance: prev.balance + delta,
            updated_at_block_ts: blockTimestamp,
            updated_at_block_height: blockHeight,
        })
    }

    // if tokens left a user, subtract
    if (from) {
        snapshotAndUpdate(from, -amount)
    }
    // if tokens reached a user, add
    if (to) {
        snapshotAndUpdate(to, amount)
    }
}