// Asset information interface
import { z } from 'zod';
import { ChainArch, ChainArchSchema } from '../config/schema.ts';
import { QuantityBasis } from '../enrichers/pricing/quantity-basis.ts';
import { Activity } from './core.ts';
import { QuantityType, QuantityTypeSchema } from './manifest.ts';
import { WINDOW_REASONS } from './adapter.ts';
import { AssetEnum } from './asset.ts';

// export interface AssetInfo {
//   asset: string; // EVM or Solana address
//   tokenId?: string; // OPTIONAL for NFTs
//   decimals: number;
//   assetType: AssetType; // Use the defined AssetType from schema
// }

export interface RunnerMeta {
  version: string; // schema version
  commitSha?: string; // commit hash of the runner
  configHash?: string; // hash of the runner config
  runnerId: string;
  apiKeyHash?: string;
}

export const CommonFieldsSchema = z.object({
  runner_commitSha: z.string().optional(),
  runner_apiKeyHash: z.string().optional(),
  runner_configHash: z.string(),
  runner_runnerId: z.string(),

  // Added by addAdapterProtocolMeta
  adapter_version: z.string(),
  protocol_name: z.string(), // Currently commented out

  // Added by addChainMetadata
  chainId: z.string(),
  chainShortName: z.string(),
  chainArch: ChainArchSchema,

  // Added by addQuantityBasis
  quantityBasis: z.enum(['none', 'count', 'monetary_value', 'asset_amount']),
  quantityType: QuantityTypeSchema,

  // Added by calculateQuantity
  quantity: z.number(),
  activity: z.string(), // Activity is a union with string fallback
});

export const AssetFieldsSchema = z.object({
  assetKey: z.string(),
  // tokenId: z.string().optional(),
  decimals: z.number(),
  // FIXME: this needs a bit of a better solution
  assetType: AssetEnum,
});

export const AssetFieldsSchemaOptional = AssetFieldsSchema.partial();

export const EnrichedWindowSchema = z
  .object({
    user: z.string(),
    // asset: z.string(),

    // window fields
    windowUtcStartTsMs: z.number(),
    // even if there is no end block, we still need to have an end ts
    windowUtcEndTsMs: z.number(),
    windowDurationMs: z.number(),
    startHeight: z.number(),
    // when exhausted, there is no end height
    endHeight: z.number().nullable(),
    startTxRef: z.string(),
    // when exhausted, there is no end tx ref
    endTxRef: z.string().nullable(),

    trigger: z.enum(WINDOW_REASONS),

    // fixme: make this DRY rather than hardcoding the name of this here
    eventType: z.literal('time_weighted_balance'),

    // raw position
    rawBefore: z.string(),
    rawAfter: z.string(),
    rawDelta: z.string(),

    // startTs: z.number(),
    // endTs: z.number(),
    startValue: z.string(),
    endValue: z.string(),
  })
  .extend(CommonFieldsSchema.shape)
  .extend(AssetFieldsSchema.shape); // required bc window is always a token_based

export type EnrichedWindow = z.infer<typeof EnrichedWindowSchema>;
/**
 * Zod schema for the final enriched action shape.
 * Single source of truth - both runtime validation and TypeScript type.
 *
 * .strip() automatically removes any extra fields not defined in the schema.
 * This means the pipeline can add temporary fields during enrichment,
 * and they'll be automatically cleaned up when parsed.
 */
export const EnrichedActionSchema = z
  .object({
    // Original RawAction fields
    key: z.string(),
    user: z.string(),
    ts: z.number(),
    height: z.number(),
    value: z.string(),
    txRef: z.string(),
    pricingHandlerId: z.string().optional(),
    ctx: z.record(z.string(), z.any()).optional(),

    // Added by addActionEventType
    eventType: z.literal('action'),

    // Added by addProtocolMetadata
    metadataJson: z.string().optional(),
  })
  .extend(CommonFieldsSchema.shape)
  .extend(AssetFieldsSchemaOptional.shape) // optional bc action can be non token-based
  .strip(); // Automatically remove extra fields

/**
 * Final enriched action type after all pipeline transformations.
 * Inferred directly from the Zod schema - single source of truth.
 */
export type EnrichedAction = z.infer<typeof EnrichedActionSchema>;

// FIXME: EVERYTHING BELOW THIS POINT IS DEPRECATED AND SHOULD BE REMOVED

// Common base interface for all events
export interface BaseEvent {
  // attribution
  user: string; // EVM address
  // asset: AssetInfo;

  // chain
  chainId: string; // Use string for JSON serialization compatibility
  chainShortName: string;
  chainArch: 'evm' | 'solana';

  // protocol metadata
  protocolName: string;
  protocolForkOf: string;

  // valuation
  valuationCurrency: 'usd' | 'eth';
  valueUsd: number | null;
  // priceSource: string;
  assetPriceUsd: number | null;

  // price debug info
  priceSampleCount: number;
  pricingMethodLeaf: string;
  // min: number;
  // max: number;
  // mean: number;
  // std: number;

  // time
  // priceStartTsMs: number;
  // priceEndTsMs: number;

  // priced position
  quantity: string; // most important field
  quantityBasis: string; // 'raw_units', 'scaled_units', 'monetary_value'

  // runner metadata
  version: string; // version of the base event
  eventId: string; // primary key

  runner_version: string;
  runner_commitSha?: string;
  runner_configHash?: string;
  runner_runnerId: string;
  runner_apiKeyHash?: string;

