type Currency = 'usd' | 'eth';

import {
  Enricher,
  EnrichmentContext,
  ScalarEnricher,
  RawBalanceWindow,
  RawAction,
  BaseEnrichedFields,
} from '../../types/enrichment';
import os from 'os';
import { md5Hash } from '../../utils/helper';
import { log } from '../../utils/logger';
import { RunnerMeta } from '../../types/events';
import { ABSINTHE_VERSION } from '../../version';

// IIFE to defer work at module load and cache the results
export const addRunnerInfo: ScalarEnricher<any, any> = (() => {
  // get hostname
  const machineHostname = os.hostname();

  // get api key if exists
  const apiKey = process.env.ABSINTHE_API_KEY;
  const apiKeyHash = apiKey ? md5Hash(apiKey) : null;

  // get commit sha if exists
  const longCommitSha = process.env.COMMIT_SHA;
  const commitSha = longCommitSha ? longCommitSha.slice(0, 8) : null;

  // get config hash
  // fixme: how do we get the config here?
  // tbd...

  const version = ABSINTHE_VERSION;

  return async (item, _) => {
    return {
      ...item,
      runner_version: version,
      ...(commitSha && { runner_commitSha: commitSha }),
      // ...(configHash && { runner_configHash: configHash }),
      runner_runnerId: machineHostname,
      runner_apiKeyHash: apiKeyHash,
    };
  };
})();

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
