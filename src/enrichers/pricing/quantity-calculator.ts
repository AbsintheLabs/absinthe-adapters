/**
 * @fileoverview Enrichers for calculating the final quantity value for actions and windows.
 *
 * This uses a composition pattern:
 * 1. Base quantity calculators compute the raw quantity based on quantityType
 * 2. Basis modifiers apply transformations based on quantityBasis (e.g., pricing)
 *
 * Actions: spot value at a moment in time
 * Windows: time-weighted average value over a period
 */

import Big from 'big.js';
import { Enricher, EnrichmentContext } from '../core.ts';
import { Denomination, MeasurementType } from '../../types/manifest.ts';
import { getPrevSample, getSamplesIn, twaFromSamples } from '../utils/timeseries.ts';
import { logger } from '../../utils/logger.ts';
import { Asset, getAssetKeyFromAsset } from '../../types/asset.ts';

export type QuantityField = {
  quantity: number;
};

/**
 * Input fields required for quantity calculation
 */
type QuantityInput = {
  measurement_type: MeasurementType;
  denomination: Denomination;
  value: string;
  asset?: Asset;
  ts_ms: number;
  user: string;
};

/**
 * Base quantity calculator function type
 * Computes the raw quantity based on quantityType
 */
type BaseQuantityCalculator = (value: string, decimals: number) => Big;

/**
 * Base quantity calculators by quantityType
 */
const baseCalculators: Record<MeasurementType, BaseQuantityCalculator> = {
  token_based: (value, decimals) => new Big(value).div(new Big(10).pow(decimals)),
  count: (value) => new Big(value),
  none: () => new Big(1),
};

/**
 * Basis modifier function type
 * Applies transformations to the base quantity based on quantityBasis
 */
type BasisModifier = (
  quantity: Big,
  ctx: EnrichmentContext,
  asset: Asset | null,
  ts: number,
  user: string,
) => Promise<Big>;

/**
 * Basis modifiers by denomination (for spot/action calculations)
 */
const basisModifiers: Record<Denomination, BasisModifier> = {
  usd: async (quantity, ctx, asset, ts, user) => {
    if (!asset) {
      logger.warn(`usd denomination requires asset, user: ${user}, defaulting to 0`);
      return new Big(0);
    }

    const assetKey = getAssetKeyFromAsset(asset);
    const priceKey = `price:${assetKey}`;
    const priceSample = await getPrevSample(ctx.redis, priceKey, ts);

    if (!priceSample) {
      logger.debug(
        `No price data found for asset ${assetKey} at ts ${ts}, user: ${user}, defaulting to 0`,
      );
      return new Big(0);
    }

    return quantity.times(priceSample.value);
  },
  scaled_token: async (quantity) => quantity,
  none: async (quantity) => quantity,
};

/**
 * TWAP-based basis modifier function type (for windows)
 */
type TWAPBasisModifier = (
  quantity: Big,
  ctx: EnrichmentContext,
  asset: Asset | undefined,
  startTs: number,
  endTs: number,
  user: string,
) => Promise<Big>;

/**
 * TWAP basis modifiers by denomination (for window calculations)
 */
const twapBasisModifiers: Record<Denomination, TWAPBasisModifier> = {
  usd: async (quantity, ctx, asset, startTs, endTs, user) => {
    if (!asset) {
      logger.error(`usd denomination requires asset, user: ${user}, defaulting to 0`);
      return new Big(0);
    }

    const assetKey = getAssetKeyFromAsset(asset);
    const priceKey = `price:${assetKey}`;

    // Get price sample before window start for boundary value
    const prevSample = await getPrevSample(ctx.redis, priceKey, startTs - 1);

    // Get all price samples within the window
    const windowSamples = await getSamplesIn(ctx.redis, priceKey, startTs, endTs);
    if (windowSamples.length === 0) {
      logger.warn(
        `No price data for TWAP calculation: asset ${asset}, window [${startTs}, ${endTs}], user: ${user}`,
      );
    }

    // Compute TWAP of prices over the window
    const { avg: twapPrice, coveredMs } = twaFromSamples(startTs, endTs, prevSample, windowSamples);

    if (twapPrice === null || coveredMs === 0) {
      logger.error(
        `No price data for TWAP calculation: asset ${asset}, window [${startTs}, ${endTs}], user: ${user}, defaulting to 0`,
      );
      return new Big(0);
    }

    // Multiply position size by TWAP price
    return quantity.times(twapPrice);
  },
  scaled_token: async (quantity) => quantity,
  none: async (quantity) => quantity,
};

