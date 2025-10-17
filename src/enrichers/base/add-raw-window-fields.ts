// enrichers/base/add-raw-window-fields.ts
import { Enricher } from '../core.ts';
import { RawWindow } from '../../types/enrichment.ts';
import { MeasurementType } from '../../types/manifest.ts';
import { Activity } from '../../types/core.ts';
import { WindowReason } from '../../types/adapter.ts';

type RawWindowSnakeCaseFields = {
  measurement_type: MeasurementType;
  activity: Activity;
  emit_cause: WindowReason;
  pricing_handler_id: string | null;
};

/**
 * Maps RawWindow camelCase fields to snake_case for schema compliance.
 * This enricher ensures that fields from the engine (camelCase) are converted
 * to the snake_case format expected by the final schema.
 */
export const addRawWindowFields = <T extends RawWindow>(): Enricher<
  T,
  T & RawWindowSnakeCaseFields
> => {
  return (item) => {
    return {
      ...item,
      measurement_type: item.measurementType,
      activity: item.activity,
      emit_cause: item.trigger,
      pricing_handler_id: item.pricingHandlerId ?? null,
    };
  };
};
