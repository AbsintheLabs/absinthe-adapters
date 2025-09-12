import { SinkConfig } from '../config/schema';
import { CsvSink } from './csv-sink';
import { StdoutSink } from './stdout-sink';

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
      case 'stdout':
        return new StdoutSink(cfg.json);
      case 'absinthe':
        throw new Error('Absinthe sink not implemented yet');
      default:
        throw new Error(`Unknown sink kind: ${(cfg as any).sinkType}`);
    }
  }
}
