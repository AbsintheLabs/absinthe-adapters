// enrichers/base/add-raw-action-fields.ts
import { Enricher } from '../core.ts';
import { RawAction } from '../../types/enrichment.ts';
import { MeasurementType } from '../../types/manifest.ts';
import { Activity } from '../../types/core.ts';

type RawActionSnakeCaseFields = {
  tx_ref: string;
  ts_ms: number;
  pricing_handler_id: string | null;
  measurement_type: MeasurementType;
  activity: Activity;
};

/**
 * Maps RawAction camelCase fields to snake_case for schema compliance.
 * This enricher ensures that fields from the engine (camelCase) are converted
 * to the snake_case format expected by the final schema.
 */
export const addRawActionFields = <T extends RawAction>(): Enricher<
  T,
  T & RawActionSnakeCaseFields
> => {
  return (item) => {
    return {
      ...item,
      tx_ref: item.txRef,
      ts_ms: item.ts,
      pricing_handler_id: item.pricingHandlerId ?? null,
      measurement_type: item.quantityType,
      activity: item.activity,
    };
  };
};
