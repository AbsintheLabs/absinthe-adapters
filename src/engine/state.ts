// State management utilities for the engine
import { Database, LocalDest } from '@subsquid/file-store';
import { getRuntime } from '../runtime/context.ts';

/**
 * Generate the state path for the SQD database based on the current config hash
 */
export function generateStatePath(): string {
  return '_sqdstate-' + getRuntime().configHash;
}

/**
 * Create a new database instance for SQD processor state
 */
export function createStateDatabase(): Database<any, any> {
  const statePath = generateStatePath();
  return new Database({ tables: {}, dest: new LocalDest(statePath) });
}
