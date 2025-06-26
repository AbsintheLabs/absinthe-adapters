import { SwapData } from '../utils/interfaces/interfaces';

/* eslint-disable prettier/prettier */
class PositionTracker {
    // Activate Position - START TRACKING (don't flush)
    private async activatePosition(positionKey: string, swapData: SwapData) {
        const position = this.positions.get(positionKey);
        if (!position) return;

        position.isActive = true;
        position.isTracked = true;
        position.lastUpdated = Date.now();

        // Initialize active balance tracking
        this.activeBalances.set(positionKey, {
            balance: position.liquidity,
            updatedBlockTs: swapData.blockTimestamp,
            updatedBlockHeight: swapData.blockHeight,
        });

        // ✅ DON'T flush to API - just start tracking
        console.log(`Started tracking position ${positionKey} at tick ${swapData.tick}`);
    }

    // Deactivate Position - STOP TRACKING (flush final balance)
    private async deactivatePosition(positionKey: string, swapData: SwapData) {
        const position = this.positions.get(positionKey);
        if (!position) return;

        // ✅ Flush final balance before deactivation
        await this.flushPositionToAPI(position, swapData, 'DEACTIVATION');

        position.isActive = false;
        position.isTracked = false;
        position.lastUpdated = Date.now();

        // Remove from active tracking
        this.activeBalances.delete(positionKey);

        console.log(`Stopped tracking position ${positionKey} at tick ${swapData.tick}`);
    }

    // Handle Increase Liquidity - FLUSH IF ACTIVE
    async handleIncreaseLiquidity(ctx: ContextWithEntityManager, data: IncreaseData) {
        const positionKey = this.findPositionKey(data.tokenId);
        const position = this.positions.get(positionKey);

        if (!position) return;

        const oldLiquidity = position.liquidity;
        position.liquidity += data.liquidity;
        position.lastUpdated = Date.now();

        // ✅ Only flush if position is active and tracked
        if (position.isActive && position.isTracked) {
            await this.flushLiquidityChange(position, oldLiquidity, data, 'INCREASE_LIQUIDITY');
        }
    }

    // Handle Decrease Liquidity - FLUSH IF ACTIVE
    async handleDecreaseLiquidity(ctx: ContextWithEntityManager, data: DecreaseData) {
        const positionKey = this.findPositionKey(data.tokenId);
        const position = this.positions.get(positionKey);

        if (!position) return;

        const oldLiquidity = position.liquidity;
        position.liquidity -= data.liquidity;
        position.lastUpdated = Date.now();

        // ✅ Only flush if position is active and tracked
        if (position.isActive && position.isTracked) {
            await this.flushLiquidityChange(position, oldLiquidity, data, 'DECREASE_LIQUIDITY');
        }
    }

    // Handle Transfer - FLUSH IF ACTIVE
    async handleTransfer(ctx: ContextWithEntityManager, data: TransferData) {
        const positionKey = this.findPositionKey(data.tokenId);
        const position = this.positions.get(positionKey);

        if (!position) return;

        // ✅ Only flush if position is active and tracked
        if (position.isActive && position.isTracked) {
            await this.flushTransfer(position, data);
        }

        // Update owner
        position.owner = data.to;
        position.lastUpdated = Date.now();
    }

    // Handle Swap - CHECK ACTIVATION/DEACTIVATION
    async handleSwap(ctx: ContextWithEntityManager, data: SwapData) {
        const currentTick = data.tick;
        // Check all positions in this pool for activation/deactivation
        for (const [positionKey, position] of this.positions) {
            if (position.poolId === data.poolId) {
                const wasActive = position.isActive;
                const isNowActive = position.tickLower <= currentTick && position.tickUpper > currentTick;

                if (!wasActive && isNowActive) {
                    // Position just became active - start tracking
                    await this.activatePosition(positionKey, data);
                } else if (wasActive && !isNowActive) {
                    // Position just became inactive - stop tracking and flush
                    await this.deactivatePosition(positionKey, data);
                }

                // ✅ If position is active, update current tick for future reference
                if (position.isActive) {
                    position.currentTick = currentTick;
                }
            }
        }
    }

    // Flush Position to API - ONLY CALLED ON EVENTS
    private async flushPositionToAPI(position: PositionState, eventData: any, trigger: string) {
        const activeBalance = this.activeBalances.get(position.tokenId);
        if (!activeBalance) return;

        const historyWindow = {
            userAddress: position.owner,
            deltaAmount: 0, // No change for deactivation
            trigger: TimeWindowTrigger.TRANSFER,
            startTs: activeBalance.updatedBlockTs,
            endTs: eventData.blockTimestamp,
            startBlockNumber: activeBalance.updatedBlockHeight,
            endBlockNumber: eventData.blockHeight,
            txHash: eventData.transaction.hash,
            windowDurationMs: WINDOW_DURATION_MS,
            valueUsd: 0, // Calculate based on position value
            balanceBefore: activeBalance.balance.toString(),
            balanceAfter: position.liquidity.toString(),
            currency: Currency.USD,
            extras: {
                tickUpper: position.tickUpper,
                tickLower: position.tickLower,
                currentTick: eventData.tick,
                poolId: position.poolId,
                trigger: trigger,
            },
        };

        // Send to API
        await this.apiClient.sendTimeWeightedBalance([historyWindow]);

        console.log(`Flushed position ${position.tokenId} due to ${trigger}`);
    }

    // Flush Liquidity Change - ONLY CALLED ON INCREASE/DECREASE
    private async flushLiquidityChange(
        position: PositionState,
        oldLiquidity: bigint,
        eventData: any,
        trigger: string,
    ) {
        const activeBalance = this.activeBalances.get(position.tokenId);
        if (!activeBalance) return;

        const historyWindow = {
            userAddress: position.owner,
            deltaAmount: Number(position.liquidity - oldLiquidity),
            trigger: TimeWindowTrigger.TRANSFER,
            startTs: activeBalance.updatedBlockTs,
            endTs: eventData.blockTimestamp,
            startBlockNumber: activeBalance.updatedBlockHeight,
            endBlockNumber: eventData.blockHeight,
            txHash: eventData.transaction.hash,
            windowDurationMs: WINDOW_DURATION_MS,
            valueUsd: 0, // Calculate based on position value
            balanceBefore: oldLiquidity.toString(),
            balanceAfter: position.liquidity.toString(),
            currency: Currency.USD,
            extras: {
                tickUpper: position.tickUpper,
                tickLower: position.tickLower,
                currentTick: eventData.tick,
                poolId: position.poolId,
                trigger: trigger,
            },
        };

        // Update active balance
        activeBalance.balance = position.liquidity;
        activeBalance.updatedBlockTs = eventData.blockTimestamp;
        activeBalance.updatedBlockHeight = eventData.blockHeight;

        // Send to API
        await this.apiClient.sendTimeWeightedBalance([historyWindow]);

        console.log(
            `Flushed liquidity change for position ${position.tokenId}: ${oldLiquidity} -> ${position.liquidity}`,
        );
    }
}