  // meta
  metadataJson: string; // json string
  eventType: 'action' | 'time_weighted_balance';
  activity: string; // 'swap', 'lend', 'borrow', 'repay', 'verify', 'stake', etc
  adapterVersion: string; // semver of adapter
}

// Time Weighted Balance Event
interface TimeWeightedBalanceEvent extends BaseEvent {
  eventType: 'time_weighted_balance';

  // window
  windowUtcStartTsMs: number; // timestamp in ms at utc time
  windowUtcEndTsMs: number; // timestamp in ms at utc time
  windowDurationMs: bigint; // duration of the window in ms

  // rename these to be both evm / solana compatible
  startHeight: bigint; // evm block number / solana slot
  endHeight?: bigint; // evm block number / solana slot
  startTxRef: string; // evm tx hash / solana tx hash
  endTxRef?: string; // evm tx hash / solana tx hash
  logIndex?: number;

  trigger: string; // 'balance_delta', 'position_update', etc

  // raw position
  rawBefore: string;
  rawAfter: string;
  rawDelta: string;

  // gas
  startTxGasUsed?: string;
  startTxEffectiveGasPrice?: string;
}

// Action Event (formerly Transaction)
interface ActionEvent extends BaseEvent {
  eventType: 'action';

  unixTimestampMs: number; // when the action occurred
  height: bigint;
  txRef: string; // evm tx hash / solana tx hash
  logIndex?: number;

  rawValue: string;

  // transaction metadata
  gasUsed?: number;
  effectiveGasPrice?: number;
}

/* SANITY CHECKS:
Actions:
1. Univ3 Swap
2. Demos Verification (contract call)
3. ERC721 Mint

TWB:
1. Holding number of erc20 tokens
2. Holding number of erc721 tokens
3. Univ2 Lp Position
4. Univ3 Lp Position
5. Aave Lending Position
6. Aave Borrowing Position

-- Now all of them in the same file. Can we make sense of the data when its all together?

Open Questions (in order of priority):
1. [x] protocolName and protocolForkOf are not provided when we're just tracking erc20.
2. [x] remove the 'kind' field from the schema config and set it automatically from the name
    Should the adapters supply this themselves? Yes, each adapter should make sure to specify this themselves (protocolFork.optional() and protocolName).
    Some of these could be hardcoded for the adapter (ex: aavev3), while others can be runtime supplied (both protocolFork and protocolName needed for an erc20 tracking)

We would like some consistency with the protocolName and protocolForkOf.
protocolName could be anything (in fact, it's the literal). Like aave-v3, or sushiswap, or oku, etc
This is key so we have good reporting here

We should always have a protocolName. This is provided by the adapter itself (for example, in the defineAdapter name).

How to get the protocolForkOf? This likely shouldn't be a "whatever" you want string since this won't be consistent.
We should probably provide a list of possible enums that they can match on. We can set this as an optional param
within the defineAdapter function.
[x] Subtask: Pass through the name / forkOf to the data shape

2. [x] How do we pass through the type of activity (lend, borrow, hold) if the emitted event is the same? (ex: both use balanceDelta)
Each window, action, etc, has some sort of role. Usually tied to that particular asset, but NOT always.
for example, swapping an atoken and also tracking lending. however, these would be 2 separate indexers...

Each time window or action should have some kind of event type. We could use the event name, but it's not always very descriptive (for example, event = mint but we use that to track lending)

Action:
univ3: 'swap', 'collect'
claim contract/auction win: 'claim'
demos: 'verify'
bridge: 'bridge'
erc721/20: 'mint'
auction: 'bid'
aave: 'liquidation'
dao: 'vote'

We sometimes also care about metadata, for example, whether the swap was an 'input' or 'output'.
Metadata is reserved for things like: 'token0', 'token1', 'saleId', 'bidIndex', etc
We do also care to know whether the position was a "input" or "output" side for the asset.
however, this probably goes into the metadata field?

All twb deal with holding an asset, but depending on which asset you hold, it represents different action
univ3: 'lp'
aave: 'lend', 'borrow' -> same protocol, but different activities
perps: 'long', 'short'
erc20: 'hold'
zircuit style: 'stake'

If i do it on each balance_delta, its weird since a balance_delta emits a row when there's a change on the position somewhat.
So if we emit an event on each balance_delta, which one do we pick since each row really is tied to 2?
Should it just be the first one? and since the role ('lend') would be hardcoded, there will almost never be a chance when it would be different between calls?

We don't need to look at the prev balance delta, just activity for the current even that's creating the row.

3. [x] Price source could be multiple. Right now, it's a single column. How to reconcile? Do we use the last one?
    - yes, let's use the last one and call it pricing method leaf
4. [x] Should provenance be part of both to compute the windows? particularly around start/end ts. that way, we get both transactions / logs? What's the best way to reconcile this?
    - we'll keep it generalized to avoid custom fields per chain (and remove complexity)
5. [x] Should we include the gas used/price/cost when looking at TWB? And should this be part of provenance, or a separate field only for action?
    - easiest: only for action
    - for twb: it's comprised of the following:
    0xstart, 0xbalance_change (2 txs) - gas 0xstart
    0xbalance_change, 0xnew_bal_change (1 new tx) gas 0xbalance_change
    0xnew_bal_change, null (no new txs) - gas 0xnew_bal_change

    -- have 4 columns for this

    We want to make sure we have a gasUsed + effectiveGasPrice
*/
