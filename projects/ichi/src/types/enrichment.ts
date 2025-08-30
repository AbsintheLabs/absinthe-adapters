// Enrichment pipeline type definitions

import { RedisClientType } from 'redis';
import {
  TimeWeightedBalanceEvent,
  MessageType,
  Currency,
  TimeWindowTrigger,
  Chain,
} from '@absinthe/common';
import { MetadataCache, PriceCacheTS, HandlerMetadataCache } from './pricing';

// ------------------------------------------------------------
// RAW OBJECTS (from engine before enrichment)
// ------------------------------------------------------------

export interface RawBalanceWindow {
  user: string;
  asset: string;
  startTs: number;
  endTs: number;
  startBlockNumber: number;
  contractAddress: string;
  endBlockNumber: number;
  base?: BaseEnrichedFields;
  trigger: 'BALANCE_CHANGE' | 'EXHAUSTED' | 'FINAL';
  balanceBefore?: string;
  balanceAfter?: string;
  balance?: string;
  prevTxHash?: string | null;
  txHash?: string | null;
  valueUsd?: number;
}

export interface RawEvent {
  user: string;
  asset: string;
  amount: string;
  meta?: Record<string, any>;
  ts: number;
  contractAddress: string;
  height: number;
  txHash: string;
  blockNumber: number;
  blockHash: string;
  logIndex?: number;
  gasUsed?: string;
  gasPrice?: string;
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
  chainConfig: any;
  absintheApiKey: string;
  indexerId: string;
}

// ------------------------------------------------------------
// ENRICHER FUNCTION TYPES
// ------------------------------------------------------------

export type Enricher<TInput = any, TOutput = any> = (
  items: TInput[],
  context: EnrichmentContext,
) => Promise<TOutput[]>;

export type WindowEnricher = Enricher<RawBalanceWindow, any>;
export type EventEnricher = Enricher<RawEvent, any>;

// ------------------------------------------------------------
// INTERMEDIATE ENRICHED OBJECTS
// ------------------------------------------------------------

export interface BaseEnrichedFields {
  base: {
    version: string;
    eventId: string;
    userId: string;
    currency: Currency;
    protocolName: string;
    protocolType: string;
    contractAddress: string;
    chain: Chain;
    //todo:  we have them optional because we are building in different enrichers, fix it to build in a single enricher
    protocolMetadata?: { [key: string]: { value: string; type: 'number' | 'string' } };
    runner?: {
      runnerId: string;
      apiKeyHash: string;
    };
    valueUsd?: number;
  };
}

export interface EnrichedBalanceWindow extends BaseEnrichedFields {
  // Raw fields
  user: string;
  asset: string;
  startTs: number;
  endTs: number;
  startBlockNumber: number;
  endBlockNumber: number;
  trigger: 'BALANCE_CHANGE' | 'EXHAUSTED' | 'FINAL';
  balanceBefore: string;
  balanceAfter: string;
  balance: string;
  prevTxHash: string | null;
  txHash: string | null;

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

export interface EnrichedEvent extends BaseEnrichedFields {
  // Raw fields
  user: string;
  asset: string;
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
  valueUsd: number;
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
export type EventPipeline = EnrichmentPipeline<RawEvent, PricedEvent>;
