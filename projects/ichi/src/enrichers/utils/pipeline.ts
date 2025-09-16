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

// let's do a bit of scaffolding here
/*
each enricher takes in an object type and returns another object type
some enrichers will depend on the input type having a set of fields that it might depend on

the pipeline is a function that will call the enrichers (and enforce their order) (using the enrichment pipeline class that uses generic to implement a .then and .andAlso method)


*/
