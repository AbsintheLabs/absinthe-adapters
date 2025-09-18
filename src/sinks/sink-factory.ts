import path from 'node:path';
import { SinkConfig } from '../config/schema.ts';
import { CsvDualSink } from './csv-dual-sink.ts';
import { StdoutSink } from './stdout-sink.ts';
import { CompositeSink } from './composite-sink.ts';
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
        throw new Error('Absinthe sink not implemented yet');
      default:
        throw new Error(`Unknown sink kind: ${(cfg as any).sinkType}`);
    }
  }
}
