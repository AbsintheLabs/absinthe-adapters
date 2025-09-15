import { Enricher, EnrichmentContext } from '../../types/enrichment';

/**
 * Simple pipe runner with proper typing that chains enrichers together
 */
export function pipeline<TOutput>(...enrichers: Enricher<any, any>[]) {
  return async (items: any[], context: EnrichmentContext): Promise<TOutput[]> => {
    let result: any[] = items;
    for (const enricher of enrichers) {
      result = await enricher(result, context);
    }
    return result as TOutput[];
  };
}
