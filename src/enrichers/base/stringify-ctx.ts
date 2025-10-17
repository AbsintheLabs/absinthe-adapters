// enrichers/base/stringify-ctx.ts
import { Enricher } from '../core.ts';

/**
 * Converts ctx from an object to a stringified JSON object.
 * This ensures ctx lands in a single column in the final sink destination
 * and can be queried using JSON methods.
 *
 * Preserves all other fields while transforming ctx: object -> ctx: string
 */
export const stringifyCtx = <T extends { ctx?: Record<string, any> }>(): Enricher<
  T,
  T & { ctx_json: string | null }
> => {
  return (item) => {
    if (!item.ctx) {
      return { ...item, ctx_json: null };
    }

    return {
      ...item,
      ctx_json: JSON.stringify(item.ctx),
    };
  };
};
