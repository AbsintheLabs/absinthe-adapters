// Enrichment pipeline type definitions

import { RedisClientType } from 'redis';
// xxx: move these to the types folder so they can be re-used in other places
type MessageType =
  'transaction' |
  'timeWeightedBalance';
type Currency = 'usd' | 'eth';
type TimeWindowTrigger =
  'balance_delta' |
  'position_update' |
  'exhausted' |
  'final' |
  'inactive_position';

import { MetadataCache, PriceCacheTS, HandlerMetadataCache } from './pricing';
import { Activity } from './core';
import { BalanceDeltaReason } from './adapter';

// NEW TYPES (much better approach)
export type ScalarEnricher<I, O> = (item: I, ctx: EnrichmentContext) => Promise<O>;

/*
each enricher is stateless and operates on a single item at a time so it's very easy to reason about and test.
also, the json object will be completely flat so that we can easily add new fields and not couple the enrichers to the data shape that they're enriching.
In theory, I could have a separate function for each field of the runner metadata, and I can compose all of them together without them knowing about each other
  - (aka: they can be called in any order, or not called at all)

- Fortunately, none of the enrichers actually truly depend on each other. We can colocate the code so that there are really no dependencies
   - The only true dependencies is making sure that the fields from the raw object is present before we can operate on them

how many enrichers do we need?
- runner metadata (purely stateless)
- pricing
  - price debug info
  - valueUsd
  - priceMethodLeaf
  - valuationCurrency
- eventId
  - hashing function on all the data
  - relies on: tx_hash, block_number, log_index, user, asset, activity, key?
  - todo: decide the hashing function for 1) TWB and 2) Action
- metadataJson
  - flattens the json and makes sure that the json is valid and fits our structure
  - independent (only relies on protocolMetadata for the window to be present)
- config
  - config hash
  - adapter version
  - chain arch
  - chainId
  - chainShortName
  - relies on: config being present to access those fields

TWB:
- windowing calculations
  - relies on: startTs, endTs, startHeight, endHeight, startTxRef, endTxRef, logIndex, rawBefore, rawAfter, gasUsed, effectiveGasPrice
  - formats the fields + computes deltas
- quantity
  - quantity
  - quantityBasis


// todo: next steps: go back and finalize the data shape that we'll get from evm from the raw balance window in engine and then we can use those fields to incrementally build the final data shape
- step 2: don't build all the enrichers at once, build them incrementally
- step 3:
*/

// export class oldEnrichmentPipeline<TCurrentShape> {
//   private enrichers: ScalarEnricher<any, any>[] = [];
//   then<TOutput>(
//     enricher: ScalarEnricher<TCurrentShape, TOutput>
//   ): EnrichmentPipeline<TOutput> {
//     return new EnrichmentPipeline<TOutput>([...this.enrichers, enricher]);
//   }
//   andAlso<TAdditional>(
//     enricher: ScalarEnricher<TCurrentShape, TAdditional>
//   ): EnrichmentPipeline<TCurrentShape & TAdditional> {
//     // For andAlso, we need to merge the result
//     const mergeEnricher: ScalarEnricher<TCurrentShape, TCurrentShape & TAdditional> =
//       async (item, context) => {
//         const additional = await enricher(item, context);
//         return { ...item, ...additional };
//       };

//     return new EnrichmentPipeline<TCurrentShape & TAdditional>([...this.enrichers, mergeEnricher]);
//   }
//   async execute(items: TCurrentShape[], context: EnrichmentContext): Promise<TCurrentShape[]> {
//     // Apply the pipeline to each item
//     return Promise.all(
//       items.map(async item => {
//         let currentItem = item;
//         for (const enricher of this.enrichers) {
//           currentItem = await enricher(currentItem, context);
//         }
//         return currentItem;
//       })
//     );
//   }
// }

// ------------------------------------------------------------
// RAW OBJECTS (from engine before enrichment)
// ------------------------------------------------------------

export interface RawBalanceWindow {
  user: string;
  asset: string;
  activity: Activity;
  startTs: number;
  endTs: number;
  startHeight: number;
  endHeight?: number;
  trigger: BalanceDeltaReason;
  rawBefore: string;
  rawAfter?: string;
  startTxRef: string | null;
  endTxRef?: string | null;
  logIndex?: number;
  meta?: Record<string, any>;
}

export interface RawMeasureWindow {
  user: string;
  asset: string;
  metric: string;
  startTs: number;
  endTs: number;
  startBlockNumber: number;
  endBlockNumber: number;
  trigger: 'MEASURE_CHANGE' | 'EXHAUSTED' | 'FINAL';
  measureBefore?: string;
  measureAfter?: string;
  measure?: string;
  prevTxHash?: string | null;
  txHash?: string | null;
}

