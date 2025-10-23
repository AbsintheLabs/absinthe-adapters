// enrichers/base/stringify-window-ctx.ts
import { Enricher } from '../core.ts';

/**
 * Converts startContext and endContext from objects to stringified JSON.
 * This ensures ctx lands in single columns in the final sink destination
 * and can be queried using JSON methods.
 *
 * Preserves all other fields while transforming:
 * - startContext: object | null -> start_ctx_json: string | null
 * - endContext: object | null -> end_ctx_json: string | null
 */
export const stringifyWindowCtx = <
  T extends { startContext: Record<string, any> | null; endContext: Record<string, any> | null },
>(): Enricher<T, T & { start_ctx_json: string | null; end_ctx_json: string | null }> => {
  return (item) => {
    return {
      ...item,
      start_ctx_json: item.startContext ? JSON.stringify(item.startContext) : null,
      end_ctx_json: item.endContext ? JSON.stringify(item.endContext) : null,
    };
  };
};
