import { Sink } from './sink-factory';

export class StdoutSink implements Sink {
  async write(batch: any[]): Promise<void> {
    for (const item of batch) {
      // Format as single-line JSON objects
      console.log(JSON.stringify(item));
    }
  }

  async flush(): Promise<void> {
    // stdout flushes automatically
    return Promise.resolve();
  }

  async close(): Promise<void> {
    // Nothing to close for stdout
    return Promise.resolve();
  }
}
