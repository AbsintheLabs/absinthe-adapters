import fs from 'fs';
import path from 'node:path';

export function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export function uniqueFilePath(p: string): string {
  if (!fs.existsSync(p)) return p;
  const dir = path.dirname(p);
  const ext = path.extname(p);
  const base = path.basename(p, ext);
  let i = 2;
  // foo.csv -> foo (2).csv, foo (3).csv, ...
  while (true) {
    const candidate = path.join(dir, `${base} (${i})${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
    i++;
  }
}

/**
 * Build a per-run directory:
 *   <baseDir>/_runs/<hash>/<YYYYMMDD-HHMMSS>[-pid]
 */
export function deriveRunDir(baseDir: string, hash: string): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = new Date();
  const stamp = [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
    '-',
    pad(d.getHours()),
    pad(d.getMinutes()),
    pad(d.getSeconds()),
  ].join('');
  const runDir = path.join(baseDir, '_runs', hash, `${stamp}-${process.pid}`);
  ensureDir(runDir);
  return runDir;
}
