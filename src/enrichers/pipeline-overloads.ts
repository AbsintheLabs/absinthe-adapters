/**
 * @fileoverview Pipeline function overloads for chaining enrichers.
 *
 * This module contains all the type-safe overloads for the pipeline function
 * that allow chaining multiple enrichers together with proper type inference.
 */

import type { Enricher, EnrichmentContext } from './core.ts';

// ---- Overloads (extend as needed) ----
export function pipeline<A, B>(s1: Enricher<A, B>): Enricher<A, B>;
export function pipeline<A, B, C>(s1: Enricher<A, B>, s2: Enricher<B, C>): Enricher<A, C>;
export function pipeline<A, B, C, D>(
  s1: Enricher<A, B>,
  s2: Enricher<B, C>,
  s3: Enricher<C, D>,
): Enricher<A, D>;
export function pipeline<A, B, C, D, E>(
  s1: Enricher<A, B>,
  s2: Enricher<B, C>,
  s3: Enricher<C, D>,
  s4: Enricher<D, E>,
): Enricher<A, E>;
export function pipeline<A, B, C, D, E, F>(
  s1: Enricher<A, B>,
  s2: Enricher<B, C>,
  s3: Enricher<C, D>,
  s4: Enricher<D, E>,
  s5: Enricher<E, F>,
): Enricher<A, F>;
export function pipeline<A, B, C, D, E, F, G>(
  s1: Enricher<A, B>,
  s2: Enricher<B, C>,
  s3: Enricher<C, D>,
  s4: Enricher<D, E>,
  s5: Enricher<E, F>,
  s6: Enricher<F, G>,
): Enricher<A, G>;
export function pipeline<A, B, C, D, E, F, G, H>(
  s1: Enricher<A, B>,
  s2: Enricher<B, C>,
  s3: Enricher<C, D>,
  s4: Enricher<D, E>,
  s5: Enricher<E, F>,
  s6: Enricher<F, G>,
  s7: Enricher<G, H>,
): Enricher<A, H>;
export function pipeline<A, B, C, D, E, F, G, H, I>(
  s1: Enricher<A, B>,
  s2: Enricher<B, C>,
  s3: Enricher<C, D>,
  s4: Enricher<D, E>,
  s5: Enricher<E, F>,
  s6: Enricher<F, G>,
  s7: Enricher<G, H>,
  s8: Enricher<H, I>,
): Enricher<A, I>;
export function pipeline<A, B, C, D, E, F, G, H, I, J>(
  s1: Enricher<A, B>,
  s2: Enricher<B, C>,
  s3: Enricher<C, D>,
  s4: Enricher<D, E>,
  s5: Enricher<E, F>,
  s6: Enricher<F, G>,
  s7: Enricher<G, H>,
  s8: Enricher<H, I>,
  s9: Enricher<I, J>,
): Enricher<A, J>;
export function pipeline<A, B, C, D, E, F, G, H, I, J, K>(
  s1: Enricher<A, B>,
  s2: Enricher<B, C>,
  s3: Enricher<C, D>,
  s4: Enricher<D, E>,
  s5: Enricher<E, F>,
  s6: Enricher<F, G>,
  s7: Enricher<G, H>,
  s8: Enricher<H, I>,
  s9: Enricher<I, J>,
  s10: Enricher<J, K>,
): Enricher<A, K>;
export function pipeline<A, B, C, D, E, F, G, H, I, J, K, L>(
  s1: Enricher<A, B>,
  s2: Enricher<B, C>,
  s3: Enricher<C, D>,
  s4: Enricher<D, E>,
  s5: Enricher<E, F>,
  s6: Enricher<F, G>,
  s7: Enricher<G, H>,
  s8: Enricher<H, I>,
  s9: Enricher<I, J>,
  s10: Enricher<J, K>,
  s11: Enricher<K, L>,
): Enricher<A, L>;
export function pipeline<A, B, C, D, E, F, G, H, I, J, K, L, M>(
  s1: Enricher<A, B>,
  s2: Enricher<B, C>,
  s3: Enricher<C, D>,
  s4: Enricher<D, E>,
  s5: Enricher<E, F>,
  s6: Enricher<F, G>,
  s7: Enricher<G, H>,
  s8: Enricher<H, I>,
  s9: Enricher<I, J>,
  s10: Enricher<J, K>,
  s11: Enricher<K, L>,
  s12: Enricher<L, M>,
): Enricher<A, M>;
export function pipeline<A, B, C, D, E, F, G, H, I, J, K, L, M, N>(
  s1: Enricher<A, B>,
  s2: Enricher<B, C>,
  s3: Enricher<C, D>,
  s4: Enricher<D, E>,
  s5: Enricher<E, F>,
  s6: Enricher<F, G>,
  s7: Enricher<G, H>,
  s8: Enricher<H, I>,
  s9: Enricher<I, J>,
  s10: Enricher<J, K>,
  s11: Enricher<K, L>,
  s12: Enricher<L, M>,
  s13: Enricher<M, N>,
): Enricher<A, N>;
export function pipeline<A, B, C, D, E, F, G, H, I, J, K, L, M, N, O>(
  s1: Enricher<A, B>,
  s2: Enricher<B, C>,
  s3: Enricher<C, D>,
  s4: Enricher<D, E>,
  s5: Enricher<E, F>,
  s6: Enricher<F, G>,
  s7: Enricher<G, H>,
  s8: Enricher<H, I>,
  s9: Enricher<I, J>,
  s10: Enricher<J, K>,
  s11: Enricher<K, L>,
  s12: Enricher<L, M>,
  s13: Enricher<M, N>,
  s14: Enricher<N, O>,
): Enricher<A, O>;
export function pipeline<A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P>(
  s1: Enricher<A, B>,
  s2: Enricher<B, C>,
  s3: Enricher<C, D>,
  s4: Enricher<D, E>,
  s5: Enricher<E, F>,
  s6: Enricher<F, G>,
  s7: Enricher<G, H>,
  s8: Enricher<H, I>,
  s9: Enricher<I, J>,
  s10: Enricher<J, K>,
  s11: Enricher<K, L>,
  s12: Enricher<L, M>,
  s13: Enricher<M, N>,
  s14: Enricher<N, O>,
  s15: Enricher<O, P>,
): Enricher<A, P>;
export function pipeline<A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q>(
  s1: Enricher<A, B>,
  s2: Enricher<B, C>,
  s3: Enricher<C, D>,
  s4: Enricher<D, E>,
  s5: Enricher<E, F>,
  s6: Enricher<F, G>,
  s7: Enricher<G, H>,
  s8: Enricher<H, I>,
  s9: Enricher<I, J>,
  s10: Enricher<J, K>,
  s11: Enricher<K, L>,
  s12: Enricher<L, M>,
  s13: Enricher<M, N>,
  s14: Enricher<N, O>,
  s15: Enricher<O, P>,
  s16: Enricher<P, Q>,
): Enricher<A, Q>;
export function pipeline<A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R>(
  s1: Enricher<A, B>,
  s2: Enricher<B, C>,
  s3: Enricher<C, D>,
  s4: Enricher<D, E>,
  s5: Enricher<E, F>,
  s6: Enricher<F, G>,
  s7: Enricher<G, H>,
  s8: Enricher<H, I>,
  s9: Enricher<I, J>,
  s10: Enricher<J, K>,
  s11: Enricher<K, L>,
  s12: Enricher<L, M>,
  s13: Enricher<M, N>,
  s14: Enricher<N, O>,
  s15: Enricher<O, P>,
  s16: Enricher<P, Q>,
  s17: Enricher<Q, R>,
): Enricher<A, R>;
export function pipeline<A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S>(
  s1: Enricher<A, B>,
  s2: Enricher<B, C>,
  s3: Enricher<C, D>,
  s4: Enricher<D, E>,
  s5: Enricher<E, F>,
  s6: Enricher<F, G>,
  s7: Enricher<G, H>,
  s8: Enricher<H, I>,
  s9: Enricher<I, J>,
  s10: Enricher<J, K>,
  s11: Enricher<K, L>,
  s12: Enricher<L, M>,
  s13: Enricher<M, N>,
  s14: Enricher<N, O>,
  s15: Enricher<O, P>,
  s16: Enricher<P, Q>,
  s17: Enricher<Q, R>,
  s18: Enricher<R, S>,
): Enricher<A, S>;
export function pipeline<A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T>(
  s1: Enricher<A, B>,
  s2: Enricher<B, C>,
  s3: Enricher<C, D>,
  s4: Enricher<D, E>,
  s5: Enricher<E, F>,
  s6: Enricher<F, G>,
  s7: Enricher<G, H>,
  s8: Enricher<H, I>,
  s9: Enricher<I, J>,
  s10: Enricher<J, K>,
  s11: Enricher<K, L>,
  s12: Enricher<L, M>,
  s13: Enricher<M, N>,
  s14: Enricher<N, O>,
  s15: Enricher<O, P>,
  s16: Enricher<P, Q>,
  s17: Enricher<Q, R>,
  s18: Enricher<R, S>,
  s19: Enricher<S, T>,
): Enricher<A, T>;
export function pipeline<A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U>(
  s1: Enricher<A, B>,
  s2: Enricher<B, C>,
  s3: Enricher<C, D>,
  s4: Enricher<D, E>,
  s5: Enricher<E, F>,
  s6: Enricher<F, G>,
  s7: Enricher<G, H>,
  s8: Enricher<H, I>,
  s9: Enricher<I, J>,
  s10: Enricher<J, K>,
  s11: Enricher<K, L>,
  s12: Enricher<L, M>,
  s13: Enricher<M, N>,
  s14: Enricher<N, O>,
  s15: Enricher<O, P>,
  s16: Enricher<P, Q>,
  s17: Enricher<Q, R>,
  s18: Enricher<R, S>,
  s19: Enricher<S, T>,
  s20: Enricher<T, U>,
): Enricher<A, U>;
// (Add more overloads if you foresee >20 steps frequently)

// ---- Implementation ----
export function pipeline(...steps: Array<Enricher<any, any>>): Enricher<any, any> {
  return async (item: any, ctx: EnrichmentContext) => {
    let cur = item;
    for (const step of steps) {
      cur = await step(cur, ctx);
    }
    return cur;
  };
}
