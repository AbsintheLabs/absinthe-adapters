// Adapter interface and related types

import { BalanceDelta, PositionToggle, OnChainEvent, OnChainTransaction } from './core';
import { AssetFeedConfig } from './pricing';

// ------------------------------------------------------------
// ADAPTER INTERFACE
// ------------------------------------------------------------

// Adapter interface (you implement this per protocol)
export interface Adapter {
  onLog?(
    // todo: tighten up the types here
    block: any,
    log: any,
    emit: {
      balanceDelta: (e: BalanceDelta) => Promise<void>;
      positionToggle: (e: PositionToggle) => Promise<void>;
      event: (e: OnChainEvent) => Promise<void>;
      // fixme: figure out how we can also do event based re-pricing, rather than just pricing on a schedule
      // reprice: (e: RepriceEvent) => Promise<void>;
      // add more here as scope grows
    },
  ): Promise<void>;
  // note: transaction tracking only supports event-based tracking, not time-weighted
  onTransaction?(
    block: any,
    transaction: any,
    emit: {
      event: (e: OnChainTransaction) => Promise<void>;
    },
  ): Promise<void>;
  // priceFeeds?: FeedSelector[];
  // priceAsset?: (timestampMs: number, asset: string, redis: RedisClientType) => Promise<number>;
  feedConfig: AssetFeedConfig;
}
