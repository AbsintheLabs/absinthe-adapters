/**
 * @fileoverview Enricher for calculating the final quantity value for an action.
 *
 * This enricher uses a composition pattern:
 * 1. Base quantity calculators compute the raw quantity based on quantityType
 * 2. Basis modifiers apply transformations based on quantityBasis (e.g., pricing)
 */

import Big from 'big.js';
import { Enricher, EnrichmentContext } from '../core.ts';
import { QuantityType } from '../../types/manifest.ts';
import { QuantityBasis } from './quantity-basis.ts';
import { getPrevSample } from '../utils/timeseries.ts';
import { logger } from '../../utils/logger.ts';

type QuantityField = {
  quantity: number;
};

/**
 * Input fields required for quantity calculation
 */
type QuantityInput = {
  quantityType: QuantityType;
  quantityBasis: QuantityBasis;
  value: string;
  asset?: string;
  ts: number;
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
const baseCalculators: Record<QuantityType, BaseQuantityCalculator> = {
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
  asset: string | undefined,
  ts: number,
  user: string,
) => Promise<Big>;

/**
 * Basis modifiers by quantityBasis
 */
const basisModifiers: Record<QuantityBasis, BasisModifier> = {
  monetary_value: async (quantity, ctx, asset, ts, user) => {
    if (!asset) {
      logger.warn(`monetary_value basis requires asset, user: ${user}, defaulting to 0`);
      return new Big(0);
    }

    const priceKey = `price:${asset}`;
    const priceSample = await getPrevSample(ctx.redis, priceKey, ts);

    if (!priceSample) {
      logger.debug(
        `No price data found for asset ${asset} at ts ${ts}, user: ${user}, defaulting to 0`,
      );
      return new Big(0);
    }

    return quantity.times(priceSample.value);
  },
  asset_amount: async (quantity) => quantity,
  count: async (quantity) => quantity,
  none: async (quantity) => quantity,
};

/**
 * Enricher that calculates the final quantity value for an action.
 *
 * Uses composition:
 * 1. Calculate base quantity from value and decimals based on quantityType
 * 2. Apply basis modifier (e.g., pricing) based on quantityBasis
 */
export const calculateQuantity = <T extends object>(): Enricher<T, T & QuantityField> => {
  return async (item, ctx) => {
    // Type-safe field access - these fields are guaranteed by RawAction + addQuantityBasis in the pipeline
    const { quantityType, quantityBasis, value, asset, ts, user } = item as QuantityInput;

    // Step 1: Get asset metadata (decimals) if needed
    const metadata = asset ? await ctx.metadataCache?.get(asset) : undefined;
    const decimals = metadata?.decimals ?? 0;

    // Step 2: Calculate base quantity
    const baseQuantity = baseCalculators[quantityType](value, decimals);

    // Step 3: Apply basis modifier
    const finalQuantity = await basisModifiers[quantityBasis](baseQuantity, ctx, asset, ts, user);

    return {
      ...item,
      quantity: finalQuantity.toNumber(),
    };
  };
};
