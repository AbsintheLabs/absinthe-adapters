import path from 'node:path';
import {
  SinkConfig,
  SingleSinkConfig,
  CsvSinkConfig,
  StdoutSinkConfig,
  AbsintheSinkConfig,
} from '../config/schema.ts';
import { CsvDualSink } from './csv-dual-sink.ts';
import { StdoutSink } from './stdout-sink.ts';
import { CompositeSink } from './composite-sink.ts';
import { AbsintheSink } from './absinthe-sink.ts';
import { deriveRunDir } from '../utils/run-paths.ts';
import { getRuntime } from '../runtime/context.ts';

export interface TrackableInstanceMetadata {
  trackable_instance_id: string;
  config_hash: string;
  full_config: unknown;
  adapter_id: string;
  trackable_name: string;
  trackable_config: unknown;
}

export interface SinkInitMetadata {
  trackableInstances: TrackableInstanceMetadata[];
}

export interface Sink {
  init?(metadata?: SinkInitMetadata): Promise<void>;
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

  private static createSingleSink(cfg: SingleSinkConfig): Sink {
    switch (cfg.sinkType) {
      case 'csv': {
        // Type narrowing: cfg is now CsvSinkConfig
        const csvCfg = cfg;
        const cfgPath = csvCfg.path ?? 'absinthe';
        const { configHash } = getRuntime(); // already set in main()
        // Use directory of cfg.path as base; put per-run outputs under _runs/<hash>/<timestamp>-pid/
        const dir = path.dirname(cfgPath) === '.' ? process.cwd() : path.dirname(cfgPath);
        const runDir = deriveRunDir(dir, configHash); // ensures dir exists
        const baseName = path.parse(cfgPath).base; // keep name influence
        return new CsvDualSink(baseName, runDir);
      }
      case 'stdout': {
        // Type narrowing: cfg is now StdoutSinkConfig
        // Currently StdoutSink doesn't use any config, but this ensures type safety
        return new StdoutSink();
      }
      case 'absinthe': {
        // Type narrowing: cfg is now AbsintheSinkConfig
        const absintheCfg = cfg;
        return new AbsintheSink({
          url: absintheCfg.url,
          apiKey: absintheCfg.apiKey,
          rateLimit: absintheCfg.rateLimit,
          batchSize: absintheCfg.batchSize,
        });
      }
      default: {
        // Exhaustiveness check: TypeScript will error if we miss a case
        const _exhaustive: never = cfg;
        throw new Error(`Unknown sink kind: ${(_exhaustive as SingleSinkConfig).sinkType}`);
      }
    }
  }
}
