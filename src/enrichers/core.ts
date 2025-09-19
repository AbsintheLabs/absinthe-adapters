// enrichers/core.ts

/**
 * Context object passed to all enrichers containing shared resources like caches and Redis connections.
 * Used to share expensive resources (database connections, caches) across enrichment operations.
 */
export type EnrichmentContext = {
  priceCache?: any;
  metadataCache?: any;
  handlerMetadataCache?: any;
  redis?: any;
};

/**
 * An enricher function that transforms input data of type I into output data of type O.
 * Can be synchronous or asynchronous.
 *
 * @template I - The input type this enricher accepts
 * @template O - The output type this enricher produces
 * @param item - The input data to transform
 * @param ctx - Shared context containing caches and connections
 * @returns The transformed output data
 *
 * @example
 * ```typescript
 * const addTimestamp: Enricher<{ id: string }, { id: string; timestamp: number }> =
 *   (item, ctx) => ({ ...item, timestamp: Date.now() });
 * ```
 */
export type Enricher<I, O> = (item: I, ctx: EnrichmentContext) => O | Promise<O>;

/** Extract the input type from an Enricher type */
type InOf<E> = E extends Enricher<infer I, any> ? I : never;

/** Extract the output type from an Enricher type */
type OutOf<E> = E extends Enricher<any, infer O> ? O : never;

/**
 * Type-level validation that ensures enrichers in a sequence can be composed together.
 * Checks that each enricher's output type matches the next enricher's input type.
 */
type AreComposable<
  Es extends readonly Enricher<any, any>[],
  Acc extends 1 = 1,
> = Es extends readonly [infer A, infer B, ...infer Rest]
  ? A extends Enricher<any, any>
    ? B extends Enricher<any, any>
      ? OutOf<A> extends InOf<B>
        ? AreComposable<readonly [B, ...Extract<Rest, Enricher<any, any>[]>], Acc>
        : 0
      : Acc
    : Acc
  : Acc;

/** Extract the input type of the first enricher in a tuple */
type FirstIn<Es extends readonly Enricher<any, any>[]> = Es extends readonly [infer H, ...any]
  ? InOf<Extract<H, Enricher<any, any>>>
  : never;

/** Extract the output type of the last enricher in a tuple */
type LastOut<Es extends readonly Enricher<any, any>[]> = Es extends readonly [...any, infer L]
  ? OutOf<Extract<L, Enricher<any, any>>>
  : never;

/**
 * Chains multiple enrichers together into a single enricher that runs them sequentially.
 * TypeScript will enforce at compile-time that the output of each step matches the input of the next.
 *
 * @template Es - Tuple of enrichers to chain together
 * @param steps - The enricher functions to run in sequence
 * @returns A single enricher that runs all steps and returns the final output
 *
 * @example
 * ```typescript
 * const addId: Enricher<{ name: string }, { name: string; id: number }> =
 *   (item) => ({ ...item, id: Math.random() });
 *
 * const addTimestamp: Enricher<{ name: string; id: number }, { name: string; id: number; timestamp: number }> =
 *   (item) => ({ ...item, timestamp: Date.now() });
 *
 * const enrichPipeline = pipeline(addId, addTimestamp);
 * // Result type: Enricher<{ name: string }, { name: string; id: number; timestamp: number }>
 * ```
 */
export function pipeline<Es extends readonly Enricher<any, any>[]>(
  ...steps: Es & (AreComposable<Es> extends 1 ? unknown : ["❌ pipeline types don't compose"])
): Enricher<FirstIn<Es>, LastOut<Es>> {
  return (async (item: any, ctx: EnrichmentContext) => {
    let cur = item;
    for (const step of steps) cur = await (step as any)(cur, ctx);
    return cur;
  }) as any;
}

/**
 * Wraps an enricher to only run when a predicate condition is met.
 * If the predicate returns false, the input is passed through unchanged.
 *
 * @template I - The input type
 * @template O - The output type when enricher runs
 * @param pred - Function that determines whether to run the enricher
 * @param e - The enricher to conditionally run
 * @returns An enricher that either transforms the input or passes it through unchanged
 *
 * @example
 * ```typescript
 * const addExpensiveData: Enricher<Product, ProductWithDetails> = (product) =>
 *   ({ ...product, details: fetchExpensiveDetails(product.id) });
 *
 * const conditionalEnricher = optional(
 *   (product: Product) => product.category === 'premium',
 *   addExpensiveData
 * );
 * // Only runs expensive enrichment for premium products
 * ```
 */
export function optional<I, O>(pred: (i: I) => boolean, e: Enricher<I, O>): Enricher<I, I | O> {
  return async (item, ctx) => (pred(item) ? e(item, ctx) : item);
}
