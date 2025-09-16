// import { Currency, MessageType, TimeWindowTrigger } from '@absinthe/common';
// import {
//     ActionEnricher,
//     WindowEnricher,
//     EnrichmentContext,
//     EnrichedEvent,
//     EnrichedBalanceWindow,
//     RawMeasureWindow,
//     EnrichedMeasureWindow
// } from '../../types/enrichment';

// /**
//  * Builds enriched transaction events from raw actions
//  */
// export const buildActionEvents: ActionEnricher = async (events, context) => {
//     return events.map((e) => ({
//         ...e,
//         eventType: MessageType.TRANSACTION,
//         asset: e.asset,
//         rawAmount: e.amount,
//         priceable: e.priceable,
//         // fixme: figure out what this should be (perhaps in the decimals step?)
//         // displayAmount: Number(e.amount),
//         unixTimestampMs: e.ts,
//         txHash: e.txHash,
//         logIndex: e.logIndex,
//         blockNumber: e.height,
//         blockHash: e.blockHash,
//         gasUsed: e.gasUsed,
//         // fixme: figure out what this should be (perhaps in the pricing step?)
//         // gasFeeUsd: e.gasFeeUsd,
//         currency: Currency.USD,
//         base: (e as any).base,
//     })) as EnrichedEvent[];
// };

// /**
//  * Builds time-weighted balance events from raw balance windows
//  */
// export const buildTimeWeightedBalanceEvents: WindowEnricher = async (windows, context) => {
//     return windows.map(
//         (w) =>
//             ({
//                 ...w,
//                 eventType: MessageType.TIME_WEIGHTED_BALANCE,
//                 balanceBefore: w?.balanceBefore || w?.balance || null,
//                 balanceAfter: w?.balanceAfter || w?.balance || null,
//                 timeWindowTrigger:
//                     w.trigger === 'BALANCE_DELTA' //fixme: make this consistent across everywhere
//                         ? TimeWindowTrigger.TRANSFER
//                         : // : w.trigger === 'INACTIVE_POSITION'
//                         // ? TimeWindowTrigger.INACTIVE_POSITION
//                         TimeWindowTrigger.EXHAUSTED,
//                 startUnixTimestampMs: w.startTs,
//                 endUnixTimestampMs: w.endTs,
//                 windowDurationMs: w.endTs - w.startTs,
//                 startBlockNumber: w?.startBlockNumber || null, // not available for exhausted events
//                 endBlockNumber: w?.endBlockNumber || null, // not available for exhausted events
//                 prevTxHash: w?.prevTxHash || null, // WILL be available for exhausted event
//                 txHash: w?.txHash || null, // txHash will not be available for exhausted events
//                 // WARN: REMOVE ME! THIS IS A DEBUGGING STEP!
//                 startReadable: new Date(w.startTs).toLocaleString(),
//                 endReadable: new Date(w.endTs).toLocaleString(),
//             }) as EnrichedBalanceWindow,
//     );
// };

// /**
//  * Builds time-weighted measure events from raw measure windows
//  */
// export const buildTimeWeightedMeasureEvents = async (
//     windows: RawMeasureWindow[],
//     context: EnrichmentContext,
// ): Promise<EnrichedMeasureWindow[]> => {
//     return windows.map(
//         (w) =>
//             ({
//                 ...w,
//                 eventType: MessageType.TIME_WEIGHTED_BALANCE, // TODO: Use TIME_WEIGHTED_MEASURE when available
//                 measureBefore: w?.measureBefore || w?.measure || null,
//                 measureAfter: w?.measureAfter || w?.measure || null,
//                 timeWindowTrigger:
//                     w.trigger === 'MEASURE_CHANGE' ? TimeWindowTrigger.TRANSFER : TimeWindowTrigger.EXHAUSTED,
//                 startUnixTimestampMs: w.startTs,
//                 endUnixTimestampMs: w.endTs,
//                 windowDurationMs: w.endTs - w.startTs,
//                 startBlockNumber: w?.startBlockNumber || null,
//                 endBlockNumber: w?.endBlockNumber || null,
//                 prevTxHash: w?.prevTxHash || null,
//                 txHash: w?.txHash || null,
//                 startReadable: new Date(w.startTs).toLocaleString(),
//                 endReadable: new Date(w.endTs).toLocaleString(),
//             }) as EnrichedMeasureWindow,
//     );
// };
