import { SinkConfig } from '../config/schema';
import { CsvSink } from './csv-sink';
import { StdoutSink } from './stdout-sink';
import { CompositeSink } from './composite-sink';

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
      case 'csv':
        return new CsvSink(cfg.path);
      case 'stdout':
        return new StdoutSink();
      case 'absinthe':
        throw new Error('Absinthe sink not implemented yet');
      default:
        throw new Error(`Unknown sink kind: ${(cfg as any).sinkType}`);
    }
  }
}
