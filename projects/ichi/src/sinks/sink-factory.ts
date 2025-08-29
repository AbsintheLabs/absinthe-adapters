import { CsvSink } from './csv-sink';
import { Sink, SinkConfig } from '../types';

class SinkFactory {
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

export { SinkFactory };
