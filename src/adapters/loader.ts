// src/adapter-loader.ts
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { log } from '../utils/logger.js';

type LoadOptions = {
  // Explicit path to the adapters directory at repo root (default: auto-resolve)
  adaptersDir?: string;
  // Optional extra include patterns if you want more than index.* and *.adapter.*
  extraGlobs?: RegExp[];
  // Folders to ignore
  ignoreDirs?: string[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Robust repoRoot: src/* -> repo root
const repoRoot = path.resolve(__dirname, '..'); // adjust if your src nesting differs

// Try both source and build layouts
const defaultCandidates = [
  // path.resolve(repoRoot, 'adapters'),                // repo/adapters (source side-by-side)
  path.resolve(repoRoot, '../adapters'), // repo/src -> repo/adapters
  path.resolve(repoRoot, 'dist', 'adapters'), // build layout
];

const DEFAULT_EXTS = ['.ts', '.js', '.mjs', '.cjs'];
const DEFAULT_FILE_PATTERNS = [
  // folder-based adapters: adapters/foo/index.ts
  new RegExp(`^index\\.(ts|js|mjs|cjs)$`, 'i'),
  // single-file adapters: adapters/foo.adapter.ts
  new RegExp(`\\.adapter\\.(ts|js|mjs|cjs)$`, 'i'),
];

const DEFAULT_IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.github',
  '.turbo',
  '.next',
  '.cache',
  'coverage',
  '_shared',
  'abi',
  'test',
  'tests',
  '__tests__',
  '__mocks__',
  'scripts',
]);

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) {
      if (DEFAULT_IGNORE_DIRS.has(entry.name)) continue;
      await walk(path.join(dir, entry.name), out);
    } else if (entry.isFile()) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function looksLikeAdapterFile(file: string, extra?: RegExp[]): boolean {
  const base = path.basename(file);
  if (!DEFAULT_EXTS.includes(path.extname(base))) return false;
  if (DEFAULT_FILE_PATTERNS.some((r) => r.test(base))) return true;
  if (extra && extra.some((r) => r.test(base))) return true;
  return false;
}

/**
 * Dynamically import all adapter modules for side-effect registration.
 * Each adapter module must call registerAdapter(...) when evaluated.
 */
export async function loadAllAdapters(opts: LoadOptions = {}): Promise<string[]> {
  const candidates = opts.adaptersDir ? [opts.adaptersDir] : defaultCandidates;

  let adaptersDir: string | null = null;
  for (const c of candidates) {
    try {
      const files = await readdir(c);
      if (files) {
        adaptersDir = c;
        break;
      }
    } catch {
      /* try next */
    }
  }
  if (!adaptersDir) {
    log.warn('[adapter-loader] No adapters directory found. Checked:', candidates);
    return [];
  }

  const files = await walk(adaptersDir);
  const adapterFiles = files.filter((f) => looksLikeAdapterFile(f, opts.extraGlobs));

  const loaded: string[] = [];
  for (const f of adapterFiles) {
    try {
      // Convert absolute path to file:// URL for ESM dynamic import
      const url = pathToFileURL(f).href;
      log.debug(`[adapter-loader] Loading adapter from: ${path.relative(adaptersDir, f)}`);
      await import(url);
      loaded.push(f);
    } catch (err) {
      log.error(`[adapter-loader] Failed to import ${f}`, err);
    }
  }
  if (loaded.length === 0) {
    log.warn(
      '[adapter-loader] Found adapters dir but loaded 0 modules. Check file names match patterns.',
    );
  } else {
    log.debug(`[adapter-loader] Successfully loaded ${loaded.length} adapter modules`);
  }
  return loaded;
}
