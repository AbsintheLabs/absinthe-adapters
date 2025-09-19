// enrichers/run-batch.ts
import { Enricher, EnrichmentContext } from './core.ts';

export async function runBatch<I, O>(
  items: readonly I[],
  pipe: Enricher<I, O>,
  ctx: EnrichmentContext,
): Promise<O[]> {
  // Straight map + Promise.all keeps order stable
  return await Promise.all(items.map((it) => pipe(it, ctx)));
}
