// Auto-loader for pricing handlers
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { logger } from '../utils/logger.js';

type LoadOptions = {
  // Explicit path to the feeds directory (default: auto-resolve)
  feedsDir?: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try both source and build layouts
const defaultCandidates = [
  __dirname, // Same directory as this file
  path.resolve(__dirname, '../feeds'), // If this file is in src/
  path.resolve(__dirname, 'dist', 'src', 'feeds'), // Build layout
];

const DEFAULT_EXTS = ['.ts', '.js', '.mjs', '.cjs'];

// Files to skip
const IGNORE_FILES = new Set([
  'interface.ts',
  'interface.js',
  'loader.ts',
  'loader.js',
  'registry.ts',
  'registry.js',
  'define.ts',
  'define.js',
  'README.md',
]);

function shouldLoadFile(file: string): boolean {
  const base = path.basename(file);

  // Skip TypeScript declaration files
  if (base.endsWith('.d.ts')) return false;

  // Skip ignored files
  if (IGNORE_FILES.has(base)) return false;

  // Skip non-code files
  const ext = path.extname(base);
  if (!DEFAULT_EXTS.includes(ext)) return false;

  return true;
}

/**
 * Dynamically import all feed modules for side-effect registration.
 * Each feed module should call globalFeedRegistry.register(...) when evaluated.
 */
export async function loadAllFeeds(opts: LoadOptions = {}): Promise<string[]> {
  const candidates = opts.feedsDir ? [opts.feedsDir] : defaultCandidates;

  let feedsDir: string | null = null;
  for (const c of candidates) {
    try {
      const stat = await readdir(c);
      if (stat) {
        feedsDir = c;
        break;
      }
    } catch {
      /* try next */
    }
  }

  if (!feedsDir) {
    logger.warn('[feed-loader] No feeds directory found. Checked:', candidates);
    return [];
  }

  const entries = await readdir(feedsDir, { withFileTypes: true });
  const feedFiles = entries
    .filter((e) => e.isFile() && shouldLoadFile(e.name))
    .map((e) => path.join(feedsDir, e.name));

  const loaded: string[] = [];
  for (const f of feedFiles) {
    try {
      // Convert absolute path to file:// URL for ESM dynamic import
      const url = pathToFileURL(f).href;
      logger.debug(`[feed-loader] Loading feed from: ${path.basename(f)}`);
      await import(url);
      loaded.push(f);
    } catch (err) {
      // Don't throw so a misconfigured feed doesn't block the whole app
      logger.error(`[feed-loader] Failed to import ${f}`, err);
    }
  }

  if (loaded.length === 0) {
    logger.warn('[feed-loader] Found feeds dir but loaded 0 modules.');
  } else {
    logger.debug(`[feed-loader] Successfully loaded ${loaded.length} feed modules`);
  }

  return loaded;
}
