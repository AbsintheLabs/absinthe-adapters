import { CsvSink } from './csv-sink';
import { ApiSink } from './api-sink';
import { Sink, SinkConfig } from '../types';
import { AbsintheApiClient } from '@absinthe/common';

class SinkFactory {
  static create(cfg: SinkConfig, apiClient?: AbsintheApiClient): Sink {
    switch (cfg.kind) {
      case 'csv':
        return new CsvSink(cfg.path);
      case 'absinthe':
        if (!apiClient) {
          throw new Error('AbsintheApiClient is required for absinthe sink');
        }
        return new ApiSink(apiClient);
      default:
        throw new Error(`Unknown sink kind: ${(cfg as any).kind}`);
    }
  }
}

export { SinkFactory };
