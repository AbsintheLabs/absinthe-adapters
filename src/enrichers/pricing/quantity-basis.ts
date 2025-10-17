/**
 * @fileoverview Enricher for determining the denomination of an action.
 *
 * Denomination represents how we interpret the action's quantity:
 * - 'usd': USD value (requires pricing)
 * - 'scaled_token': Token amount in human-readable units
 * - 'none': No quantity (defaults to 1)
 */

import { Enricher } from '../core.ts';
import { Denomination, MeasurementType } from '../../types/manifest.ts';

/**
 * Enricher that determines the denomination for an action or window.
 *
 * Logic:
 * - token_based + pricing configured → 'usd'
 * - token_based + no pricing → 'scaled_token'
 * - count → 'none'
 * - none → 'none'
 */
export const addDenomination = <
  T extends { measurement_type: MeasurementType; pricing_handler_id: string | null },
>(): Enricher<T, T & { denomination: Denomination }> => {
  return (item) => {
    // Type-safe field access - these fields are guaranteed by the pipeline
    const measurementType = item.measurement_type;
    const pricingHandlerId = item.pricing_handler_id ?? null;

    let denomination: Denomination;

    if (measurementType === 'token_based') {
      denomination = pricingHandlerId ? 'usd' : 'scaled_token';
    } else if (measurementType === 'count' || measurementType === 'none') {
      denomination = 'none';
    } else {
      throw new Error(`Invalid measurement type: ${measurementType}`);
    }

    return {
      ...item,
      denomination,
    };
  };
};
