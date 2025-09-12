// Enrichment pipeline type definitions

import { RedisClientType } from 'redis';
import { MessageType, Currency, TimeWindowTrigger } from '@absinthe/common';
import { MetadataCache, PriceCacheTS, HandlerMetadataCache } from './pricing';
import { Activity } from './core';
import { BalanceDeltaReason } from './adapter';

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
export type ActionEnricher = Enricher<RawAction, any>;

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
  eventType: MessageType.TIME_WEIGHTED_BALANCE;
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
  eventType: MessageType.TIME_WEIGHTED_BALANCE; // TODO: Use TIME_WEIGHTED_MEASURE when available
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
  eventType: MessageType.TRANSACTION;
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

export type EnrichmentPipeline<TInput, TOutput> = (
  ...enrichers: Enricher<any, any>[]
) => (items: TInput[], context: EnrichmentContext) => Promise<TOutput[]>;

export type WindowPipeline = EnrichmentPipeline<RawBalanceWindow, PricedBalanceWindow>;
export type MeasureWindowPipeline = EnrichmentPipeline<RawMeasureWindow, PricedMeasureWindow>;
export type EventPipeline = EnrichmentPipeline<RawAction, PricedEvent>;
