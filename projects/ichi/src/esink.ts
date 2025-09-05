import fs from 'fs';
import { format } from '@fast-csv/format';
import { SinkConfig } from './config/schema';

export interface Sink {
  init?(): Promise<void>;
  write(batch: unknown[]): Promise<void>; // or writeOne(e: unknown)
  flush?(): Promise<void>;
  close?(): Promise<void>;
}

export class SinkFactory {
  static create(cfg: SinkConfig): Sink {
    switch (cfg.sinkType) {
      case 'csv':
        return new CsvSink(cfg.path);
      case 'absinthe':
        throw new Error('Absinthe sink not implemented yet');
      default:
        throw new Error(`Unknown sink kind: ${(cfg as any).sinkType}`);
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
      const canWrite = this.stream.write(row);
      if (!canWrite) {
        await new Promise<void>((resolve) => this.stream.once('drain', resolve));
      }
    }
  }

  async flush(): Promise<void> {
    // No explicit flush API; rely on backpressure handling in write().
    return Promise.resolve();
  }

  async close(): Promise<void> {
    // Ensure all data is flushed to disk before returning
    await new Promise<void>((resolve, reject) => {
      const onError = (err: any) => reject(err);
      this.stream.once('error', onError);
      this.out.once('error', onError);
      this.out.once('finish', () => resolve());
      this.stream.end();
    });
  }
}
// END SINK STUFF
