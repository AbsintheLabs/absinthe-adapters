import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Redis } from 'ioredis';

/** Same dir rule you used in Engine.generateStatePath */
export function deriveStateDirFromHash(hash: string) {
  return `_sqdstate-${hash}`;
}

/** Delete the state directory for this run (if it exists). */
export async function clearStateDir(stateDir: string) {
  const abs = path.resolve(stateDir);
  await fs.rm(abs, { recursive: true, force: true });
}

/**
 * Clear all Redis keys under a given keyPrefix.
 * Uses redis.call(...) so ioredis DOES NOT auto-apply keyPrefix.
 * We pass the fully-prefixed key names to UNLINK/DEL.
 */
export async function clearRedisNamespace(redis: Redis, keyPrefix: string) {
  const match = `${keyPrefix}*`;
  let cursor = '0';
  const BATCH = 1000;

  do {
    const [next, keys] = (await redis.call(
      'SCAN',
      cursor,
      'MATCH',
      match,
      'COUNT',
      String(BATCH),
    )) as [string, string[]];

    if (Array.isArray(keys) && keys.length) {
      // Use UNLINK (non-blocking) if available; fallback to DEL
      const chunks: string[][] = [];
      for (let i = 0; i < keys.length; i += BATCH) chunks.push(keys.slice(i, i + BATCH));
      for (const chunk of chunks) {
        try {
          await redis.call('UNLINK', ...chunk);
        } catch {
          await redis.call('DEL', ...chunk);
        }
      }
    }

    cursor = next;
  } while (cursor !== '0');
}
