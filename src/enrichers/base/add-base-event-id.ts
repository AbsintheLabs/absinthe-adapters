import { md5HashCanonical } from '../../utils/stable-hash.ts';
import { getRuntime } from '../../runtime/context.ts';
import { Enricher } from '../core.ts';

type EventIdField = {
  event_id: string;
};

/**
 * Adds base_eventId field for backwards compatibility.
 *
 * ⚠️ WARNING: We need to confirm that these fields TRULY make the base_eventId unique.
 * The uniqueness of base_eventId is critical for deduplication and event tracking.
 * Review the hash input fields carefully to ensure they provide sufficient uniqueness
 * across all possible events in the system.
 *
 * For Actions, the hash includes:
 * - chainId
 * - user
 * - ts (timestamp)
 * - txRef
 * - logIndex (if it exists from ctx)
 * - absintheApiKeyHash (if it exists)
 * - trackableInstanceId
 *
 * For Windows, the hash includes:
 * - chainId
 * - user
 * - startTs
 * - endTs
 * - absintheApiKeyHash (if it exists)
 * - trackableInstanceId
 */

type ActionFields = {
  user: string;
  ts: number;
  tx_ref: string;
  trackableInstanceId: string;
  ctx?: Record<string, any>;
};

type WindowFields = {
  user: string;
  startTs: number;
  endTs: number;
  trackableInstanceId: string;
};

/**
 * Enricher for adding base_eventId to actions.
 * Hashes chainId, user, ts, txRef, logIndex (optional), apiKeyHash (optional), and trackableInstanceId.
 */
export const addEventIdForAction = <T extends ActionFields>(): Enricher<T, T & EventIdField> => {
  return (item) => {
    const { chainId, apiKeyHash } = getRuntime();

    const hashInput: Record<string, any> = {
      chainId,
      user: item.user,
      time: item.ts,
      txRef: item.tx_ref,
      trackableInstanceId: item.trackableInstanceId,
    };

    // Add logIndex if it exists in ctx
    if (item.ctx && 'logIndex' in item.ctx) {
      hashInput.logIndex = item.ctx.logIndex;
    }

    // Add apiKeyHash if it exists
    if (apiKeyHash) {
      hashInput.absintheApiKeyHash = apiKeyHash;
    }

    const event_id = md5HashCanonical(hashInput, 8);

    return {
      ...item,
      event_id,
    };
  };
};

/**
 * Enricher for adding base_eventId to windows.
 * Hashes chainId, user, startTs, endTs, apiKeyHash (optional), and trackableInstanceId.
 */
export const addEventIdForPosition = <T extends WindowFields>(): Enricher<T, T & EventIdField> => {
  return (item) => {
    const { chainId, apiKeyHash } = getRuntime();

    const hashInput: Record<string, any> = {
      chainId,
      user: item.user,
      startTs: item.startTs,
      endTs: item.endTs,
      trackableInstanceId: item.trackableInstanceId,
    };

    // Add apiKeyHash if it exists
    if (apiKeyHash) {
      hashInput.absintheApiKeyHash = apiKeyHash;
    }

    const event_id = md5HashCanonical(hashInput, 8);

    return {
      ...item,
      event_id,
    };
  };
};
