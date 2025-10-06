// State management utilities for the engine
import { Database, LocalDest } from '@subsquid/file-store';
import { getRuntime } from '../runtime/context.ts';
import { formatStateDir } from '../utils/state-reset.ts';

/**
 * Generate the state path for the SQD database based on the current config hash
 */
export function generateStatePath(): string {
  return formatStateDir(getRuntime().configHash);
}

/**
 * Create a new database instance for SQD processor state
 */
export function createStateDatabase(): Database<{}, LocalDest> {
  const statePath = generateStatePath();
  return new Database({ tables: {}, dest: new LocalDest(statePath) });
}