export interface RawAction {
  key: string;
  user: string;
  priceable: boolean;
  asset?: string;
  amount?: string;
  meta?: Record<string, any>;
  ts: number;
  height: number;
  txHash: string;
  blockNumber: number;
  blockHash: string;
  logIndex?: number;
  gasUsed?: string;
  gasPrice?: string;
  // role?: ActionRole;
  from?: string;
  to?: string;
}

// ------------------------------------------------------------
// ENRICHMENT CONTEXT
// ------------------------------------------------------------

export interface EnrichmentContext {
  priceCache: PriceCacheTS;
  metadataCache: MetadataCache;
  handlerMetadataCache: HandlerMetadataCache;
  redis: RedisClientType;
}

// ------------------------------------------------------------
// ENRICHER FUNCTION TYPES
// ------------------------------------------------------------

export type Enricher<TInput = any, TOutput = any> = (
  items: TInput[],
  context: EnrichmentContext,
) => Promise<TOutput[]>;

export type WindowEnricher = Enricher<RawBalanceWindow, any>;
export type MeasureWindowEnricher = Enricher<RawMeasureWindow, any>;
export type ActionEnricher = Enricher<RawAction>;

// ------------------------------------------------------------
// INTERMEDIATE ENRICHED OBJECTS
// ------------------------------------------------------------

export interface BaseEnrichedFields {
  base: {
    version: string;
    eventId: string;
    userId: string;
    currency: Currency;
    protocolMetadata?: Record<string, { value: string; type: 'number' | 'string' }>;
    runner?: {
      runnerId: string;
      apiKeyHash: string;
    };
  };
}

export interface EnrichedBalanceWindow extends BaseEnrichedFields {
  // Raw fields
  user: string;
  asset: string;
  activity: Activity;
  startTs: number;
  endTs: number;
  startHeight: number;
  endHeight: number;
  trigger: 'BALANCE_DELTA' | 'POSITION_UPDATE' | 'EXHAUSTED' | 'FINAL' | 'INACTIVE_POSITION';
  rawBefore?: string;
  rawAfter?: string;
  balance?: string;
  startTxRef?: string | null;
  endTxRef?: string | null;
  logIndex?: number;
  meta?: Record<string, any>;

  // Enriched fields
  eventType: 'timeWeightedBalance';
  timeWindowTrigger: TimeWindowTrigger;
  startUnixTimestampMs: number;
  endUnixTimestampMs: number;
  windowDurationMs: number;

  // Debug fields
  startReadable: string;
  endReadable: string;
}

export interface EnrichedMeasureWindow extends BaseEnrichedFields {
  // Raw fields
  user: string;
  asset: string;
  metric: string;
  startTs: number;
  endTs: number;
  startBlockNumber: number;
  endBlockNumber: number;
  trigger: 'MEASURE_CHANGE' | 'EXHAUSTED' | 'FINAL';
  measureBefore?: string;
  measureAfter?: string;
  measure?: string;
  prevTxHash?: string | null;
  txHash?: string | null;

  // Enriched fields
  eventType: 'timeWeightedBalance';
  timeWindowTrigger: TimeWindowTrigger;
  startUnixTimestampMs: number;
  endUnixTimestampMs: number;
  windowDurationMs: number;

  // Debug fields
  startReadable: string;
  endReadable: string;
}

export interface EnrichedEvent extends BaseEnrichedFields {
  // Raw fields
  user: string;
  asset?: string;
  amount: string;
  meta?: Record<string, any>;
  ts: number;
  height: number;
  txHash: string;
  blockNumber: number;
  blockHash: string;
  gasUsed?: string;
  gasPrice?: string;
  from?: string;
  to?: string;

  // Enriched fields
  eventType: 'transaction';
  rawAmount: string;
  unixTimestampMs: number;
  logIndex?: number;
  currency: Currency;
}

// ------------------------------------------------------------
// FINAL ENRICHED OBJECTS (with pricing)
// ------------------------------------------------------------

export interface PricedBalanceWindow extends EnrichedBalanceWindow {
  valueUsd: number | null;
  totalPosition: number | null;
}

export interface PricedMeasureWindow extends EnrichedMeasureWindow {
  valueUsd: number | null;
  totalPosition: number | null;
}

export interface PricedEvent extends EnrichedEvent {
  displayAmount?: number;
  gasFeeUsd?: number;
  valueUsd?: number;
}

// ------------------------------------------------------------
// PIPELINE FUNCTION TYPES
// ------------------------------------------------------------

// export type EnrichmentPipeline<TInput, TOutput> = (
//   ...enrichers: Enricher<any, any>[]
// ) => (items: TInput[], context: EnrichmentContext) => Promise<TOutput[]>;

// export type WindowPipeline = EnrichmentPipeline<RawBalanceWindow, PricedBalanceWindow>;
// export type MeasureWindowPipeline = EnrichmentPipeline<RawMeasureWindow, PricedMeasureWindow>;
// export type EventPipeline = EnrichmentPipeline<RawAction, PricedEvent>;
