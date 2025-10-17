import path from 'node:path';
import { SinkConfig } from '../config/schema.ts';
import { CsvDualSink } from './csv-dual-sink.ts';
import { StdoutSink } from './stdout-sink.ts';
import { CompositeSink } from './composite-sink.ts';
import { AbsintheSink } from './absinthe-sink.ts';
import { deriveRunDir } from '../utils/run-paths.ts';
import { getRuntime } from '../runtime/context.ts';

export interface Sink {
  init?(): Promise<void>;
  write(batch: unknown[]): Promise<void>; // or writeOne(e: unknown)
  flush?(): Promise<void>;
  close?(): Promise<void>;
}

export class SinkFactory {
  static create(cfg: SinkConfig): Sink {
    // Check if this is a multiple sinks configuration
    if ('sinks' in cfg) {
      // Multiple sinks configuration
      const sinks = cfg.sinks.map((sinkConfig) => this.createSingleSink(sinkConfig));
      return new CompositeSink(sinks);
    } else {
      // Single sink configuration (backwards compatibility)
      return this.createSingleSink(cfg);
    }
  }

  // fixme: remove all the (cfg as any) casts for better type safety
  private static createSingleSink(cfg: Extract<SinkConfig, { sinkType: string }>): Sink {
    switch (cfg.sinkType) {
      case 'csv': {
        const cfgPath = (cfg as any).path ?? 'absinthe';
        const { configHash } = getRuntime(); // already set in main()
        // Use directory of cfg.path as base; put per-run outputs under _runs/<hash>/<timestamp>-pid/
        const dir = path.dirname(cfgPath) === '.' ? process.cwd() : path.dirname(cfgPath);
        const runDir = deriveRunDir(dir, configHash); // ensures dir exists
        const baseName = path.parse(cfgPath).base; // keep name influence
        return new CsvDualSink(baseName, runDir);
      }
      case 'stdout':
        return new StdoutSink();
      case 'absinthe':
        return new AbsintheSink({
          url: (cfg as any).url,
          apiKey: (cfg as any).apiKey,
          rateLimit: (cfg as any).rateLimit,
          batchSize: (cfg as any).batchSize,
        });
      default:
        throw new Error(`Unknown sink kind: ${(cfg as any).sinkType}`);
    }
  }
}
