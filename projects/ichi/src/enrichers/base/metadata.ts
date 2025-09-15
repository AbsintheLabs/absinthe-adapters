import { Currency } from '@absinthe/common';
import {
  Enricher,
  EnrichmentContext,
  RawBalanceWindow,
  RawAction,
  BaseEnrichedFields,
} from '../../types/enrichment';

/**
 * Enricher that formats and customizes metadata in the appropriate way
 */
export const enrichBaseEventMetadata: Enricher<BaseEnrichedFields, BaseEnrichedFields> = async (
  items,
  context,
) => {
  return items.map((item) => {
    return {
      ...item,
      base: {
        ...item.base,
        protocolMetadata: Object.fromEntries(
          Object.entries((item as any).meta || {}).map(([key, value]) => [
            key,
            {
              value: String(value),
              type: typeof value as 'number' | 'string',
            },
          ]),
        ),
      },
    };
  });
};

/**
 * Enricher that adds common base event fields to raw items
 */
export const enrichWithCommonBaseEventFields: Enricher<
  RawBalanceWindow | RawAction,
  BaseEnrichedFields
> = async (items, context) => {
  return items.map((item) => ({
    ...item,
    base: {
      version: '1.0.0',
      // xxx: figure out how we do it in the other adapters. it should be a hash of the entire event, so probably would benefit being another enrichment step
      eventId: '',
      userId: (item as any).user,
      currency: Currency.USD,
    },
  }));
};

/**
 * Enricher that adds runner information to base fields
 */
export const enrichWithRunnerInfo: Enricher<BaseEnrichedFields, BaseEnrichedFields> = async (
  items,
  context,
) => {
  return items.map((item) => ({
    ...item,
    base: {
      ...item.base,
      runner: {
        // xxx: this also needs to be properly implemented here
        runnerId: '1',
        apiKeyHash: '1',
      },
    },
  }));
};