/**
 * Enricher that calculates the final quantity value for an action.
 *
 * Uses composition:
 * 1. Calculate base quantity from value and decimals based on measurement_type
 * 2. Apply basis modifier (e.g., pricing) based on denomination
 */
export const calculateActionQuantity = <
  T extends {
    measurement_type: MeasurementType;
    denomination: Denomination;
    value: string;
    asset: Asset | null;
    decimals: number | null;
    ts_ms: number;
    user: string;
  },
>(): Enricher<T, T & QuantityField> => {
  return async (item, ctx) => {
    // Type-safe field access - these fields are guaranteed by RawAction + addDenomination in the pipeline
    const { measurement_type, denomination, value, asset, ts_ms, user } = item;

    // Get decimals from item or default to 0 (for count/none measurementTypes)
    // decimals is only populated for token_based actions
    const decimals = item.decimals ?? 0;

    // Step 2: Calculate base quantity
    const baseQuantity = baseCalculators[measurement_type](value, decimals);

    // Step 3: Apply basis modifier
    const finalQuantity = await basisModifiers[denomination](baseQuantity, ctx, asset, ts_ms, user);

    return {
      ...item,
      quantity: finalQuantity.toNumber(),
    };
  };
};

/**
 * Enricher that calculates the final quantity value for a window/position.
 *
 * Uses time-weighted average pricing over the window period.
 * Position size is approximated as the average of start and end values.
 *
 * Uses composition:
 * 1. Calculate average position size from rawBefore and rawAfter
 * 2. Apply TWAP basis modifier (e.g., time-weighted average pricing)
 *
 * Windows are always token_based, so measurement_type is constrained accordingly.
 */
export const calculatePositionQuantity = <
  T extends {
    measurement_type: 'token_based';
    denomination: Denomination;
    raw_before: string;
    raw_after: string;
    asset: Asset;
    window_utc_start_ts_ms: number;
    window_utc_end_ts_ms: number;
    decimals: number;
    user: string;
  },
>(): Enricher<T, T & QuantityField> => {
  return async (item, ctx) => {
    if (!item.asset) {
      logger.warn('asset not found: ', JSON.stringify(item, null, 2));
    }
    const {
      measurement_type: quantityType,
      denomination,
      raw_before,
      raw_after,
      asset,
      window_utc_start_ts_ms,
      window_utc_end_ts_ms,
      decimals,
      user,
    } = item;

    // Step 1: Calculate average position size over the window
    // Simple approximation: (start + end) / 2
    // const startAmount = new Big(raw_before);
    // const endAmount = new Big(raw_after);
    // const avgRawAmount = startAmount.plus(endAmount).div(2);

    // Step 2: Convert to human-readable units based on quantityType
    logger.debug('starting Base Quantity calculation');
    logger.debug(`raw_before: ${raw_before}, decimals: ${decimals}`);
    const baseQuantity = baseCalculators[quantityType](raw_before, decimals);

    // Step 3: Apply TWAP basis modifier
    const finalQuantity = await twapBasisModifiers[denomination](
      baseQuantity,
      ctx,
      asset,
      window_utc_start_ts_ms,
      window_utc_end_ts_ms,
      user,
    );

    return {
      ...item,
      quantity: finalQuantity.toNumber(),
    };
  };
};
