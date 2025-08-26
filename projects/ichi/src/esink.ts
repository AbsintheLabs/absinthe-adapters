import fs from 'fs';
import { format } from '@fast-csv/format';

export interface Sink {
  init?(): Promise<void>;
  write(batch: unknown[]): Promise<void>; // or writeOne(e: unknown)
  flush?(): Promise<void>;
  close?(): Promise<void>;
}

// Factory input selected at engine construction
export type SinkConfig =
  | { kind: 'csv'; path: string }
  | { kind: 'absinthe'; url: string; apiKey?: string; rateLimit?: number; batchSize?: number };

export class SinkFactory {
  static create(cfg: SinkConfig): Sink {
    switch (cfg.kind) {
      case 'csv':
        return new CsvSink(cfg.path);
      case 'absinthe':
        throw new Error('Absinthe sink not implemented yet');
      default:
        throw new Error(`Unknown sink kind: ${(cfg as any).kind}`);
    }
  }
}

// CSV SINK IMPLEMENTATION
export class CsvSink implements Sink {
  private stream = format({ headers: true });
  private out: fs.WriteStream;

  constructor(private path: string) {
    const fileExists = fs.existsSync(path) && fs.statSync(path).size > 0;

    this.out = fs.createWriteStream(path, { flags: 'a' });
    this.stream = format({
      headers: true,
      writeHeaders: !fileExists, // << key line
    });

    this.stream.pipe(this.out);
  }

  private flattenObject(obj: any, prefix = ''): Record<string, any> {
    const flattened: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      // Special handling for protocolMetadata - keep as JSON string
      if (key === 'protocolMetadata' || newKey.endsWith('.protocolMetadata')) {
        flattened[newKey] = typeof value === 'object' ? JSON.stringify(value) : value;
        continue;
      }

      if (value === null || value === undefined) {
        flattened[newKey] = '';
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else if (Array.isArray(value)) {
        flattened[newKey] = JSON.stringify(value);
      } else {
        flattened[newKey] = value;
      }
    }
    return flattened;
  }

  async write(batch: any[]) {
    const flattenedBatch = batch.map((row) => this.flattenObject(row));
    for (const row of flattenedBatch) {
      this.stream.write(row);
    }
  }
}
// END SINK STUFF
