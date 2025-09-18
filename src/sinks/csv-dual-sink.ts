import fs from 'fs';
import path from 'node:path';
import { format, CsvFormatterStream } from '@fast-csv/format';
import { Sink } from './sink-factory.ts';
import { uniqueFilePath } from '../utils/run-paths.ts';

type CsvStreams = { out: fs.WriteStream; stream: CsvFormatterStream<any, any> };

export class CsvDualSink implements Sink {
  private baseLabel: string; // purely cosmetic in file names
  private outDir: string; // absolute or relative; must exist
  private windows?: CsvStreams;
  private actions?: CsvStreams;

  /**
   * @param baseNameOrPath - e.g. "reports/pricing" or "reports/pricing.csv" or "pricing"
   * @param outDir         - per-run directory (already created)
   */
  constructor(baseNameOrPath: string, outDir: string) {
    const parsed = path.parse(baseNameOrPath);
    const base =
      parsed.ext.toLowerCase() === '.csv'
        ? parsed.name // strip .csv if present
        : parsed.base || 'absinthe';

    this.baseLabel = base;
    this.outDir = outDir;
  }

  async write(batch: any[]): Promise<void> {
    if (!batch?.length) return;
    const isWindows = this.isWindowRow(batch[0]);
    const rows = batch.map((r) => this.flattenObject(r));
    const target = isWindows ? await this.ensureWindows() : await this.ensureActions();

    for (const row of rows) {
      const ok = target.stream.write(row);
      if (!ok) await new Promise<void>((resolve) => target.stream.once('drain', resolve));
    }
  }

  async flush(): Promise<void> {
    return Promise.resolve();
  }

  async close(): Promise<void> {
    await Promise.all([this.closeOne(this.windows), this.closeOne(this.actions)]);
  }

  // ---------- internals ----------

  private async ensureWindows(): Promise<CsvStreams> {
    if (this.windows) return this.windows;
    this.windows = this.openCsv(this.filePath('windows'));
    return this.windows;
  }

  private async ensureActions(): Promise<CsvStreams> {
    if (this.actions) return this.actions;
    this.actions = this.openCsv(this.filePath('actions'));
    return this.actions;
  }

  private filePath(kind: 'windows' | 'actions'): string {
    const desired = path.join(this.outDir, `${this.baseLabel}-${kind}.csv`);
    // make unique if an identical file exists (unlikely since outDir is per-run, but safe)
    return uniqueFilePath(desired);
  }

  private openCsv(p: string): CsvStreams {
    const exists = fs.existsSync(p) && fs.statSync(p).size > 0;
    const out = fs.createWriteStream(p, { flags: exists ? 'a' : 'w' });
    const stream = format({ headers: true, writeHeaders: !exists });
    stream.pipe(out);
    return { out, stream };
  }

  private async closeOne(s?: CsvStreams): Promise<void> {
    if (!s) return;
    await new Promise<void>((resolve, reject) => {
      const onError = (e: any) => reject(e);
      s.stream.once('error', onError);
      s.out.once('error', onError);
      s.out.once('finish', () => resolve());
      s.stream.end();
    });
  }

  private isWindowRow(row: any): boolean {
    return (
      row && ('startTs' in row || 'startHeight' in row) && ('endTs' in row || 'endHeight' in row)
    );
  }

  private flattenObject(obj: any, prefix = ''): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;

      if (k === 'protocolMetadata' || key.endsWith('.protocolMetadata')) {
        out[key] = typeof v === 'object' ? JSON.stringify(v) : v;
        continue;
      }
      if (v == null) out[key] = '';
      else if (Array.isArray(v)) out[key] = JSON.stringify(v);
      else if (typeof v === 'object') Object.assign(out, this.flattenObject(v, key));
      else out[key] = v;
    }
    return out;
  }
}
