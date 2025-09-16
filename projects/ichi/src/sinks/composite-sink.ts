import { Sink } from './sink-factory';

/**
 * CompositeSink - A sink that writes to multiple sinks simultaneously
 */
export class CompositeSink implements Sink {
  constructor(private sinks: Sink[]) {}

  async init?(): Promise<void> {
    // Initialize all sinks that have an init method
    const initPromises = this.sinks.filter((sink) => sink.init).map((sink) => sink.init!());

    await Promise.all(initPromises);
  }

  async write(batch: unknown[]): Promise<void> {
    // Write to all sinks concurrently
    const writePromises = this.sinks.map((sink) => sink.write(batch));
    await Promise.all(writePromises);
  }

  async flush?(): Promise<void> {
    // Flush all sinks that have a flush method
    const flushPromises = this.sinks.filter((sink) => sink.flush).map((sink) => sink.flush!());

    await Promise.all(flushPromises);
  }

  async close?(): Promise<void> {
    // Close all sinks that have a close method
    const closePromises = this.sinks.filter((sink) => sink.close).map((sink) => sink.close!());

    await Promise.all(closePromises);
  }
}
