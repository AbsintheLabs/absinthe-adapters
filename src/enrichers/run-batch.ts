// enrichers/run-batch.ts
import { Enricher, EnrichmentContext } from './core.ts';

export async function runBatch<I, O>(
  items: readonly I[],
  pipe: Enricher<I, O>,
  ctx: EnrichmentContext,
): Promise<O[]> {
  // Straight map + Promise.all keeps order stable
  const results = await Promise.all(items.map((it) => pipe(it, ctx)));
  // Filter out any undefined results that are either: errors or filtered out by the enricher
  return results.filter((result) => result !== undefined);
}
