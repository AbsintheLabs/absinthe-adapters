import { Currency, MessageType, TimeWeightedBalanceEvent, TimeWindowTrigger } from "@absinthe/common";

type Enricher = (windows: any[], context: any) => Promise<any[]>;

// Simple pipe runner
export const pipeline = (...enrichers: Enricher[]) =>
    async (windows: any[], context: any) => {
        let result = windows;
        for (const enricher of enrichers) {
            result = await enricher(result, context);
        }
        return result;
    };

export const enrichWithCommonBaseEventFields: Enricher = async (windows, context) => {
    return windows.map(w => ({
        ...w,
        base: {
            version: '1.0.0',
            eventId: '', // fixme: figure out how we do it in the other adapters
            userId: w.user,
            currency: Currency.USD,
        }
    }));
};

export const enrichWithRunnerInfo: Enricher = async (windows, context) => {
    return windows.map(w => ({
        ...w,
        base: {
            ...w.base,
            runner: {
                runnerId: '1',
                apiKeyHash: '1',
            }
        }
    }));
};

export const buildTimeWeightedBalanceEvents: Enricher = async (windows, context) => {
    return windows.map(w => ({
        ...w,
        eventType: MessageType.TIME_WEIGHTED_BALANCE,
        balanceBefore: w?.balanceBefore || w?.balance || null,
        balanceAfter: w?.balanceAfter || w?.balance || null,
        timeWindowTrigger: w.trigger === 'BALANCE_CHANGE' ? //fixme: make this consistent across everywhere
            TimeWindowTrigger.TRANSFER :
            TimeWindowTrigger.EXHAUSTED,
        startUnixTimestampMs: w.startTs,
        endUnixTimestampMs: w.endTs,
        windowDurationMs: w.endTs - w.startTs,
        startBlockNumber: w?.startBlockNumber || null, // not available for exhausted events
        endBlockNumber: w?.endBlockNumber || null, // not available for exhausted events
        txHash: w?.txHash || null, // txHash will not be available for exhausted events
    } as TimeWeightedBalanceEvent));
};

export const enrichWithPrice: Enricher = async (windows, context) => {
    // todo: automatically average the prices over the durations, this way we automatically get
    // todo: one row during backfills rather than a row for each window
    return windows;
};