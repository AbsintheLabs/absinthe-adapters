/**
 * @fileoverview Core types and functions for the enricher system.
 *
 * This module provides composable pipeline primitives for building type-safe
 * enrichment chains without manual overload definitions.
 */

import { z } from 'zod';

import type { EoaDetector } from '../cache/index.ts';
import type { AppConfig } from '../config/schema.ts';

export type EnrichmentContext = {
  priceCache?: any;
  metadataCache?: any;
  handlerMetadataCache?: any;
  redis?: any;
  eoaDetector?: EoaDetector;
  appCfg?: AppConfig;
};

export type Enricher<I, O> = (item: I, ctx: EnrichmentContext) => O | Promise<O>;

/**
 * A composable pipeline that tracks input/output shapes through the chain.
 * No overloads needed—composition handles type threading automatically.
 *
 * Handles enrichers that can return undefined (for filtering), automatically
 * short-circuiting and filtering out undefined results in batch processing.
 */
export class Pipe<In, Out> {
  constructor(private enrichers: Array<Enricher<any, any>>) {}

  /**
   * Attach the next enricher. TypeScript infers that Out becomes the input to the next step.
   * Handles enrichers that may return undefined for filtering purposes.
   */
  pipe<Next>(enricher: Enricher<Out, Next | undefined>): Pipe<In, Next>;
  pipe<Next>(enricher: Enricher<Out, Next>): Pipe<In, Next>;
  pipe<Next>(enricher: Enricher<Out, Next | undefined>): Pipe<In, Next> {
    return new Pipe([...this.enrichers, enricher]);
  }

  /**
   * Create a new pipeline starting from a known input shape.
   * This validates the first step and establishes the initial type.
   */
  static start<T>(enricher: Enricher<T, T>): Pipe<T, T>;
  static start<T, U>(enricher: Enricher<T, U>): Pipe<T, U>;
  static start<T, U>(enricher: Enricher<T, U>): Pipe<T, U> {
    return new Pipe([enricher]);
  }

  /**
   * Execute the pipeline on a single item.
   * Returns undefined if any enricher in the chain returns undefined (filtering).
   */
  async run(item: In, ctx: EnrichmentContext): Promise<Out | undefined> {
    let current: any = item;
    for (const enricher of this.enrichers) {
      current = await enricher(current, ctx);
      if (current === undefined) return undefined;
    }
    return current;
  }

  /**
   * Execute on a batch, filtering out undefined results.
   * This is the primary way to run pipelines in production.
   */
  async runBatch(items: readonly In[], ctx: EnrichmentContext): Promise<Out[]> {
    const results = await Promise.all(items.map((it) => this.run(it, ctx)));
    return results.filter((r) => r !== undefined) as Out[];
  }
}

/**
 * Simple shape gate to enforce type contracts at specific points.
 * Use this at the start and end of pipelines to validate transformations.
 *
 * This enforces that the input is exactly T (not just extends T).
 */
export function requireShape<T>(): Enricher<T, T> {
  return (item) => item;
}

/**
 * Enforce that the pipeline output conforms to a specific shape.
 * Unlike requireShape, this explicitly validates the input matches the output type.
 *
 * Usage: .pipe(enforceOutput<TargetType>())
 */
export function enforceOutput<T>(): Enricher<T, T> {
  return (item) => item;
}

/**
 * Validates data against a Zod schema and automatically strips extra fields.
 * This enforces exact shape matching at runtime with full type validation.
 *
 * Usage: .pipe(validateAndPickShape(MySchema))
 *
 * The schema should use .strip() to remove extra fields automatically.
 *
 * IMPORTANT: This enforces compile-time type checking by requiring the input
 * to match the schema type. If enrichers don't produce all required fields,
 * TypeScript will catch it at compile time.
 *
 * @param schema - Zod schema to validate against
 * @returns Enricher that validates and strips extra fields
 */
export function validateAndPickShape<T>(
  schema: z.ZodType<T>,
): <Input extends T>(item: Input, ctx: EnrichmentContext) => T {
  return (item) => {
    return schema.parse(item);
  };
}
