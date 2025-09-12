import { Sink } from './sink-factory';

export class StdoutSink implements Sink {
  constructor(private json: boolean = false) {}

  async write(batch: any[]): Promise<void> {
    for (const item of batch) {
      if (this.json) {
        // Format as single-line JSON objects
        console.log(JSON.stringify(item));
      } else {
        // Pretty print for human readability
        console.log(JSON.stringify(item, null, 2));
      }
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
