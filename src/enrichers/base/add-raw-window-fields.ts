// enrichers/base/add-raw-window-fields.ts
import { Enricher } from '../core.ts';
import { RawWindow } from '../../types/enrichment.ts';
import { QuantityType } from '../../types/manifest.ts';
import { Activity } from '../../types/core.ts';

type RawWindowSnakeCaseFields = {
  quantity_type: QuantityType;
  activity: Activity;
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
      quantity_type: item.quantityType,
      activity: item.activity,
    };
  };
};
