// enrichers/base/add-raw-window-fields.ts
import { Enricher } from '../core.ts';
import { RawPosition } from '../../types/enrichment.ts';
import { Activity } from '../../types/core.ts';
import { PositionReason } from '../../types/adapter.ts';

type RawPositionSnakeCaseFields = {
  measurement_type: 'token_based';
  activity: Activity;
  emit_cause: PositionReason;
  pricing_handler_id: string | null;
  trackable_instance_id: string;
};

/**
 * Maps RawWindow camelCase fields to snake_case for schema compliance.
 * This enricher ensures that fields from the engine (camelCase) are converted
 * to the snake_case format expected by the final schema.
 */
export const addRawPositionFields = <T extends RawPosition>(): Enricher<
  T,
  T & RawPositionSnakeCaseFields
> => {
  return (item) => {
    return {
      ...item,
      measurement_type: item.measurementType,
      activity: item.activity,
      emit_cause: item.trigger,
      pricing_handler_id: item.pricingHandlerId ?? null,
      trackable_instance_id: item.trackableInstanceId,
    };
  };
};
