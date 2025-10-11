/**
 * @fileoverview Enricher for determining the quantity basis of an action.
 *
 * Quantity basis represents how we interpret the action's quantity:
 * - 'monetary_value': USD value (requires pricing)
 * - 'asset_amt': Token amount in human-readable units
 * - 'count': Simple numeric count
 * - 'none': No quantity (defaults to 1)
 */

import { Enricher } from '../core.ts';
import { QuantityType } from '../../types/manifest.ts';
import { RawAction } from '../../types/enrichment.ts';

/**
 * Possible values for quantity basis
 */
export type QuantityBasis =
  | Exclude<QuantityType, 'token_based'>
  | 'monetary_value'
  | 'asset_amount';

type QuantityBasisField = {
  quantityBasis: QuantityBasis;
};

/**
 * Enricher that determines the quantity basis for an action.
 *
 * Logic:
 * - token_based + pricing configured → 'monetary_value'
 * - token_based + no pricing → 'asset_amount'
 * - count → 'count'
 * - none → 'none'
 */
export const addQuantityBasis = <T extends object>(): Enricher<T, T & QuantityBasisField> => {
  return (item) => {
    // Type-safe field access - these fields are guaranteed by RawAction in the pipeline
    // const quantityType = item.quantityType;
    // const pricingHandlerId = item.pricingHandlerId;
    // XXX: fixme: this needs to be fixed
    const quantityType = (item as { quantityType: QuantityType }).quantityType;
    const pricingHandlerId = (item as { pricingHandlerId?: string }).pricingHandlerId;

    let quantityBasis: QuantityBasis;

    if (quantityType === 'token_based') {
      quantityBasis = pricingHandlerId ? 'monetary_value' : 'asset_amount';
    } else if (quantityType === 'count') {
      quantityBasis = 'count';
    } else if (quantityType === 'none') {
      quantityBasis = 'none';
    } else {
      throw new Error(`Invalid quantity type: ${quantityType}`);
    }

    return {
      ...item,
      quantityBasis,
    };
  };
};
