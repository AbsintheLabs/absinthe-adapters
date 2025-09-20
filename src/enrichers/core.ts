/**
 * @fileoverview Core types and functions for the enricher system.
 *
 * This module contains the fundamental types and utilities for the enricher
 * pipeline system, including the base Enricher type and EnrichmentContext.
 */

export type EnrichmentContext = {
  priceCache?: any;
  metadataCache?: any;
  handlerMetadataCache?: any;
  redis?: any;
};

export type Enricher<I, O> = (item: I, ctx: EnrichmentContext) => O | Promise<O>;

// Simple shape gate to enforce the initial input contract at compile time
export function requireShape<T>(): Enricher<T, T> {
  return (item) => item;
}
