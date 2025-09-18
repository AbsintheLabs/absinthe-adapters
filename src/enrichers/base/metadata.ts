type Currency = 'usd' | 'eth';

import {
  Enricher,
  EnrichmentContext,
  ScalarEnricher,
  RawBalanceWindow,
  RawAction,
  BaseEnrichedFields,
} from '../../types/enrichment.ts';
import os from 'os';
import { getRuntime } from '../../runtime/context.ts';

export const addRunnerInfo: ScalarEnricher<any, any> = async (item, _) => {
  // capture static bits once from runtime context
  const { version, commitSha, apiKeyHash, configHash, machineHostname } = getRuntime();

  return {
    ...item,
    runner_version: version,
    ...(commitSha && { runner_commitSha: commitSha }),
    ...(apiKeyHash && { runner_apiKeyHash: apiKeyHash }),
    runner_configHash: configHash,
    runner_runnerId: machineHostname,
  };
};

/*
-----------------------------------------
-----------------------------------------
-----------------------------------------
*/

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
/**
 * @deprecated This function is deprecated and will be removed in future releases.
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
      currency: 'usd',
    },
  }));
};

/**
 * Enricher that adds runner information to base fields
 */
/**
 * @deprecated This function is deprecated and will be removed in future releases.
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
